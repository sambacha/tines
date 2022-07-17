import { BigNumber } from '@ethersproject/bignumber';
import { Observable } from 'rxjs';

let APPLIED = false;
const applyPatches = () => {
  if (APPLIED) {
    return;
  }
  const sub = Observable.prototype.subscribe;
  Observable.prototype.subscribe = function(...args) {
    const sink = sub.call(this, ...args);
    const unsub = sink.unsubscribe;
    sink.unsubscribe = (...unsubArcs) => {
      unsub.call(sink, ...unsubArcs);
      sink.unsubscribe = unsub.bind(sink);
    };
    return sink;
  };
  APPLIED = true;
};

require("debug")("tines");
function ASSERT(f, t) {
  if (process.env.NODE_ENV !== "production" && (!f() && t))
    console.error(t);
}
let DEBUG_MODE = false;
function DEBUG(f) {
  if (DEBUG_MODE)
    f();
}
function DEBUG_MODE_ON(on) {
  DEBUG_MODE = on;
}
let TINES_TRACE_MODE = false;
function isTraceMode() {
  return TINES_TRACE_MODE;
}
function _disableDTraceMode() {
  TINES_TRACE_MODE = false;
}
function enableTraceMode() {
  TINES_TRACE_MODE = true;
  applyPatches();
}
function closeValues(a, b, accuracy) {
  if (accuracy === 0)
    return a === b;
  if (a < 1 / accuracy)
    return Math.abs(a - b) <= 10;
  return Math.abs(a / b - 1) < accuracy;
}
function calcSquareEquation(a, b, c) {
  const D = b * b - 4 * a * c;
  console.assert(D >= 0, `Discriminant is negative! ${a} ${b} ${c}`);
  const sqrtD = Math.sqrt(D);
  return [(-b - sqrtD) / 2 / a, (-b + sqrtD) / 2 / a];
}
function revertPositive(f, out, hint = 1) {
  try {
    if (out <= f(0))
      return 0;
    let min;
    let max;
    if (f(hint) > out) {
      min = hint / 2;
      while (f(min) > out)
        min /= 2;
      max = min * 2;
    } else {
      max = hint * 2;
      while (f(max) < out)
        max *= 2;
      min = max / 2;
    }
    while (max / min - 1 > 1e-4) {
      const x0 = (min + max) / 2;
      const y0 = f(x0);
      if (out === y0)
        return x0;
      if (out < y0)
        max = x0;
      else
        min = x0;
    }
    return (min + max) / 2;
  } catch (e) {
    return 0;
  }
}
function getBigNumber(value) {
  const v = Math.abs(value);
  if (v < Number.MAX_SAFE_INTEGER)
    return BigNumber.from(Math.round(value));
  const exp = Math.floor(Math.log(v) / Math.LN2);
  console.assert(exp >= 51, "Internal Error 314");
  const shift = exp - 51;
  const mant = Math.round(v / 2 ** shift);
  const res = BigNumber.from(mant).mul(BigNumber.from(2).pow(shift));
  return value > 0 ? res : res.mul(-1);
}

const TYPICAL_SWAP_GAS_COST = 6e4;
const TYPICAL_MINIMAL_LIQUIDITY = 1e3;
class RPool {
  address;
  token0;
  token1;
  fee;
  reserve0;
  reserve1;
  minLiquidity;
  swapGasCost;
  constructor(address, token0, token1, fee, reserve0, reserve1, minLiquidity = TYPICAL_MINIMAL_LIQUIDITY, swapGasCost = TYPICAL_SWAP_GAS_COST) {
    this.address = address;
    this.token0 = token0, this.token1 = token1;
    this.fee = fee;
    this.minLiquidity = minLiquidity;
    this.swapGasCost = swapGasCost;
    this.reserve0 = reserve0;
    this.reserve1 = reserve1;
  }
  updateReserves(res0, res1) {
    this.reserve0 = res0;
    this.reserve1 = res1;
  }
}
class ConstantProductRPool extends RPool {
  reserve0Number;
  reserve1Number;
  constructor(address, token0, token1, fee, reserve0, reserve1) {
    super(address, token0, token1, fee, reserve0, reserve1);
    this.reserve0Number = parseInt(reserve0.toString());
    this.reserve1Number = parseInt(reserve1.toString());
  }
  updateReserves(res0, res1) {
    this.reserve0 = res0;
    this.reserve0Number = parseInt(res0.toString());
    this.reserve1 = res1;
    this.reserve1Number = parseInt(res1.toString());
  }
  calcOutByIn(amountIn, direction) {
    const x = direction ? this.reserve0Number : this.reserve1Number;
    const y = direction ? this.reserve1Number : this.reserve0Number;
    return { out: y * amountIn / (x / (1 - this.fee) + amountIn), gasSpent: this.swapGasCost };
  }
  calcInByOut(amountOut, direction) {
    const x = direction ? this.reserve0Number : this.reserve1Number;
    const y = direction ? this.reserve1Number : this.reserve0Number;
    if (y - amountOut < this.minLiquidity)
      return { inp: Number.POSITIVE_INFINITY, gasSpent: this.swapGasCost };
    let input = x * amountOut / (1 - this.fee) / (y - amountOut);
    return { inp: input, gasSpent: this.swapGasCost };
  }
  calcCurrentPriceWithoutFee(direction) {
    return this.calcPrice(0, direction, false);
  }
  calcPrice(amountIn, direction, takeFeeIntoAccount) {
    const x = direction ? this.reserve0Number : this.reserve1Number;
    const y = direction ? this.reserve1Number : this.reserve0Number;
    const oneMinusFee = takeFeeIntoAccount ? 1 - this.fee : 1;
    const xf = x / oneMinusFee;
    return y * xf / (xf + amountIn) / (xf + amountIn);
  }
  calcInputByPrice(price, direction, takeFeeIntoAccount) {
    const x = direction ? this.reserve0Number : this.reserve1Number;
    const y = direction ? this.reserve1Number : this.reserve0Number;
    const oneMinusFee = takeFeeIntoAccount ? 1 - this.fee : 1;
    const xf = x / oneMinusFee;
    return Math.sqrt(y * xf * price) - xf;
  }
  getLiquidity() {
    return Math.sqrt(this.reserve0Number * this.reserve1Number);
  }
}
class HybridRPool extends RPool {
  A;
  A_PRECISION = 100;
  D;
  constructor(address, token0, token1, fee, A, reserve0, reserve1) {
    super(address, token0, token1, fee, reserve0, reserve1);
    this.A = A;
    this.D = BigNumber.from(0);
  }
  updateReserves(res0, res1) {
    this.D = BigNumber.from(0);
    this.reserve0 = res0;
    this.reserve1 = res1;
  }
  computeLiquidity() {
    if (!this.D.eq(0))
      return this.D;
    const r0 = this.reserve0;
    const r1 = this.reserve1;
    if (r0.isZero() && r1.isZero())
      return BigNumber.from(0);
    const s = r0.add(r1);
    const nA = BigNumber.from(this.A * 2);
    let prevD;
    let D = s;
    for (let i = 0; i < 256; i++) {
      const dP = D.mul(D).div(r0).mul(D).div(r1).div(4);
      prevD = D;
      D = nA.mul(s).div(this.A_PRECISION).add(dP.mul(2)).mul(D).div(nA.div(this.A_PRECISION).sub(1).mul(D).add(dP.mul(3)));
      if (D.sub(prevD).abs().lte(1)) {
        break;
      }
    }
    this.D = D;
    return D;
  }
  computeY(x) {
    const D = this.computeLiquidity();
    const nA = this.A * 2;
    let c = D.mul(D).div(x.mul(2)).mul(D).div(nA * 2 / this.A_PRECISION);
    let b = D.mul(this.A_PRECISION).div(nA).add(x);
    let yPrev;
    let y = D;
    for (let i = 0; i < 256; i++) {
      yPrev = y;
      y = y.mul(y).add(c).div(y.mul(2).add(b).sub(D));
      if (y.sub(yPrev).abs().lte(1)) {
        break;
      }
    }
    return y;
  }
  calcOutByIn(amountIn, direction) {
    const xBN = direction ? this.reserve0 : this.reserve1;
    const yBN = direction ? this.reserve1 : this.reserve0;
    const xNewBN = xBN.add(getBigNumber(amountIn * (1 - this.fee)));
    const yNewBN = this.computeY(xNewBN);
    const dy = parseInt(yBN.sub(yNewBN).toString());
    return { out: dy, gasSpent: this.swapGasCost };
  }
  calcInByOut(amountOut, direction) {
    const xBN = direction ? this.reserve0 : this.reserve1;
    const yBN = direction ? this.reserve1 : this.reserve0;
    let yNewBN = yBN.sub(getBigNumber(amountOut));
    if (yNewBN.lt(1))
      yNewBN = BigNumber.from(1);
    const xNewBN = this.computeY(yNewBN);
    let input = Math.round(parseInt(xNewBN.sub(xBN).toString()) / (1 - this.fee));
    return { inp: input, gasSpent: this.swapGasCost };
  }
  calcCurrentPriceWithoutFee(direction) {
    return this.calcPrice(0, direction, false);
  }
  calcPrice(amountIn, direction, takeFeeIntoAccount) {
    const xBN = direction ? this.reserve0 : this.reserve1;
    const x = parseInt(xBN.toString());
    const oneMinusFee = takeFeeIntoAccount ? 1 - this.fee : 1;
    const D = parseInt(this.computeLiquidity().toString());
    const A = this.A / this.A_PRECISION;
    const xI = x + amountIn;
    const b = 4 * A * xI + D - 4 * A * D;
    const ac4 = D * D * D / xI;
    const Ds = Math.sqrt(b * b + 4 * A * ac4);
    const res = (0.5 - (2 * b - ac4 / xI) / Ds / 4) * oneMinusFee;
    return res;
  }
  calcInputByPrice(price, direction, takeFeeIntoAccount, hint = 1) {
    return revertPositive((x) => 1 / this.calcPrice(x, direction, takeFeeIntoAccount), price, hint);
  }
}

const CL_MIN_TICK = -887272;
const CL_MAX_TICK = -CL_MIN_TICK - 1;
class CLRPool extends RPool {
  tickSpacing;
  liquidity;
  sqrtPrice;
  nearestTick;
  ticks;
  constructor(address, token0, token1, fee, tickSpacing, reserve0, reserve1, liquidity, sqrtPrice, nearestTick, ticks) {
    super(address, token0, token1, fee, reserve0, reserve1, TYPICAL_MINIMAL_LIQUIDITY, TYPICAL_SWAP_GAS_COST);
    this.tickSpacing = tickSpacing;
    this.liquidity = liquidity;
    this.sqrtPrice = sqrtPrice;
    this.nearestTick = nearestTick;
    this.ticks = ticks;
    if (this.ticks.length === 0) {
      this.ticks.push({ index: CL_MIN_TICK, DLiquidity: 0 });
      this.ticks.push({ index: CL_MAX_TICK, DLiquidity: 0 });
    }
    if (this.ticks[0].index > CL_MIN_TICK)
      this.ticks.unshift({ index: CL_MIN_TICK, DLiquidity: 0 });
    if (this.ticks[this.ticks.length - 1].index < CL_MAX_TICK)
      this.ticks.push({ index: CL_MAX_TICK, DLiquidity: 0 });
  }
  calcOutByIn(amountIn, direction) {
    let nextTickToCross = direction ? this.nearestTick : this.nearestTick + 1;
    let currentPrice = this.sqrtPrice;
    let currentLiquidity = this.liquidity;
    let outAmount = 0;
    let input = amountIn;
    while (input > 0) {
      if (nextTickToCross < 0 || nextTickToCross >= this.ticks.length)
        return { out: outAmount, gasSpent: this.swapGasCost };
      const nextTickPrice = Math.sqrt(Math.pow(1.0001, this.ticks[nextTickToCross].index));
      let output = 0;
      if (direction) {
        const maxDx = currentLiquidity * (currentPrice - nextTickPrice) / currentPrice / nextTickPrice;
        if (input <= maxDx) {
          output = currentLiquidity * currentPrice * input / (input + currentLiquidity / currentPrice);
          input = 0;
        } else {
          output = currentLiquidity * (currentPrice - nextTickPrice);
          currentPrice = nextTickPrice;
          input -= maxDx;
          if (this.ticks[nextTickToCross].index / this.tickSpacing % 2 === 0) {
            currentLiquidity -= this.ticks[nextTickToCross].DLiquidity;
          } else {
            currentLiquidity += this.ticks[nextTickToCross].DLiquidity;
          }
          nextTickToCross--;
        }
      } else {
        const maxDy = currentLiquidity * (nextTickPrice - currentPrice);
        if (input <= maxDy) {
          output = input / currentPrice / (currentPrice + input / currentLiquidity);
          input = 0;
        } else {
          output = currentLiquidity * (nextTickPrice - currentPrice) / currentPrice / nextTickPrice;
          currentPrice = nextTickPrice;
          input -= maxDy;
          if (this.ticks[nextTickToCross].index / this.tickSpacing % 2 === 0) {
            currentLiquidity += this.ticks[nextTickToCross].DLiquidity;
          } else {
            currentLiquidity -= this.ticks[nextTickToCross].DLiquidity;
          }
          nextTickToCross++;
        }
      }
      outAmount += output * (1 - this.fee);
    }
    return { out: outAmount, gasSpent: this.swapGasCost };
  }
  calcInByOut(amountOut, direction) {
    let nextTickToCross = direction ? this.nearestTick : this.nearestTick + 1;
    let currentPrice = this.sqrtPrice;
    let currentLiquidity = this.liquidity;
    let input = 0;
    let outBeforeFee = amountOut / (1 - this.fee);
    while (outBeforeFee > 0) {
      if (nextTickToCross < 0 || nextTickToCross >= this.ticks.length)
        return { inp: input, gasSpent: this.swapGasCost };
      const nextTickPrice = Math.sqrt(Math.pow(1.0001, this.ticks[nextTickToCross].index));
      if (direction) {
        const maxDy = currentLiquidity * (currentPrice - nextTickPrice);
        if (outBeforeFee <= maxDy) {
          input += outBeforeFee / currentPrice / (currentPrice - outBeforeFee / currentLiquidity);
          outBeforeFee = 0;
        } else {
          input += currentLiquidity * (currentPrice - nextTickPrice) / currentPrice / nextTickPrice;
          currentPrice = nextTickPrice;
          outBeforeFee -= maxDy;
          if (this.ticks[nextTickToCross].index / this.tickSpacing % 2 === 0) {
            currentLiquidity -= this.ticks[nextTickToCross].DLiquidity;
          } else {
            currentLiquidity += this.ticks[nextTickToCross].DLiquidity;
          }
          nextTickToCross--;
        }
      } else {
        const maxDx = currentLiquidity * (nextTickPrice - currentPrice) / currentPrice / nextTickPrice;
        if (outBeforeFee <= maxDx) {
          input += currentLiquidity * currentPrice * outBeforeFee / (currentLiquidity / currentPrice - outBeforeFee);
          outBeforeFee = 0;
        } else {
          input += currentLiquidity * (nextTickPrice - currentPrice);
          currentPrice = nextTickPrice;
          outBeforeFee -= maxDx;
          if (this.ticks[nextTickToCross].index / this.tickSpacing % 2 === 0) {
            currentLiquidity += this.ticks[nextTickToCross].DLiquidity;
          } else {
            currentLiquidity -= this.ticks[nextTickToCross].DLiquidity;
          }
          nextTickToCross++;
        }
      }
    }
    return { inp: input, gasSpent: this.swapGasCost };
  }
  calcCurrentPriceWithoutFee(direction) {
    const p = this.sqrtPrice * this.sqrtPrice;
    return direction ? p : 1 / p;
  }
}

function toAmountBN(share, total) {
  if (total.base.isZero() || total.elastic.isZero())
    return share;
  return share.mul(total.elastic).div(total.base);
}
class RebaseInternal {
  elastic2Base;
  rebaseBN;
  constructor(rebase) {
    this.rebaseBN = rebase;
    if (rebase.base.isZero() || rebase.elastic.isZero())
      this.elastic2Base = 1;
    else
      this.elastic2Base = parseInt(rebase.elastic.toString()) / parseInt(rebase.base.toString());
  }
  toAmount(share) {
    return share * this.elastic2Base;
  }
  toShare(amount) {
    return amount / this.elastic2Base;
  }
  toAmountBN(share) {
    return toAmountBN(share, this.rebaseBN);
  }
}
class StableSwapRPool extends RPool {
  k;
  total0;
  total1;
  constructor(address, token0, token1, fee, reserve0, reserve1, total0, total1) {
    super(address, token0, token1, fee, toAmountBN(reserve0, total0), toAmountBN(reserve1, total1));
    this.k = BigNumber.from(0);
    this.total0 = new RebaseInternal(total0);
    this.total1 = new RebaseInternal(total1);
  }
  updateReserves(res0, res1) {
    this.k = BigNumber.from(0);
    this.reserve0 = this.total0.toAmountBN(res0);
    this.reserve1 = this.total1.toAmountBN(res1);
  }
  computeK() {
    if (this.k.isZero()) {
      const x = this.reserve0;
      const y = this.reserve1;
      this.k = x.mul(y).mul(x.mul(x).add(y.mul(y)));
    }
    return this.k;
  }
  computeY(x, yHint) {
    const k = this.computeK();
    const x2 = x.shl(1);
    const x3 = x.mul(3);
    const xCube = x.mul(x).mul(x);
    let yPrev = yHint, y = yHint;
    for (let i = 0; i < 255; ++i) {
      const ySquare = y.mul(y);
      const yCube = ySquare.mul(y);
      y = yCube.mul(x2).add(k).div(ySquare.mul(x3).add(xCube));
      if (y.sub(yPrev).abs().lte(1))
        break;
      yPrev = y;
    }
    return y;
  }
  calcOutByIn(amountIn, direction) {
    amountIn = direction ? this.total0.toAmount(amountIn) : this.total1.toAmount(amountIn);
    const x = direction ? this.reserve0 : this.reserve1;
    const y = direction ? this.reserve1 : this.reserve0;
    const xNew = x.add(getBigNumber(Math.floor(amountIn * (1 - this.fee))));
    const yNew = this.computeY(xNew, y);
    const outA = parseInt(y.sub(yNew).toString()) - 1;
    const outB = Math.max(outA, 0);
    const out = direction ? this.total1.toShare(outB) : this.total0.toShare(outB);
    return { out, gasSpent: this.swapGasCost };
  }
  calcInByOut(amountOut, direction) {
    amountOut = direction ? this.total0.toAmount(amountOut) : this.total1.toAmount(amountOut);
    const x = direction ? this.reserve0 : this.reserve1;
    const y = direction ? this.reserve1 : this.reserve0;
    let yNew = y.sub(getBigNumber(Math.ceil(amountOut)));
    if (yNew.lt(this.minLiquidity))
      return { inp: Number.POSITIVE_INFINITY, gasSpent: this.swapGasCost };
    const xNew = this.computeY(yNew, x);
    const input = Math.round(parseInt(xNew.sub(x).toString()) / (1 - this.fee)) + 1;
    const inp = direction ? this.total1.toShare(input) : this.total0.toShare(input);
    return { inp, gasSpent: this.swapGasCost };
  }
  calcCurrentPriceWithoutFee(direction) {
    const calcDirection = this.reserve0.gt(this.reserve1);
    const xBN = calcDirection ? this.reserve0 : this.reserve1;
    const x = parseInt(xBN.toString());
    const k = parseInt(this.computeK().toString());
    const q = k / x / 2;
    const qD = -q / x;
    const Q = Math.pow(x, 6) / 27 + q * q;
    const QD = 6 * Math.pow(x, 5) / 27 + 2 * q * qD;
    const sqrtQ = Math.sqrt(Q);
    const sqrtQD = 1 / 2 / sqrtQ * QD;
    const a = sqrtQ + q;
    const aD = sqrtQD + qD;
    const b = sqrtQ - q;
    const bD = sqrtQD - qD;
    const a3 = Math.pow(a, 1 / 3);
    const a3D = 1 / 3 * a3 / a * aD;
    const b3 = Math.pow(b, 1 / 3);
    const b3D = 1 / 3 * b3 / b * bD;
    const yD = a3D - b3D;
    const yDShares = calcDirection ? this.total1.toShare(this.total0.toAmount(yD)) : this.total0.toShare(this.total1.toAmount(yD));
    return calcDirection == direction ? -yDShares : -1 / yDShares;
  }
}

var RouteStatus = /* @__PURE__ */ ((RouteStatus2) => {
  RouteStatus2["Success"] = "Success";
  RouteStatus2["NoWay"] = "NoWay";
  RouteStatus2["Partial"] = "Partial";
  return RouteStatus2;
})(RouteStatus || {});
class Edge {
  pool;
  vert0;
  vert1;
  canBeUsed;
  direction;
  amountInPrevious;
  amountOutPrevious;
  spentGas;
  spentGasNew;
  bestEdgeIncome;
  constructor(p, v0, v1) {
    this.pool = p;
    this.vert0 = v0;
    this.vert1 = v1;
    this.amountInPrevious = 0;
    this.amountOutPrevious = 0;
    this.canBeUsed = true;
    this.direction = true;
    this.spentGas = 0;
    this.spentGasNew = 0;
    this.bestEdgeIncome = 0;
  }
  cleanTmpData() {
    this.amountInPrevious = 0;
    this.amountOutPrevious = 0;
    this.canBeUsed = true;
    this.direction = true;
    this.spentGas = 0;
    this.spentGasNew = 0;
    this.bestEdgeIncome = 0;
  }
  reserve(v) {
    return v === this.vert0 ? this.pool.reserve0 : this.pool.reserve1;
  }
  calcOutput(v, amountIn) {
    let res;
    let gas;
    if (v === this.vert1) {
      if (this.direction) {
        if (amountIn < this.amountOutPrevious) {
          const { inp, gasSpent } = this.pool.calcInByOut(this.amountOutPrevious - amountIn, true);
          res = this.amountInPrevious - inp;
          gas = gasSpent;
        } else {
          const { out, gasSpent } = this.pool.calcOutByIn(amountIn - this.amountOutPrevious, false);
          res = out + this.amountInPrevious;
          gas = gasSpent;
        }
      } else {
        const { out, gasSpent } = this.pool.calcOutByIn(this.amountOutPrevious + amountIn, false);
        res = out - this.amountInPrevious;
        gas = gasSpent;
      }
    } else {
      if (this.direction) {
        const { out, gasSpent } = this.pool.calcOutByIn(this.amountInPrevious + amountIn, true);
        res = out - this.amountOutPrevious;
        gas = gasSpent;
      } else {
        if (amountIn < this.amountInPrevious) {
          const { inp, gasSpent } = this.pool.calcInByOut(this.amountInPrevious - amountIn, false);
          res = this.amountOutPrevious - inp;
          gas = gasSpent;
        } else {
          const { out, gasSpent } = this.pool.calcOutByIn(amountIn - this.amountInPrevious, true);
          res = out + this.amountOutPrevious;
          gas = gasSpent;
        }
      }
    }
    return { out: res, gasSpent: gas - this.spentGas };
  }
  calcInput(v, amountOut) {
    let res, gas;
    if (v === this.vert1) {
      if (!this.direction) {
        if (amountOut < this.amountOutPrevious) {
          const { out, gasSpent } = this.pool.calcOutByIn(this.amountOutPrevious - amountOut, false);
          res = this.amountInPrevious - out;
          gas = gasSpent;
        } else {
          const { inp, gasSpent } = this.pool.calcInByOut(amountOut - this.amountOutPrevious, true);
          res = inp + this.amountInPrevious;
          gas = gasSpent;
        }
      } else {
        const { inp, gasSpent } = this.pool.calcInByOut(this.amountOutPrevious + amountOut, true);
        res = inp - this.amountInPrevious;
        gas = gasSpent;
      }
    } else {
      if (!this.direction) {
        const { inp, gasSpent } = this.pool.calcInByOut(this.amountInPrevious + amountOut, false);
        res = inp - this.amountOutPrevious;
        gas = gasSpent;
      } else {
        if (amountOut < this.amountInPrevious) {
          const { out, gasSpent } = this.pool.calcOutByIn(this.amountInPrevious - amountOut, true);
          res = this.amountOutPrevious - out;
          gas = gasSpent;
        } else {
          const { inp, gasSpent } = this.pool.calcInByOut(amountOut - this.amountInPrevious, false);
          res = inp + this.amountOutPrevious;
          gas = gasSpent;
        }
      }
    }
    return { inp: res, gasSpent: gas - this.spentGas };
  }
  checkMinimalLiquidityExceededAfterSwap(from, amountOut) {
    if (from === this.vert0) {
      const r1 = parseInt(this.pool.reserve1.toString());
      if (this.direction) {
        return r1 - amountOut - this.amountOutPrevious < this.pool.minLiquidity;
      } else {
        return r1 - amountOut + this.amountOutPrevious < this.pool.minLiquidity;
      }
    } else {
      const r0 = parseInt(this.pool.reserve0.toString());
      if (this.direction) {
        return r0 - amountOut + this.amountInPrevious < this.pool.minLiquidity;
      } else {
        return r0 - amountOut - this.amountInPrevious < this.pool.minLiquidity;
      }
    }
  }
  testApply(from, amountIn, amountOut) {
    console.assert(this.amountInPrevious * this.amountOutPrevious >= 0);
    const inPrev = this.direction ? this.amountInPrevious : -this.amountInPrevious;
    const outPrev = this.direction ? this.amountOutPrevious : -this.amountOutPrevious;
    const to = from.getNeibour(this);
    let directionNew, amountInNew = 0, amountOutNew = 0;
    if (to) {
      const inInc = from === this.vert0 ? amountIn : -amountOut;
      const outInc = from === this.vert0 ? amountOut : -amountIn;
      const inNew = inPrev + inInc;
      const outNew = outPrev + outInc;
      if (inNew * outNew < 0)
        console.log("333");
      console.assert(inNew * outNew >= 0);
      if (inNew >= 0) {
        directionNew = true;
        amountInNew = inNew;
        amountOutNew = outNew;
      } else {
        directionNew = false;
        amountInNew = -inNew;
        amountOutNew = -outNew;
      }
    } else
      console.error("Error 221");
    if (directionNew) {
      const calc = this.pool.calcOutByIn(amountInNew, true).out;
      const res = closeValues(amountOutNew, calc, 1e-6);
      if (!res)
        console.log("Err 225-1 !!", amountOutNew, calc, Math.abs(calc / amountOutNew - 1));
      return res;
    } else {
      const calc = this.pool.calcOutByIn(amountOutNew, false).out;
      const res = closeValues(amountInNew, calc, 1e-6);
      if (!res)
        console.log("Err 225-2!!", amountInNew, calc, Math.abs(calc / amountInNew - 1));
      return res;
    }
  }
  applySwap(from) {
    console.assert(this.amountInPrevious * this.amountOutPrevious >= 0);
    const inPrev = this.direction ? this.amountInPrevious : -this.amountInPrevious;
    const outPrev = this.direction ? this.amountOutPrevious : -this.amountOutPrevious;
    const to = from.getNeibour(this);
    if (to) {
      const inInc = from === this.vert0 ? from.bestIncome : -to.bestIncome;
      const outInc = from === this.vert0 ? to.bestIncome : -from.bestIncome;
      const inNew = inPrev + inInc;
      const outNew = outPrev + outInc;
      console.assert(inNew * outNew >= 0);
      if (inNew >= 0) {
        this.direction = true;
        this.amountInPrevious = inNew;
        this.amountOutPrevious = outNew;
      } else {
        this.direction = false;
        this.amountInPrevious = -inNew;
        this.amountOutPrevious = -outNew;
      }
    } else
      console.error("Error 221");
    this.spentGas = this.spentGasNew;
    ASSERT(() => {
      return this.direction ? closeValues(this.amountOutPrevious, this.pool.calcOutByIn(this.amountInPrevious, this.direction).out, 1e-6) : closeValues(this.amountInPrevious, this.pool.calcOutByIn(this.amountOutPrevious, this.direction).out, 1e-6);
    }, `Error 225`);
  }
}
class Vertice {
  token;
  edges;
  price;
  gasPrice;
  bestIncome;
  gasSpent;
  bestTotal;
  bestSource;
  checkLine;
  constructor(t) {
    this.token = t;
    this.edges = [];
    this.price = 0;
    this.gasPrice = 0;
    this.bestIncome = 0;
    this.gasSpent = 0;
    this.bestTotal = 0;
    this.bestSource = void 0;
    this.checkLine = -1;
  }
  cleanTmpData() {
    this.bestIncome = 0;
    this.gasSpent = 0;
    this.bestTotal = 0;
    this.bestSource = void 0;
    this.checkLine = -1;
  }
  getNeibour(e) {
    if (!e)
      return;
    return e.vert0 === this ? e.vert1 : e.vert0;
  }
  getOutputEdges() {
    return this.edges.filter((e) => {
      if (!e.canBeUsed)
        return false;
      if (e.amountInPrevious === 0)
        return false;
      if (e.direction !== (e.vert0 === this))
        return false;
      return true;
    });
  }
  getInputEdges() {
    return this.edges.filter((e) => {
      if (!e.canBeUsed)
        return false;
      if (e.amountInPrevious === 0)
        return false;
      if (e.direction === (e.vert0 === this))
        return false;
      return true;
    });
  }
}
class Graph {
  vertices;
  edges;
  tokens;
  constructor(pools, baseToken, gasPrice) {
    this.vertices = [];
    this.edges = [];
    this.tokens = /* @__PURE__ */ new Map();
    pools.forEach((p) => {
      const v0 = this.getOrCreateVertice(p.token0);
      const v1 = this.getOrCreateVertice(p.token1);
      const edge = new Edge(p, v0, v1);
      v0.edges.push(edge);
      v1.edges.push(edge);
      this.edges.push(edge);
    });
    const baseVert = this.tokens.get(baseToken.address);
    if (baseVert) {
      this.setPricesStable(baseVert, 1, gasPrice);
    }
  }
  cleanTmpData() {
    this.edges.forEach((e) => e.cleanTmpData());
    this.vertices.forEach((v) => v.cleanTmpData());
  }
  setPricesStable(from, price, gasPrice) {
    this.vertices.forEach((v) => v.price = 0);
    from.price = price;
    from.gasPrice = gasPrice;
    const edgeValues = /* @__PURE__ */ new Map();
    const value = (e) => edgeValues.get(e);
    function addVertice(v) {
      const newEdges = v.edges.filter((e) => v.getNeibour(e)?.price == 0);
      newEdges.forEach((e) => edgeValues.set(e, v.price * parseInt(e.reserve(v).toString())));
      newEdges.sort((e1, e2) => value(e1) - value(e2));
      const res = [];
      while (nextEdges.length && newEdges.length) {
        if (value(nextEdges[0]) < value(newEdges[0]))
          res.push(nextEdges.shift());
        else
          res.push(newEdges.shift());
      }
      nextEdges = [...res, ...nextEdges, ...newEdges];
    }
    let nextEdges = [];
    addVertice(from);
    while (nextEdges.length > 0) {
      const bestEdge = nextEdges.pop();
      const [vFrom, vTo] = bestEdge.vert1.price !== 0 ? [bestEdge.vert1, bestEdge.vert0] : [bestEdge.vert0, bestEdge.vert1];
      if (vTo.price !== 0)
        continue;
      let p = bestEdge.pool.calcCurrentPriceWithoutFee(vFrom === bestEdge.vert1);
      vTo.price = vFrom.price * p;
      vTo.gasPrice = vFrom.gasPrice / p;
      addVertice(vTo);
    }
  }
  setPrices(from, price, gasPrice) {
    if (from.price !== 0)
      return;
    from.price = price;
    from.gasPrice = gasPrice;
    const edges = from.edges.map((e) => [e, parseInt(e.reserve(from).toString())]).sort(([_1, r1], [_2, r2]) => r2 - r1);
    edges.forEach(([e, _]) => {
      const v = e.vert0 === from ? e.vert1 : e.vert0;
      if (v.price !== 0)
        return;
      const p = e.pool.calcCurrentPriceWithoutFee(from === e.vert1);
      this.setPrices(v, price * p, gasPrice / p);
    });
  }
  getOrCreateVertice(token) {
    let vert = this.tokens.get(token.address);
    if (vert)
      return vert;
    vert = new Vertice(token);
    this.vertices.push(vert);
    this.tokens.set(token.address, vert);
    return vert;
  }
  findBestPathExactIn(from, to, amountIn, _gasPrice) {
    const start = this.tokens.get(from.address);
    const finish = this.tokens.get(to.address);
    if (!start || !finish)
      return;
    const gasPrice = _gasPrice !== void 0 ? _gasPrice : finish.gasPrice;
    this.edges.forEach((e) => {
      e.bestEdgeIncome = 0;
      e.spentGasNew = 0;
    });
    this.vertices.forEach((v) => {
      v.bestIncome = 0;
      v.gasSpent = 0;
      v.bestTotal = 0;
      v.bestSource = void 0;
      v.checkLine = -1;
    });
    start.bestIncome = amountIn;
    start.bestTotal = amountIn;
    const processedVert = /* @__PURE__ */ new Set();
    const nextVertList = [start];
    let debug_info = ``;
    let checkLine = 0;
    for (; ; ) {
      let closestVert;
      let closestTotal;
      let closestPosition = 0;
      nextVertList.forEach((v, i) => {
        if (closestTotal === void 0 || v.bestTotal > closestTotal) {
          closestTotal = v.bestTotal;
          closestVert = v;
          closestPosition = i;
        }
      });
      if (!closestVert)
        return;
      closestVert.checkLine = checkLine++;
      if (closestVert === finish) {
        const bestPath = [];
        for (let v = finish; v?.bestSource; v = v.getNeibour(v.bestSource)) {
          bestPath.unshift(v.bestSource);
        }
        DEBUG(() => console.log(debug_info));
        return {
          path: bestPath,
          output: finish.bestIncome,
          gasSpent: finish.gasSpent,
          totalOutput: finish.bestTotal
        };
      }
      nextVertList.splice(closestPosition, 1);
      closestVert.edges.forEach((e) => {
        const v2 = closestVert === e.vert0 ? e.vert1 : e.vert0;
        if (processedVert.has(v2))
          return;
        let newIncome;
        let gas;
        try {
          const { out, gasSpent } = e.calcOutput(closestVert, closestVert.bestIncome);
          if (!isFinite(out) || !isFinite(gasSpent))
            return;
          newIncome = out;
          gas = gasSpent;
        } catch (e2) {
          return;
        }
        if (e.checkMinimalLiquidityExceededAfterSwap(closestVert, newIncome)) {
          e.bestEdgeIncome = -1;
          return;
        }
        const newGasSpent = closestVert.gasSpent + gas;
        const price = v2.price / finish.price;
        const newTotal = newIncome * price - newGasSpent * gasPrice;
        console.assert(e.bestEdgeIncome === 0, "Error 373");
        e.bestEdgeIncome = newIncome * price;
        e.spentGasNew = e.spentGas + gas;
        if (!v2.bestSource)
          nextVertList.push(v2);
        if (!v2.bestSource || newTotal > v2.bestTotal) {
          DEBUG(() => {
            const st = closestVert?.token == from ? "*" : "";
            const fn = v2?.token == to ? "*" : "";
            debug_info += `${st}${closestVert?.token.name}->${v2.token.name}${fn} ${v2.bestIncome} -> ${newIncome}
`;
          });
          v2.bestIncome = newIncome;
          v2.gasSpent = newGasSpent;
          v2.bestTotal = newTotal;
          v2.bestSource = e;
        }
      });
      processedVert.add(closestVert);
    }
  }
  findBestPathExactOut(from, to, amountOut, _gasPrice) {
    const start = this.tokens.get(to.address);
    const finish = this.tokens.get(from.address);
    if (!start || !finish)
      return;
    const gasPrice = _gasPrice !== void 0 ? _gasPrice : finish.gasPrice;
    this.edges.forEach((e) => {
      e.bestEdgeIncome = 0;
      e.spentGasNew = 0;
    });
    this.vertices.forEach((v) => {
      v.bestIncome = 0;
      v.gasSpent = 0;
      v.bestTotal = 0;
      v.bestSource = void 0;
      v.checkLine = -1;
    });
    start.bestIncome = amountOut;
    start.bestTotal = amountOut;
    const processedVert = /* @__PURE__ */ new Set();
    const nextVertList = [start];
    let debug_info = "";
    let checkLine = 0;
    for (; ; ) {
      let closestVert;
      let closestTotal;
      let closestPosition = 0;
      nextVertList.forEach((v, i) => {
        if (closestTotal === void 0 || v.bestTotal < closestTotal) {
          closestTotal = v.bestTotal;
          closestVert = v;
          closestPosition = i;
        }
      });
      if (!closestVert)
        return;
      closestVert.checkLine = checkLine++;
      if (closestVert === finish) {
        const bestPath = [];
        for (let v = finish; v?.bestSource; v = v.getNeibour(v.bestSource)) {
          bestPath.push(v.bestSource);
        }
        DEBUG(() => console.log(debug_info));
        return {
          path: bestPath,
          input: finish.bestIncome,
          gasSpent: finish.gasSpent,
          totalInput: finish.bestTotal
        };
      }
      nextVertList.splice(closestPosition, 1);
      closestVert.edges.forEach((e) => {
        const v2 = closestVert === e.vert0 ? e.vert1 : e.vert0;
        if (processedVert.has(v2))
          return;
        let newIncome, gas;
        try {
          const { inp, gasSpent } = e.calcInput(closestVert, closestVert.bestIncome);
          if (!isFinite(inp) || !isFinite(gasSpent))
            return;
          if (inp < 0)
            return;
          newIncome = inp;
          gas = gasSpent;
        } catch (e2) {
          return;
        }
        const newGasSpent = closestVert.gasSpent + gas;
        const price = v2.price / finish.price;
        const newTotal = newIncome * price + newGasSpent * gasPrice;
        console.assert(e.bestEdgeIncome === 0, "Error 373");
        e.bestEdgeIncome = newIncome * price;
        e.spentGasNew = e.spentGas + gas;
        if (!v2.bestSource)
          nextVertList.push(v2);
        if (!v2.bestSource || newTotal < v2.bestTotal) {
          DEBUG(() => {
            const st = v2?.token == from ? "*" : "";
            const fn = closestVert?.token == to ? "*" : "";
            debug_info += `${st}${closestVert?.token.name}<-${v2.token.name}${fn} ${v2.bestIncome} -> ${newIncome}
`;
          });
          v2.bestIncome = newIncome;
          v2.gasSpent = newGasSpent;
          v2.bestTotal = newTotal;
          v2.bestSource = e;
        }
      });
      processedVert.add(closestVert);
    }
  }
  addPath(from, to, path) {
    let _from = from;
    path.forEach((e) => {
      if (_from) {
        e.applySwap(_from);
        _from = _from.getNeibour(e);
      } else {
        console.error("Unexpected 315");
      }
    });
    ASSERT(() => {
      return this.vertices.every((v) => {
        let total = 0;
        let totalModule = 0;
        v.edges.forEach((e) => {
          if (e.vert0 === v) {
            if (e.direction) {
              total -= e.amountInPrevious;
            } else {
              total += e.amountInPrevious;
            }
            totalModule += e.amountInPrevious;
          } else {
            if (e.direction) {
              total += e.amountOutPrevious;
            } else {
              total -= e.amountOutPrevious;
            }
            totalModule += e.amountOutPrevious;
          }
        });
        if (v === from)
          return total <= 0;
        if (v === to)
          return total >= 0;
        if (totalModule === 0)
          return total === 0;
        return Math.abs(total / totalModule) < 1e10;
      });
    }, "Error 290");
  }
  getPrimaryPriceForPath(from, path) {
    let p = 1;
    let prevToken = from;
    path.forEach((edge) => {
      const direction = edge.vert0 === prevToken;
      const edgePrice = edge.pool.calcCurrentPriceWithoutFee(direction);
      p *= edgePrice;
      prevToken = prevToken.getNeibour(edge);
    });
    return p;
  }
  findBestRouteExactIn(from, to, amountIn, mode) {
    let routeValues = [0];
    if (Array.isArray(mode)) {
      const sum = mode.reduce((a, b) => a + b, 0);
      routeValues = mode.map((e) => e / sum);
    } else {
      for (let i = 0; i < mode; ++i)
        routeValues.push(1 / mode);
    }
    this.edges.forEach((e) => {
      e.amountInPrevious = 0;
      e.amountOutPrevious = 0;
      e.direction = true;
    });
    let output = 0;
    let gasSpentInit = 0;
    let totalrouted = 0;
    let primaryPrice;
    let step;
    for (step = 0; step < routeValues.length; ++step) {
      const p = this.findBestPathExactIn(from, to, amountIn * routeValues[step]);
      if (!p) {
        break;
      } else {
        output += p.output;
        gasSpentInit += p.gasSpent;
        this.addPath(this.tokens.get(from.address), this.tokens.get(to.address), p.path);
        totalrouted += routeValues[step];
        if (step === 0) {
          primaryPrice = this.getPrimaryPriceForPath(this.tokens.get(from.address), p.path);
        }
      }
    }
    if (step == 0)
      return {
        status: "NoWay" /* NoWay */,
        fromToken: from,
        toToken: to,
        amountIn: 0,
        amountInBN: BigNumber.from(0),
        amountOut: 0,
        amountOutBN: BigNumber.from(0),
        legs: [],
        gasSpent: 0,
        totalAmountOut: 0,
        totalAmountOutBN: BigNumber.from(0)
      };
    let status;
    if (step < routeValues.length)
      status = "Partial" /* Partial */;
    else
      status = "Success" /* Success */;
    const fromVert = this.tokens.get(from.address);
    const toVert = this.tokens.get(to.address);
    const { legs, gasSpent, topologyWasChanged } = this.getRouteLegs(fromVert, toVert);
    console.assert(gasSpent <= gasSpentInit, "Internal Error 491");
    if (topologyWasChanged) {
      output = this.calcLegsAmountOut(legs, amountIn);
    }
    let swapPrice, priceImpact;
    try {
      swapPrice = output / amountIn;
      priceImpact = primaryPrice !== void 0 ? 1 - swapPrice / primaryPrice : void 0;
    } catch (e) {
    }
    return {
      status,
      fromToken: from,
      toToken: to,
      primaryPrice,
      swapPrice,
      priceImpact,
      amountIn: amountIn * totalrouted,
      amountInBN: getBigNumber(amountIn * totalrouted),
      amountOut: output,
      amountOutBN: getBigNumber(output),
      legs,
      gasSpent,
      totalAmountOut: output - gasSpent * toVert.gasPrice,
      totalAmountOutBN: getBigNumber(output - gasSpent * toVert.gasPrice)
    };
  }
  findBestRouteExactOut(from, to, amountOut, mode) {
    let routeValues = Array();
    if (Array.isArray(mode)) {
      const sum = mode.reduce((a, b) => a + b, 0);
      routeValues = mode.map((e) => e / sum);
    } else {
      for (let i = 0; i < mode; ++i)
        routeValues.push(1 / mode);
    }
    this.edges.forEach((e) => {
      e.amountInPrevious = 0;
      e.amountOutPrevious = 0;
      e.direction = true;
    });
    let input = 0;
    let gasSpentInit = 0;
    let totalrouted = 0;
    let primaryPrice;
    let step;
    for (step = 0; step < routeValues.length; ++step) {
      const p = this.findBestPathExactOut(from, to, amountOut * routeValues[step]);
      if (!p) {
        break;
      } else {
        input += p.input;
        gasSpentInit += p.gasSpent;
        this.addPath(this.tokens.get(from.address), this.tokens.get(to.address), p.path);
        totalrouted += routeValues[step];
        if (step === 0) {
          primaryPrice = this.getPrimaryPriceForPath(this.tokens.get(from.address), p.path);
        }
      }
    }
    if (step == 0)
      return {
        status: "NoWay" /* NoWay */,
        fromToken: from,
        toToken: to,
        amountIn: 0,
        amountInBN: BigNumber.from(0),
        amountOut: 0,
        amountOutBN: BigNumber.from(0),
        legs: [],
        gasSpent: 0,
        totalAmountOut: 0,
        totalAmountOutBN: BigNumber.from(0)
      };
    let status;
    if (step < routeValues.length)
      status = "Partial" /* Partial */;
    else
      status = "Success" /* Success */;
    const fromVert = this.tokens.get(from.address);
    const toVert = this.tokens.get(to.address);
    const { legs, gasSpent, topologyWasChanged } = this.getRouteLegs(fromVert, toVert);
    console.assert(gasSpent <= gasSpentInit, "Internal Error 491");
    if (topologyWasChanged) {
      input = this.calcLegsAmountIn(legs, amountOut);
    }
    let swapPrice, priceImpact;
    try {
      swapPrice = amountOut / input;
      priceImpact = primaryPrice !== void 0 ? 1 - swapPrice / primaryPrice : void 0;
    } catch (e) {
    }
    return {
      status,
      fromToken: from,
      toToken: to,
      primaryPrice,
      swapPrice,
      priceImpact,
      amountIn: input,
      amountInBN: getBigNumber(input),
      amountOut: amountOut * totalrouted,
      amountOutBN: getBigNumber(amountOut * totalrouted),
      legs,
      gasSpent,
      totalAmountOut: amountOut - gasSpent * toVert.gasPrice,
      totalAmountOutBN: getBigNumber(amountOut - gasSpent * toVert.gasPrice)
    };
  }
  getRouteLegs(from, to) {
    const { vertices, topologyWasChanged } = this.cleanTopology(from, to);
    const legs = [];
    let gasSpent = 0;
    vertices.forEach((n) => {
      const outEdges = n.getOutputEdges().map((e) => {
        const from2 = this.edgeFrom(e);
        return from2 ? [e, from2.vert, from2.amount] : [e];
      });
      let outAmount = outEdges.reduce((a, b) => a + b[2], 0);
      if (outAmount <= 0)
        return;
      const total = outAmount;
      outEdges.forEach((e, i) => {
        const p = e[2];
        const quantity = i + 1 === outEdges.length ? 1 : p / outAmount;
        const edge = e[0];
        legs.push({
          poolAddress: edge.pool.address,
          poolFee: edge.pool.fee,
          tokenFrom: n.token,
          tokenTo: n.getNeibour(edge).token,
          assumedAmountIn: edge.direction ? edge.amountInPrevious : edge.amountOutPrevious,
          assumedAmountOut: edge.direction ? edge.amountOutPrevious : edge.amountInPrevious,
          swapPortion: quantity,
          absolutePortion: p / total
        });
        gasSpent += e[0].pool.swapGasCost;
        outAmount -= p;
      });
      console.assert(outAmount / total < 1e-12, "Error 281");
    });
    return { legs, gasSpent, topologyWasChanged };
  }
  edgeFrom(e) {
    if (e.amountInPrevious === 0)
      return void 0;
    return e.direction ? { vert: e.vert0, amount: e.amountInPrevious } : { vert: e.vert1, amount: e.amountOutPrevious };
  }
  calcLegsAmountOut(legs, amountIn) {
    const amounts = /* @__PURE__ */ new Map();
    amounts.set(legs[0].tokenFrom.address, amountIn);
    legs.forEach((l) => {
      const vert = this.tokens.get(l.tokenFrom.address);
      console.assert(vert !== void 0, "Internal Error 570");
      const edge = vert.edges.find((e) => e.pool.address === l.poolAddress);
      console.assert(edge !== void 0, "Internel Error 569");
      const pool = edge.pool;
      const direction = vert === edge.vert0;
      const inputTotal = amounts.get(l.tokenFrom.address);
      console.assert(inputTotal !== void 0, "Internal Error 564");
      const input = inputTotal * l.swapPortion;
      amounts.set(l.tokenFrom.address, inputTotal - input);
      const output = pool.calcOutByIn(input, direction).out;
      const vertNext = vert.getNeibour(edge);
      const prevAmount = amounts.get(vertNext.token.address);
      amounts.set(vertNext.token.address, (prevAmount || 0) + output);
    });
    return amounts.get(legs[legs.length - 1].tokenTo.address) || 0;
  }
  calcLegsAmountIn(legs, amountOut) {
    const totalOutputAssumed = /* @__PURE__ */ new Map();
    legs.forEach((l) => {
      const prevValue = totalOutputAssumed.get(l.tokenFrom.address) || 0;
      totalOutputAssumed.set(l.tokenFrom.address, prevValue + l.assumedAmountOut);
    });
    const amounts = /* @__PURE__ */ new Map();
    amounts.set(legs[legs.length - 1].tokenTo.address, amountOut);
    for (let i = legs.length - 1; i >= 0; --i) {
      const l = legs[i];
      const vert = this.tokens.get(l.tokenTo.address);
      console.assert(vert !== void 0, "Internal Error 884");
      const edge = vert.edges.find((e) => e.pool.address === l.poolAddress);
      console.assert(edge !== void 0, "Internel Error 888");
      const pool = edge.pool;
      const direction = vert === edge.vert1;
      const outputTotal = amounts.get(l.tokenTo.address);
      console.assert(outputTotal !== void 0, "Internal Error 893");
      const totalAssumed = totalOutputAssumed.get(l.tokenFrom.address);
      console.assert(totalAssumed !== void 0, "Internal Error 903");
      const output = outputTotal * l.assumedAmountOut / totalAssumed;
      const input = pool.calcInByOut(output, direction).inp;
      const vertNext = vert.getNeibour(edge);
      const prevAmount = amounts.get(vertNext.token.address);
      amounts.set(vertNext.token.address, (prevAmount || 0) + input);
    }
    return amounts.get(legs[0].tokenFrom.address) || 0;
  }
  cleanTopology(from, to) {
    let topologyWasChanged = false;
    let result = this.topologySort(from, to);
    if (result.status !== 2) {
      topologyWasChanged = true;
      console.assert(result.status === 0, "Internal Error 554");
      while (result.status === 0) {
        this.removeWeakestEdge(result.vertices);
        result = this.topologySort(from, to);
      }
      if (result.status === 3) {
        this.removeDeadEnds(result.vertices);
        result = this.topologySort(from, to);
      }
      console.assert(result.status === 2, "Internal Error 563");
      if (result.status !== 2)
        return { vertices: [], topologyWasChanged };
    }
    return { vertices: result.vertices, topologyWasChanged };
  }
  removeDeadEnds(verts) {
    verts.forEach((v) => {
      v.getInputEdges().forEach((e) => {
        e.canBeUsed = false;
      });
    });
  }
  removeWeakestEdge(verts) {
    let minVert;
    let minVertNext;
    let minOutput = Number.MAX_VALUE;
    verts.forEach((v1, i) => {
      const v2 = i === 0 ? verts[verts.length - 1] : verts[i - 1];
      let out = 0;
      v1.getOutputEdges().forEach((e) => {
        if (v1.getNeibour(e) !== v2)
          return;
        out += e.direction ? e.amountOutPrevious : e.amountInPrevious;
      });
      if (out < minOutput) {
        minVert = v1;
        minVertNext = v2;
        minOutput = out;
      }
    });
    minVert.getOutputEdges().forEach((e) => {
      if (minVert.getNeibour(e) !== minVertNext)
        return;
      e.canBeUsed = false;
    });
  }
  topologySort(from, to) {
    const vertState = /* @__PURE__ */ new Map();
    const vertsFinished = [];
    const foundCycle = [];
    const foundDeadEndVerts = [];
    function topSortRecursive(current) {
      const state = vertState.get(current);
      if (state === 2 || state === 3)
        return state;
      if (state === 1) {
        console.assert(foundCycle.length == 0, "Internal Error 566");
        foundCycle.push(current);
        return 1;
      }
      vertState.set(current, 1);
      let successors2Exist = false;
      const outEdges = current.getOutputEdges();
      for (let i = 0; i < outEdges.length; ++i) {
        const e = outEdges[i];
        const res2 = topSortRecursive(current.getNeibour(e));
        if (res2 === 0)
          return 0;
        if (res2 === 1) {
          if (foundCycle[0] === current)
            return 0;
          else {
            foundCycle.push(current);
            return 1;
          }
        }
        if (res2 === 2)
          successors2Exist = true;
      }
      if (successors2Exist) {
        console.assert(current !== to, "Internal Error 589");
        vertsFinished.push(current);
        vertState.set(current, 2);
        return 2;
      } else {
        if (current !== to) {
          foundDeadEndVerts.push(current);
          vertState.set(current, 3);
          return 3;
        }
        vertsFinished.push(current);
        vertState.set(current, 2);
        return 2;
      }
    }
    const res = topSortRecursive(from);
    if (res === 0)
      return { status: 0, vertices: foundCycle };
    if (foundDeadEndVerts.length)
      return { status: 3, vertices: foundDeadEndVerts };
    ASSERT(() => {
      if (vertsFinished[0] !== to)
        return false;
      if (vertsFinished[vertsFinished.length - 1] !== from)
        return false;
      return true;
    }, "Internal Error 614");
    if (res === 2)
      return { status: 2, vertices: vertsFinished.reverse() };
    console.assert(true, "Internal Error 612");
    return { status: 1, vertices: [] };
  }
}

function calcPriceImactWithoutFee(route) {
  if (route.primaryPrice === void 0 || route.swapPrice === void 0) {
    return void 0;
  } else {
    let oneMinusCombinedFee = 1;
    route.legs.forEach((l) => oneMinusCombinedFee *= 1 - l.poolFee);
    return Math.max(0, 1 - route.swapPrice / route.primaryPrice / oneMinusCombinedFee);
  }
}
const defaultFlowNumber = 12;
const maxFlowNumber = 100;
function calcBestFlowNumber(bestSingleRoute, amountIn, gasPriceIn) {
  const priceImpact = calcPriceImactWithoutFee(bestSingleRoute);
  if (!priceImpact)
    return defaultFlowNumber;
  const bestFlowAmount = Math.sqrt(bestSingleRoute.gasSpent * (gasPriceIn || 0) * amountIn / priceImpact);
  const bestFlowNumber = Math.round(amountIn / bestFlowAmount);
  if (!isFinite(bestFlowNumber))
    return maxFlowNumber;
  const realFlowNumber = Math.max(1, Math.min(bestFlowNumber, maxFlowNumber));
  return realFlowNumber;
}
function getBetterRouteExactIn(route1, route2) {
  if (route1.status == RouteStatus.NoWay)
    return route2;
  if (route2.status == RouteStatus.NoWay)
    return route1;
  if (route1.status == RouteStatus.Partial && route2.status == RouteStatus.Success)
    return route2;
  if (route2.status == RouteStatus.Partial && route1.status == RouteStatus.Success)
    return route1;
  return route1.totalAmountOut > route2.totalAmountOut ? route1 : route2;
}
function findMultiRouteExactIn(from, to, amountIn, pools, baseToken, gasPrice, flows) {
  if (amountIn instanceof BigNumber) {
    amountIn = parseInt(amountIn.toString());
  }
  const g = new Graph(pools, baseToken, gasPrice);
  const fromV = g.tokens.get(from.address);
  if (fromV?.price === 0) {
    g.setPricesStable(fromV, 1, 0);
  }
  if (flows !== void 0)
    return g.findBestRouteExactIn(from, to, amountIn, flows);
  const outSingle = g.findBestRouteExactIn(from, to, amountIn, 1);
  g.cleanTmpData();
  const bestFlowNumber = calcBestFlowNumber(outSingle, amountIn, fromV?.gasPrice);
  if (bestFlowNumber === 1)
    return outSingle;
  const outMulti = g.findBestRouteExactIn(from, to, amountIn, bestFlowNumber);
  return getBetterRouteExactIn(outSingle, outMulti);
}
function getBetterRouteExactOut(route1, route2, gasPrice) {
  if (route1.status == RouteStatus.NoWay)
    return route2;
  if (route2.status == RouteStatus.NoWay)
    return route1;
  if (route1.status == RouteStatus.Partial && route2.status == RouteStatus.Success)
    return route2;
  if (route2.status == RouteStatus.Partial && route1.status == RouteStatus.Success)
    return route1;
  const totalAmountIn1 = route1.amountIn + route1.gasSpent * gasPrice;
  const totalAmountIn2 = route2.amountIn + route2.gasSpent * gasPrice;
  return totalAmountIn1 < totalAmountIn2 ? route1 : route2;
}
function findMultiRouteExactOut(from, to, amountOut, pools, baseToken, gasPrice, flows) {
  if (amountOut instanceof BigNumber) {
    amountOut = parseInt(amountOut.toString());
  }
  const g = new Graph(pools, baseToken, gasPrice);
  const fromV = g.tokens.get(from.address);
  if (fromV?.price === 0) {
    g.setPricesStable(fromV, 1, 0);
  }
  if (flows !== void 0)
    return g.findBestRouteExactOut(from, to, amountOut, flows);
  const inSingle = g.findBestRouteExactOut(from, to, amountOut, 1);
  g.cleanTmpData();
  const bestFlowNumber = calcBestFlowNumber(inSingle, inSingle.amountIn, fromV?.gasPrice);
  if (bestFlowNumber === 1)
    return inSingle;
  const inMulti = g.findBestRouteExactOut(from, to, amountOut, bestFlowNumber);
  return getBetterRouteExactOut(inSingle, inMulti, gasPrice);
}
function findSingleRouteExactIn(from, to, amountIn, pools, baseToken, gasPrice) {
  const g = new Graph(pools, baseToken, gasPrice);
  const fromV = g.tokens.get(from.address);
  if (fromV?.price === 0) {
    g.setPricesStable(fromV, 1, 0);
  }
  if (amountIn instanceof BigNumber) {
    amountIn = parseInt(amountIn.toString());
  }
  const out = g.findBestRouteExactIn(from, to, amountIn, 1);
  return out;
}
function findSingleRouteExactOut(from, to, amountOut, pools, baseToken, gasPrice) {
  const g = new Graph(pools, baseToken, gasPrice);
  const fromV = g.tokens.get(from.address);
  if (fromV?.price === 0) {
    g.setPricesStable(fromV, 1, 0);
  }
  if (amountOut instanceof BigNumber) {
    amountOut = parseInt(amountOut.toString());
  }
  const out = g.findBestRouteExactOut(from, to, amountOut, 1);
  return out;
}
function calcTokenPrices(pools, baseToken) {
  const g = new Graph(pools, baseToken, 0);
  const res = /* @__PURE__ */ new Map();
  g.vertices.forEach((v) => res.set(v.token, v.price));
  return res;
}

var PoolType = /* @__PURE__ */ ((PoolType2) => {
  PoolType2["ConstantProduct"] = "ConstantProduct";
  PoolType2["Weighted"] = "Weighted";
  PoolType2["Hybrid"] = "Hybrid";
  PoolType2["ConcentratedLiquidity"] = "ConcentratedLiquidity";
  return PoolType2;
})(PoolType || {});
class Pool {
  address;
  token0;
  token1;
  type;
  reserve0;
  reserve1;
  fee;
  minLiquidity;
  swapGasCost;
  constructor(_info) {
    const info = {
      minLiquidity: 1e3,
      swapGasCost: 4e4,
      ..._info
    };
    this.address = info.address;
    this.token0 = info.token0;
    this.token1 = info.token1;
    this.type = info.type;
    this.reserve0 = info.reserve0;
    this.reserve1 = info.reserve1;
    this.fee = info.fee;
    this.minLiquidity = info.minLiquidity;
    this.swapGasCost = info.swapGasCost;
  }
}
class RConstantProductPool extends Pool {
  constructor(info) {
    super({
      type: "ConstantProduct" /* ConstantProduct */,
      ...info
    });
  }
}
class RHybridPool extends Pool {
  A;
  constructor(info) {
    super({
      type: "Hybrid" /* Hybrid */,
      ...info
    });
    this.A = info.A;
  }
}
class RWeightedPool extends Pool {
  weight0;
  weight1;
  constructor(info) {
    super({
      type: "Weighted" /* Weighted */,
      ...info
    });
    this.weight0 = info.weight0;
    this.weight1 = info.weight1;
  }
}
class RConcentratedLiquidityPool extends Pool {
  liquidity;
  sqrtPrice;
  nearestTick;
  ticks;
  constructor(info) {
    super({
      type: "ConcentratedLiquidity" /* ConcentratedLiquidity */,
      reserve0: BigNumber.from(0),
      reserve1: BigNumber.from(0),
      ...info
    });
    this.liquidity = info.liquidity;
    this.sqrtPrice = info.sqrtPrice;
    this.nearestTick = info.nearestTick;
    this.ticks = info.ticks;
  }
}

const A_PRECISION = 100;
const DCacheBN = /* @__PURE__ */ new Map();
function HybridComputeLiquidity(pool) {
  const res = DCacheBN.get(pool);
  if (res !== void 0)
    return res;
  const r0 = pool.reserve0;
  const r1 = pool.reserve1;
  if (r0.isZero() && r1.isZero()) {
    DCacheBN.set(pool, BigNumber.from(0));
    return BigNumber.from(0);
  }
  const s = r0.add(r1);
  const nA = BigNumber.from(pool.A * 2);
  let prevD;
  let D = s;
  for (let i = 0; i < 256; i++) {
    const dP = D.mul(D).div(r0).mul(D).div(r1).div(4);
    prevD = D;
    D = nA.mul(s).div(A_PRECISION).add(dP.mul(2)).mul(D).div(nA.div(A_PRECISION).sub(1).mul(D).add(dP.mul(3)));
    if (D.sub(prevD).abs().lte(1)) {
      break;
    }
  }
  DCacheBN.set(pool, D);
  return D;
}
function HybridgetY(pool, x) {
  const D = HybridComputeLiquidity(pool);
  const nA = pool.A * 2;
  let c = D.mul(D).div(x.mul(2)).mul(D).div(nA * 2 / A_PRECISION);
  let b = D.mul(A_PRECISION).div(nA).add(x);
  let yPrev;
  let y = D;
  for (let i = 0; i < 256; i++) {
    yPrev = y;
    y = y.mul(y).add(c).div(y.mul(2).add(b).sub(D));
    if (y.sub(yPrev).abs().lte(1)) {
      break;
    }
  }
  return y;
}
function calcOutByIn(pool, amountIn, direction = true) {
  const xBN = direction ? pool.reserve0 : pool.reserve1;
  const yBN = direction ? pool.reserve1 : pool.reserve0;
  switch (pool.type) {
    case PoolType.ConstantProduct: {
      const x = parseInt(xBN.toString());
      const y = parseInt(yBN.toString());
      return y * amountIn / (x / (1 - pool.fee) + amountIn);
    }
    case PoolType.Weighted: {
      const x = parseInt(xBN.toString());
      const y = parseInt(yBN.toString());
      const wPool = pool;
      const weightRatio = direction ? wPool.weight0 / wPool.weight1 : wPool.weight1 / wPool.weight0;
      const actualIn = amountIn * (1 - pool.fee);
      const out = y * (1 - Math.pow(x / (x + actualIn), weightRatio));
      return out;
    }
    case PoolType.Hybrid: {
      const xNewBN = xBN.add(getBigNumber(amountIn * (1 - pool.fee)));
      const yNewBN = HybridgetY(pool, xNewBN);
      const dy = parseInt(yBN.sub(yNewBN).toString());
      return dy;
    }
  }
  return -1;
}
class OutOfLiquidity extends Error {
}
function calcInByOut(pool, amountOut, direction) {
  let input = 0;
  const xBN = direction ? pool.reserve0 : pool.reserve1;
  const yBN = direction ? pool.reserve1 : pool.reserve0;
  switch (pool.type) {
    case PoolType.ConstantProduct: {
      const x = parseInt(xBN.toString());
      const y = parseInt(yBN.toString());
      input = x * amountOut / (1 - pool.fee) / (y - amountOut);
      break;
    }
    case PoolType.Weighted: {
      const x = parseInt(xBN.toString());
      const y = parseInt(yBN.toString());
      const wPool = pool;
      const weightRatio = direction ? wPool.weight0 / wPool.weight1 : wPool.weight1 / wPool.weight0;
      input = x * (1 - pool.fee) * (Math.pow(1 - amountOut / y, -weightRatio) - 1);
      break;
    }
    case PoolType.Hybrid: {
      let yNewBN = yBN.sub(getBigNumber(amountOut));
      if (yNewBN.lt(1))
        yNewBN = BigNumber.from(1);
      const xNewBN = HybridgetY(pool, yNewBN);
      input = Math.round(parseInt(xNewBN.sub(xBN).toString()) / (1 - pool.fee));
      break;
    }
    default:
      console.error("Unknown pool type");
  }
  if (input < 1)
    input = 1;
  return input;
}
function calcPrice(pool, amountIn, takeFeeIntoAccount = true) {
  const r0 = parseInt(pool.reserve0.toString());
  const r1 = parseInt(pool.reserve1.toString());
  const oneMinusFee = takeFeeIntoAccount ? 1 - pool.fee : 1;
  switch (pool.type) {
    case PoolType.ConstantProduct: {
      const x = r0 / oneMinusFee;
      return r1 * x / (x + amountIn) / (x + amountIn);
    }
    case PoolType.Weighted: {
      const wPool = pool;
      const weightRatio = wPool.weight0 / wPool.weight1;
      const x = r0 + amountIn * oneMinusFee;
      return r1 * weightRatio * oneMinusFee * Math.pow(r0 / x, weightRatio) / x;
    }
    case PoolType.Hybrid: {
      const hPool = pool;
      const D = parseInt(HybridComputeLiquidity(hPool).toString());
      const A = hPool.A / A_PRECISION;
      const x = r0 + amountIn;
      const b = 4 * A * x + D - 4 * A * D;
      const ac4 = D * D * D / x;
      const Ds = Math.sqrt(b * b + 4 * A * ac4);
      const res = (0.5 - (2 * b - ac4 / x) / Ds / 4) * oneMinusFee;
      return res;
    }
  }
  return 0;
}
function calcInputByPriceConstantMean(pool, price) {
  const r0 = parseInt(pool.reserve0.toString());
  const r1 = parseInt(pool.reserve1.toString());
  const weightRatio = pool.weight0 / pool.weight1;
  const t = r1 * price * weightRatio * (1 - pool.fee) * Math.pow(r0, weightRatio);
  return (Math.pow(t, 1 / (weightRatio + 1)) - r0) / (1 - pool.fee);
}
function calcInputByPrice(pool, priceEffective, hint = 1) {
  switch (pool.type) {
    case PoolType.ConstantProduct: {
      const r0 = parseInt(pool.reserve0.toString());
      const r1 = parseInt(pool.reserve1.toString());
      const x = r0 / (1 - pool.fee);
      const res = Math.sqrt(r1 * x * priceEffective) - x;
      return res;
    }
    case PoolType.Weighted: {
      const res = calcInputByPriceConstantMean(pool, priceEffective);
      return res;
    }
    case PoolType.Hybrid: {
      return revertPositive((x) => 1 / calcPrice(pool, x), priceEffective, hint);
    }
  }
  return 0;
}

export { ASSERT, CLRPool, CL_MAX_TICK, CL_MIN_TICK, ConstantProductRPool, DEBUG, DEBUG_MODE_ON, Edge, Graph, HybridComputeLiquidity, HybridRPool, HybridgetY, OutOfLiquidity, Pool, PoolType, RConcentratedLiquidityPool, RConstantProductPool, RHybridPool, RPool, RWeightedPool, RouteStatus, StableSwapRPool, TYPICAL_MINIMAL_LIQUIDITY, TYPICAL_SWAP_GAS_COST, Vertice, _disableDTraceMode, calcInByOut, calcInputByPrice, calcOutByIn, calcPrice, calcSquareEquation, calcTokenPrices, closeValues, enableTraceMode, findMultiRouteExactIn, findMultiRouteExactOut, findSingleRouteExactIn, findSingleRouteExactOut, getBigNumber, isTraceMode, revertPositive };
//# sourceMappingURL=index.mjs.map

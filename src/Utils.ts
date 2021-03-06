import { BigNumber } from '@ethersproject/bignumber';
import { applyPatches } from './patches';

const debug = require('debug')('tines');

export function ASSERT(f: () => boolean, t?: string) {
  if (process.env.NODE_ENV !== 'production' && !f() && t) console.error(t);
}

// && (!f() && t)) console.error(t);
const isProduction: boolean = process.env.NODE_ENV === 'production';
const prefix: string = 'Invariant failed' + (isProduction ? '' : ': ');

export function invariant(condition: boolean, message?: string) {
  if (condition) {
    return;
  }

  throw new Error(isProduction ? prefix : `${prefix}: ${message || ''}`);
}

let DEBUG_MODE = false;
export function DEBUG(f: () => any) {
  if (DEBUG_MODE) f();
}
export function DEBUG_MODE_ON(on: boolean) {
  DEBUG_MODE = on;
}

let TINES_TRACE_MODE = false;
export function isTraceMode(): boolean {
  return TINES_TRACE_MODE;
}

export function _disableDTraceMode() {
  TINES_TRACE_MODE = false;
}

export function enableTraceMode() {
  TINES_TRACE_MODE = true;
  applyPatches();
}

export function closeValues(a: number, b: number, accuracy: number): boolean {
  if (accuracy === 0) return a === b;
  if (a < 1 / accuracy) return Math.abs(a - b) <= 10;
  return Math.abs(a / b - 1) < accuracy;
}

/**
 * @export calcSquareEquation
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @return {*}  {[number, number]}
 */
export function calcSquareEquation(a: number, b: number, c: number): readonly [number, number] {
  const D = b * b - 4 * a * c;
  console.assert(D >= 0, `Discriminant is negative! ${a} ${b} ${c}`);
  const sqrtD = Math.sqrt(D);
  return [(-b - sqrtD) / 2 / a, (-b + sqrtD) / 2 / a];
}

/**
 * @export revertPositive
 * @param {(x: number) => number} f
 * @param {number} out
 * @param {number} [hint=1]
 * @return {*}
 * @summary Returns such x > 0 that f(x) = out or 0 if there is no such x or f defined not everywhere
 * @hint  approximation of x to speed up the algorithm
 * @note f assumed to be continues monotone growth function defined everywhere
 */
export function revertPositive(
    f: (x: number) => number,
    out: number,
    hint: number = 1
  ): any {
    try {
      if (out <= f(0)) return 0;
      let min: number;
      let max: number;
      if (f(hint) > out) {
        min = hint / 2;
        while (f(min) > out) min /= 2;
        max = min * 2;
      } else {
        max = hint * 2;
        while (f(max) < out) max *= 2;
        min = max / 2;
      }
  
      while (max / min - 1 > 1e-4) {
        const x0: number = (min + max) / 2;
        const y0 = f(x0);
        if (out === y0) return x0;
        if (out < y0) max = x0;
        else min = x0;
      }
      return (min + max) / 2;
    } catch (e) {
      return 0;
    }

    while (max / min - 1 > 1e-4) {
      const x0: number = (min + max) / 2;
      const y0 = f(x0);
      if (out === y0) return x0;
      if (out < y0) max = x0;
      else min = x0;
    }
    return (min + max) / 2;
  } catch (e) {
    return 0;
  }
}

export function getBigNumber(value: number): BigNumber {
  const v = Math.abs(value);
  if (v < Number.MAX_SAFE_INTEGER) return BigNumber.from(Math.round(value));

  const exp = Math.floor(Math.log(v) / Math.LN2);
  // const mantissa = v * Math.pow(2, -exp);
  // return BigNumber.from(mantissa).mul(BigNumber.from(2).pow(exp));
  //  return BigNumber.from(v).mul(BigNumber.from(2).pow(exp));
  // @Error 314
  console.assert(exp >= 51, 'Internal Error 314');
  const shift = exp - 51;
  // exponentiation operator **; accepts BigInts as operands.
  const mant = Math.round(v / 2 ** shift);
  const res = BigNumber.from(mant).mul(BigNumber.from(2).pow(shift));
  return value > 0 ? res : res.mul(-1);
}

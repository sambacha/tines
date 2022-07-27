import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
export var PoolType;
(function (PoolType) {
    PoolType["ConstantProduct"] = "ConstantProduct";
    PoolType["Weighted"] = "Weighted";
    PoolType["Hybrid"] = "Hybrid";
    PoolType["ConcentratedLiquidity"] = "ConcentratedLiquidity";
})(PoolType || (PoolType = {}));
export class Pool {
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
            minLiquidity: 1000,
            swapGasCost: 40_000,
            ..._info,
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
export class RConstantProductPool extends Pool {
    constructor(info) {
        super({
            type: PoolType.ConstantProduct,
            ...info,
        });
    }
}
export class RHybridPool extends Pool {
    A;
    constructor(info) {
        super({
            type: PoolType.Hybrid,
            ...info,
        });
        this.A = info.A;
    }
}
export class RWeightedPool extends Pool {
    weight0;
    weight1;
    constructor(info) {
        super({
            type: PoolType.Weighted,
            ...info,
        });
        this.weight0 = info.weight0;
        this.weight1 = info.weight1;
    }
}
export class RConcentratedLiquidityPool extends Pool {
    liquidity;
    sqrtPrice;
    nearestTick;
    ticks;
    constructor(info) {
        super({
            type: PoolType.ConcentratedLiquidity,
            reserve0: BigNumber.from(0),
            reserve1: BigNumber.from(0),
            ...info,
        });
        this.liquidity = info.liquidity;
        this.sqrtPrice = info.sqrtPrice;
        this.nearestTick = info.nearestTick;
        this.ticks = info.ticks;
    }
}
//# sourceMappingURL=MultiRouterTypes.js.map
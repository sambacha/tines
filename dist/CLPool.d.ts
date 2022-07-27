import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
import { RPool } from './PrimaryPools';
import type { RToken } from './PrimaryPools';
export declare const CL_MIN_TICK = -887272;
export declare const CL_MAX_TICK: number;
export interface CLTick {
    index: number;
    DLiquidity: number;
}
export declare class CLRPool extends RPool {
    tickSpacing: number;
    liquidity: number;
    sqrtPrice: number;
    nearestTick: number;
    ticks: CLTick[];
    constructor(address: string, token0: RToken, token1: RToken, fee: number, tickSpacing: number, reserve0: BigNumber, reserve1: BigNumber, liquidity: number, sqrtPrice: number, nearestTick: number, ticks: CLTick[]);
    calcOutByIn(amountIn: number, direction: boolean): {
        out: number;
        gasSpent: number;
    };
    calcInByOut(amountOut: number, direction: boolean): {
        inp: number;
        gasSpent: number;
    };
    calcCurrentPriceWithoutFee(direction: boolean): number;
}

import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
import { RPool } from './PrimaryPools';
import type { RToken } from './PrimaryPools';
export interface Rebase {
    elastic: BigNumber;
    base: BigNumber;
}
declare class RebaseInternal {
    elastic2Base: number;
    rebaseBN: Rebase;
    constructor(rebase: Rebase);
    toAmount(share: number): number;
    toShare(amount: number): number;
    toAmountBN(share: BigNumber): BigNumber;
}
export declare function realReservesToAdjusted(reserve: BigNumber, total: Rebase, decimals: number): BigNumber;
export declare function adjustedReservesToReal(reserve: BigNumber, total: Rebase, decimals: number): BigNumber;
export declare class StableSwapRPool extends RPool {
    k: BigNumber;
    decimals0: number;
    decimals1: number;
    decimalsCompensation0: number;
    decimalsCompensation1: number;
    total0: RebaseInternal;
    total1: RebaseInternal;
    constructor(address: string, token0: RToken, token1: RToken, fee: number, reserve0: BigNumber, reserve1: BigNumber, decimals0: number, decimals1: number, total0: Rebase, total1: Rebase);
    getReserve0(): BigNumber;
    getReserve1(): BigNumber;
    granularity0(): number;
    granularity1(): number;
    updateReserves(res0: BigNumber, res1: BigNumber): void;
    computeK(): BigNumber;
    computeY(x: BigNumber, yHint: BigNumber): BigNumber;
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
export {};

import { ConstantProductRPool, RPool } from './';
import type { RToken } from './PrimaryPools';
interface JumpInfo {
    poolIndex: number;
    input: number;
    output: number;
    price: number;
    combinedLiquidityY: number;
    gasCost: number;
}
export declare class ParallelCPRPool extends RPool {
    readonly token0: RToken;
    readonly allPools: ConstantProductRPool[];
    readonly gasPrice: number;
    jumps0?: JumpInfo[];
    jumps1?: JumpInfo[];
    constructor(inputToken: RToken, pools: ConstantProductRPool[], gasPrice: number);
    calcNextJumpforPool(pool: ConstantProductRPool, poolIndex: number, direction: boolean, prevJump?: JumpInfo): JumpInfo | undefined;
    calcBestJump(pools: ConstantProductRPool[], direction: boolean, prevJump?: JumpInfo): JumpInfo | undefined;
    calcJumps(direction: boolean): JumpInfo[];
    getJump(direction: boolean, less: (j: JumpInfo) => boolean): JumpInfo;
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

import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
export declare const TYPICAL_SWAP_GAS_COST = 60000;
export declare const TYPICAL_MINIMAL_LIQUIDITY = 1000;
export interface RToken {
    name: string;
    symbol: string;
    address: string;
}
export declare abstract class RPool {
    readonly address: string;
    readonly token0: RToken;
    readonly token1: RToken;
    readonly fee: number;
    reserve0: BigNumber;
    reserve1: BigNumber;
    readonly minLiquidity: number;
    readonly swapGasCost: number;
    constructor(address: string, token0: RToken, token1: RToken, fee: number, reserve0: BigNumber, reserve1: BigNumber, minLiquidity?: number, swapGasCost?: number);
    updateReserves(res0: BigNumber, res1: BigNumber): void;
    getReserve0(): BigNumber;
    getReserve1(): BigNumber;
    abstract calcOutByIn(amountIn: number, direction: boolean): {
        out: number;
        gasSpent: number;
    };
    abstract calcInByOut(amountOut: number, direction: boolean): {
        inp: number;
        gasSpent: number;
    };
    abstract calcCurrentPriceWithoutFee(direction: boolean): number;
    granularity0(): number;
    granularity1(): number;
}
export declare class ConstantProductRPool extends RPool {
    reserve0Number: number;
    reserve1Number: number;
    constructor(address: string, token0: RToken, token1: RToken, fee: number, reserve0: BigNumber, reserve1: BigNumber);
    updateReserves(res0: BigNumber, res1: BigNumber): void;
    calcOutByIn(amountIn: number, direction: boolean): {
        out: number;
        gasSpent: number;
    };
    calcInByOut(amountOut: number, direction: boolean): {
        inp: number;
        gasSpent: number;
    };
    calcCurrentPriceWithoutFee(direction: boolean): number;
    calcPrice(amountIn: number, direction: boolean, takeFeeIntoAccount: boolean): number;
    calcInputByPrice(price: number, direction: boolean, takeFeeIntoAccount: boolean): number;
    getLiquidity(): number;
}
export declare class HybridRPool extends RPool {
    readonly A: number;
    readonly A_PRECISION = 100;
    D: BigNumber;
    constructor(address: string, token0: RToken, token1: RToken, fee: number, A: number, reserve0: BigNumber, reserve1: BigNumber);
    updateReserves(res0: BigNumber, res1: BigNumber): void;
    computeLiquidity(): BigNumber;
    computeY(x: BigNumber): BigNumber;
    calcOutByIn(amountIn: number, direction: boolean): {
        out: number;
        gasSpent: number;
    };
    calcInByOut(amountOut: number, direction: boolean): {
        inp: number;
        gasSpent: number;
    };
    calcCurrentPriceWithoutFee(direction: boolean): number;
    calcPrice(amountIn: number, direction: boolean, takeFeeIntoAccount: boolean): number;
    calcInputByPrice(price: number, direction: boolean, takeFeeIntoAccount: boolean, hint?: number): number;
}

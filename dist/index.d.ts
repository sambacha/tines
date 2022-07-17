import { BigNumber } from '@ethersproject/bignumber';

declare const TYPICAL_SWAP_GAS_COST = 60000;
declare const TYPICAL_MINIMAL_LIQUIDITY = 1000;
interface RToken$1 {
    name: string;
    address: string;
}
declare abstract class RPool {
    readonly address: string;
    readonly token0: RToken$1;
    readonly token1: RToken$1;
    readonly fee: number;
    reserve0: BigNumber;
    reserve1: BigNumber;
    readonly minLiquidity: number;
    readonly swapGasCost: number;
    constructor(address: string, token0: RToken$1, token1: RToken$1, fee: number, reserve0: BigNumber, reserve1: BigNumber, minLiquidity?: number, swapGasCost?: number);
    updateReserves(res0: BigNumber, res1: BigNumber): void;
    abstract calcOutByIn(amountIn: number, direction: boolean): {
        out: number;
        gasSpent: number;
    };
    abstract calcInByOut(amountOut: number, direction: boolean): {
        inp: number;
        gasSpent: number;
    };
    abstract calcCurrentPriceWithoutFee(direction: boolean): number;
}
declare class ConstantProductRPool extends RPool {
    reserve0Number: number;
    reserve1Number: number;
    constructor(address: string, token0: RToken$1, token1: RToken$1, fee: number, reserve0: BigNumber, reserve1: BigNumber);
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
declare class HybridRPool extends RPool {
    readonly A: number;
    readonly A_PRECISION = 100;
    D: BigNumber;
    constructor(address: string, token0: RToken$1, token1: RToken$1, fee: number, A: number, reserve0: BigNumber, reserve1: BigNumber);
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

declare const CL_MIN_TICK = -887272;
declare const CL_MAX_TICK: number;
interface CLTick$1 {
    index: number;
    DLiquidity: number;
}
declare class CLRPool extends RPool {
    tickSpacing: number;
    liquidity: number;
    sqrtPrice: number;
    nearestTick: number;
    ticks: CLTick$1[];
    constructor(address: string, token0: RToken$1, token1: RToken$1, fee: number, tickSpacing: number, reserve0: BigNumber, reserve1: BigNumber, liquidity: number, sqrtPrice: number, nearestTick: number, ticks: CLTick$1[]);
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

interface Rebase {
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
declare class StableSwapRPool extends RPool {
    k: BigNumber;
    total0: RebaseInternal;
    total1: RebaseInternal;
    constructor(address: string, token0: RToken$1, token1: RToken$1, fee: number, reserve0: BigNumber, reserve1: BigNumber, total0: Rebase, total1: Rebase);
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

interface RouteLeg {
    poolAddress: string;
    poolFee: number;
    tokenFrom: RToken$1;
    tokenTo: RToken$1;
    assumedAmountIn: number;
    assumedAmountOut: number;
    swapPortion: number;
    absolutePortion: number;
}
declare enum RouteStatus {
    Success = "Success",
    NoWay = "NoWay",
    Partial = "Partial"
}
interface MultiRoute {
    status: RouteStatus;
    fromToken: RToken$1;
    toToken: RToken$1;
    primaryPrice?: number;
    swapPrice?: number;
    priceImpact?: number;
    amountIn: number;
    amountInBN: BigNumber;
    amountOut: number;
    amountOutBN: BigNumber;
    legs: RouteLeg[];
    gasSpent: number;
    totalAmountOut: number;
    totalAmountOutBN: BigNumber;
}
declare class Edge {
    pool: RPool;
    vert0: Vertice;
    vert1: Vertice;
    canBeUsed: boolean;
    direction: boolean;
    amountInPrevious: number;
    amountOutPrevious: number;
    spentGas: number;
    spentGasNew: number;
    bestEdgeIncome: number;
    constructor(p: RPool, v0: Vertice, v1: Vertice);
    cleanTmpData(): void;
    reserve(v: Vertice): BigNumber;
    calcOutput(v: Vertice, amountIn: number): {
        out: number;
        gasSpent: number;
    };
    calcInput(v: Vertice, amountOut: number): {
        inp: number;
        gasSpent: number;
    };
    checkMinimalLiquidityExceededAfterSwap(from: Vertice, amountOut: number): boolean;
    testApply(from: Vertice, amountIn: number, amountOut: number): boolean;
    applySwap(from: Vertice): void;
}
declare class Vertice {
    token: RToken$1;
    edges: Edge[];
    price: number;
    gasPrice: number;
    bestIncome: number;
    gasSpent: number;
    bestTotal: number;
    bestSource?: Edge;
    checkLine: number;
    constructor(t: RToken$1);
    cleanTmpData(): void;
    getNeibour(e?: Edge): Vertice;
    getOutputEdges(): Edge[];
    getInputEdges(): Edge[];
}
declare class Graph {
    vertices: Vertice[];
    edges: Edge[];
    tokens: Map<string, Vertice>;
    constructor(pools: RPool[], baseToken: RToken$1, gasPrice: number);
    cleanTmpData(): void;
    setPricesStable(from: Vertice, price: number, gasPrice: number): void;
    setPrices(from: Vertice, price: number, gasPrice: number): void;
    getOrCreateVertice(token: RToken$1): Vertice;
    findBestPathExactIn(from: RToken$1, to: RToken$1, amountIn: number, _gasPrice?: number): {
        path: Edge[];
        output: number;
        gasSpent: number;
        totalOutput: number;
    } | undefined;
    findBestPathExactOut(from: RToken$1, to: RToken$1, amountOut: number, _gasPrice?: number): {
        path: Edge[];
        input: number;
        gasSpent: number;
        totalInput: number;
    } | undefined;
    addPath(from: Vertice | undefined, to: Vertice | undefined, path: Edge[]): void;
    getPrimaryPriceForPath(from: Vertice, path: Edge[]): number;
    findBestRouteExactIn(from: RToken$1, to: RToken$1, amountIn: number, mode: number | number[]): MultiRoute;
    findBestRouteExactOut(from: RToken$1, to: RToken$1, amountOut: number, mode: number | number[]): MultiRoute;
    getRouteLegs(from: Vertice, to: Vertice): {
        legs: RouteLeg[];
        gasSpent: number;
        topologyWasChanged: boolean;
    };
    edgeFrom(e: Edge): {
        vert: Vertice;
        amount: number;
    } | undefined;
    calcLegsAmountOut(legs: RouteLeg[], amountIn: number): number;
    calcLegsAmountIn(legs: RouteLeg[], amountOut: number): number;
    cleanTopology(from: Vertice, to: Vertice): {
        vertices: Vertice[];
        topologyWasChanged: boolean;
    };
    removeDeadEnds(verts: Vertice[]): void;
    removeWeakestEdge(verts: Vertice[]): void;
    topologySort(from: Vertice, to: Vertice): {
        status: number;
        vertices: Vertice[];
    };
}

declare function findMultiRouteExactIn(from: RToken$1, to: RToken$1, amountIn: BigNumber | number, pools: RPool[], baseToken: RToken$1, gasPrice: number, flows?: number | number[]): MultiRoute;
declare function findMultiRouteExactOut(from: RToken$1, to: RToken$1, amountOut: BigNumber | number, pools: RPool[], baseToken: RToken$1, gasPrice: number, flows?: number | number[]): MultiRoute;
declare function findSingleRouteExactIn(from: RToken$1, to: RToken$1, amountIn: BigNumber | number, pools: RPool[], baseToken: RToken$1, gasPrice: number): MultiRoute;
declare function findSingleRouteExactOut(from: RToken$1, to: RToken$1, amountOut: BigNumber | number, pools: RPool[], baseToken: RToken$1, gasPrice: number): MultiRoute;
declare function calcTokenPrices(pools: RPool[], baseToken: RToken$1): Map<RToken$1, number>;

declare function ASSERT(f: () => boolean, t?: string): void;
declare function DEBUG(f: () => any): void;
declare function DEBUG_MODE_ON(on: boolean): void;
declare function isTraceMode(): boolean;
declare function _disableDTraceMode(): void;
declare function enableTraceMode(): void;
declare function closeValues(a: number, b: number, accuracy: number): boolean;
declare function calcSquareEquation(a: number, b: number, c: number): [number, number];
declare function revertPositive(f: (x: number) => number, out: number, hint?: number): number;
declare function getBigNumber(value: number): BigNumber;

interface RToken {
    name: string;
    address: string;
}
declare enum PoolType {
    ConstantProduct = "ConstantProduct",
    Weighted = "Weighted",
    Hybrid = "Hybrid",
    ConcentratedLiquidity = "ConcentratedLiquidity"
}
interface PoolInfo {
    address: string;
    token0: RToken;
    token1: RToken;
    type: PoolType;
    reserve0: BigNumber;
    reserve1: BigNumber;
    fee: number;
    minLiquidity: number;
    swapGasCost: number;
}
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
declare type PoolInfoWithDefaults = PartialBy<PoolInfo, 'minLiquidity' | 'swapGasCost'>;
declare class Pool {
    address: string;
    token0: RToken;
    token1: RToken;
    type: PoolType;
    reserve0: BigNumber;
    reserve1: BigNumber;
    fee: number;
    minLiquidity: number;
    swapGasCost: number;
    constructor(_info: PoolInfoWithDefaults);
}
declare type PoolInfoNoType = Omit<PoolInfoWithDefaults, 'type'>;
declare class RConstantProductPool extends Pool {
    constructor(info: PoolInfoNoType);
}
declare type HybridPoolInfo = PoolInfoNoType & {
    A: number;
};
declare class RHybridPool extends Pool {
    A: number;
    constructor(info: HybridPoolInfo);
}
declare type WeightedPoolInfo = PoolInfoNoType & {
    weight0: number;
    weight1: number;
};
declare class RWeightedPool extends Pool {
    weight0: number;
    weight1: number;
    constructor(info: WeightedPoolInfo);
}
interface CLTick {
    index: number;
    DLiquidity: number;
}
interface CLSpecific {
    liquidity: number;
    sqrtPrice: number;
    nearestTick: number;
    ticks: CLTick[];
}
declare type CLPoolInfo = Omit<PoolInfoNoType, 'reserve0' | 'reserve1'> & CLSpecific;
declare class RConcentratedLiquidityPool extends Pool {
    liquidity: number;
    sqrtPrice: number;
    nearestTick: number;
    ticks: CLTick[];
    constructor(info: CLPoolInfo);
}

declare function HybridComputeLiquidity(pool: RHybridPool): BigNumber;
declare function HybridgetY(pool: RHybridPool, x: BigNumber): BigNumber;
declare function calcOutByIn(pool: Pool, amountIn: number, direction?: boolean): number;
declare class OutOfLiquidity extends Error {
}
declare function calcInByOut(pool: Pool, amountOut: number, direction: boolean): number;
declare function calcPrice(pool: Pool, amountIn: number, takeFeeIntoAccount?: boolean): number;
declare function calcInputByPrice(pool: Pool, priceEffective: number, hint?: number): number;

export { ASSERT, CLRPool, CLTick$1 as CLTick, CL_MAX_TICK, CL_MIN_TICK, ConstantProductRPool, DEBUG, DEBUG_MODE_ON, Edge, Graph, HybridComputeLiquidity, HybridRPool, HybridgetY, MultiRoute, OutOfLiquidity, Pool, PoolInfo, PoolType, RConcentratedLiquidityPool, RConstantProductPool, RHybridPool, RPool, RToken$1 as RToken, RWeightedPool, RouteLeg, RouteStatus, StableSwapRPool, TYPICAL_MINIMAL_LIQUIDITY, TYPICAL_SWAP_GAS_COST, Vertice, _disableDTraceMode, calcInByOut, calcInputByPrice, calcOutByIn, calcPrice, calcSquareEquation, calcTokenPrices, closeValues, enableTraceMode, findMultiRouteExactIn, findMultiRouteExactOut, findSingleRouteExactIn, findSingleRouteExactOut, getBigNumber, isTraceMode, revertPositive };

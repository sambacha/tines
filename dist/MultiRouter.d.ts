import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
import { MultiRoute } from './Graph';
import { RPool } from './PrimaryPools';
import type { RToken } from './PrimaryPools';
export declare function findMultiRouteExactIn(from: RToken, to: RToken, amountIn: BigNumber | number, pools: RPool[], baseToken: RToken, gasPrice: number, flows?: number | number[]): MultiRoute;
export declare function findMultiRouteExactOut(from: RToken, to: RToken, amountOut: BigNumber | number, pools: RPool[], baseToken: RToken, gasPrice: number, flows?: number | number[]): MultiRoute;
export declare function findSingleRouteExactIn(from: RToken, to: RToken, amountIn: BigNumber | number, pools: RPool[], baseToken: RToken, gasPrice: number): MultiRoute;
export declare function findSingleRouteExactOut(from: RToken, to: RToken, amountOut: BigNumber | number, pools: RPool[], baseToken: RToken, gasPrice: number): MultiRoute;
export declare function calcTokenPrices(pools: RPool[], baseToken: RToken): Map<RToken, number>;

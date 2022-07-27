import { Edge, Vertice } from './Graph';
declare class Pool {
    from: number;
    to: number;
    edge: Edge;
    direction: boolean;
    constructor(fromIndex: number, toIndex: number, edge: Edge, from: Vertice);
    calcOutByIn(amountIn: number): number;
    input(): number;
}
export declare class Redistributor {
    tokenNumber: number;
    tokensTopologySorted: Vertice[];
    tokenIndex: Map<Vertice, number>;
    outputTokens: number[][];
    pools: Pool[][];
    paths: Pool[][];
    getPaths(from: number, to: number): Pool[] | undefined;
    setPaths(from: number, to: number, paths: Pool[]): void;
    getPools(from: number, to: number): Pool[] | undefined;
    setPools(from: number, to: number, pools: Pool[]): void;
    constructor(_nodesTopologySorted: Vertice[]);
    redistribute(): void;
    redistrPaths(from: number, to: number, paths: Pool[]): void;
    calcOutput(from: number, to: number, paths: Pool[], amountIn: number): number;
    calcPrice(from: number, to: number, paths: Pool[], amountIn: number): number;
    calcInputForPrice(from: number, to: number, paths: Pool[], amountIn: number, price: number): number;
}
export {};

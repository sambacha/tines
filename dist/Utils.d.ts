import { BigNumber } from '@ethersproject/bignumber/lib.esm/index.js';
export declare function ASSERT(f: () => boolean, t?: string): void;
export declare function DEBUG(f: () => unknown): void;
export declare function DEBUG_MODE_ON(on: boolean): void;
export declare function closeValues(a: number, b: number, accuracy: number, logInfoIfFalse?: string): boolean;
export declare function calcSquareEquation(a: number, b: number, c: number): [number, number];
export declare function revertPositive(f: (x: number) => number, out: number, hint?: number): number;
export declare function getBigNumber(value: number): BigNumber;

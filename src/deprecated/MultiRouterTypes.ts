import { BigNumber } from '@ethersproject/bignumber';

interface RToken {
  readonly name: string;
  readonly address: string;
}

export enum PoolType {
  ConstantProduct = 'ConstantProduct',
  Weighted = 'Weighted',
  Hybrid = 'Hybrid',
  ConcentratedLiquidity = 'ConcentratedLiquidity',
}

export interface PoolInfo {
  readonly address: string;
  readonly token0: RToken;
  readonly token1: RToken;
  readonly type: PoolType;
  readonly reserve0: BigNumber;
  readonly reserve1: BigNumber;
  readonly fee: number;
  readonly minLiquidity: number;
  readonly swapGasCost: number;
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type PoolInfoWithDefaults = PartialBy<PoolInfo, 'minLiquidity' | 'swapGasCost'>;

export class Pool {
  readonly address: string;
  readonly token0: RToken;
  readonly token1: RToken;
  readonly type: PoolType;
  readonly reserve0: BigNumber;
  readonly reserve1: BigNumber;
  readonly fee: number;
  readonly minLiquidity: number;
  readonly swapGasCost: number;

  constructor(_info: PoolInfoWithDefaults) {
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

type PoolInfoNoType = Omit<PoolInfoWithDefaults, 'type'>;

export class RConstantProductPool extends Pool {
  constructor(info: PoolInfoNoType) {
    super({
      type: PoolType.ConstantProduct,
      ...info,
    });
  }
}

type HybridPoolInfo = PoolInfoNoType & { readonly A: number };

export class RHybridPool extends Pool {
  readonly A: number;
  constructor(info: HybridPoolInfo) {
    super({
      type: PoolType.Hybrid,
      ...info,
    });
    this.A = info.A;
  }
}

type WeightedPoolInfo = PoolInfoNoType & { readonly weight0: number; readonly weight1: number };

export class RWeightedPool extends Pool {
  readonly weight0: number;
  readonly weight1: number;
  constructor(info: WeightedPoolInfo) {
    super({
      type: PoolType.Weighted,
      ...info,
    });
    this.weight0 = info.weight0;
    this.weight1 = info.weight1;
  }
}

interface CLTick {
  readonly index: number;
  readonly DLiquidity: number;
}

interface CLSpecific {
  readonly liquidity: number;
  readonly sqrtPrice: number;
  readonly nearestTick: number;
  readonly ticks: readonly CLTick[];
}

type CLPoolInfo = Omit<PoolInfoNoType, 'reserve0' | 'reserve1'> & CLSpecific;

export class RConcentratedLiquidityPool extends Pool {
  readonly liquidity: number;
  readonly sqrtPrice: number;
  readonly nearestTick: number;
  readonly ticks: readonly CLTick[];
  constructor(info: CLPoolInfo) {
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

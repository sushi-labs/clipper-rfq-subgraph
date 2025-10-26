import { Chain } from 'viem'
import * as chains from 'viem/chains'

export type PoolSourceAbi = 'ClipperCommonExchangeV0' | 'BladeCommonExchangeV0'

export const PoolSourceAbiSet: Set<PoolSourceAbi> = new Set(['ClipperCommonExchangeV0', 'BladeCommonExchangeV0'] as PoolSourceAbi[])

export type RegisterSourceAbi = 'BladePoolRegisterV0' | 'BladePoolRegisterV1'

export const RegisterSourceAbiSet: Set<RegisterSourceAbi> = new Set(['BladePoolRegisterV0', 'BladePoolRegisterV1'] as RegisterSourceAbi[])

type VaultCommon = {
  startBlock: number
  address: string
}

type FarmAbi = 'SplitFeeFarm' | 'LinearVestingVault'

export type PoolFarmVault = VaultCommon & {
  type: "FARM"
  farmingHelper: string
  abi: FarmAbi
}

export type PoolProtocolDepositVault = VaultCommon & {
  type: "PROTOCOL_DEPOSIT"
  transferHelper: string
}

export type PoolFeeSplitVault = VaultCommon & {
  type: "FEE_SPLIT"
}

export type PoolVault = PoolFarmVault | PoolProtocolDepositVault | PoolFeeSplitVault

export interface PoolConfig {
  address: string
  startBlock: number
  contractAbiName: string
  sourceAbi: PoolSourceAbi
  feeSplit?: string // Consider if this is replaced by a PoolVaultConfig of type FEE_SPLIT
  farmFeeSplit?: string // Consider if this is replaced by a PoolVaultConfig of type FARM
  permitRouter?: string
  farmingHelper?: string // General farming helper for the pool, might differ from vault-specific one
  vaults?: PoolVault[]
}

export interface CoveConfig {
  address: string
  startBlock: number
  contractAbiName: string
  poolContractAbiName: string
  sourceAbi: string
}

export interface PriceOracleConfig {
  tokens: string[]
  address: string
  startBlock: number
  contractAbiName: string
  sourceAbi: string
}

export interface LpTransferSourceConfig {
  address: string
  startBlock: number
}

export interface BladePoolRegisterConfig {
  address: string
  startBlock: number
  sourceAbi: RegisterSourceAbi
}

export interface Deployment {
  networkName: string
  prune: number | 'never' | 'auto'

  pools: PoolConfig[]
  coves: CoveConfig[]
  registers?: BladePoolRegisterConfig[]

  priceOracles: PriceOracleConfig[]
  lpTransfers?: LpTransferSourceConfig[]

  addressZeroMap: {
    symbol: string
    decimals: number
    address: string
    name: string
  }

  fallbackPrices?: {
    [tokenAddress: string]: number | undefined
  }
}

// Map network names to Viem chain objects and potentially specific RPC URLs if needed
export const networkChainMap: Record<string, { chain: Chain; rpcUrl?: string }> = {
  matic: { chain: chains.polygon },
  optimism: { chain: chains.optimism },
  moonbeam: { chain: chains.moonbeam },
  mainnet: { chain: chains.mainnet },
  'arbitrum-one': { chain: chains.arbitrum },
  base: { chain: chains.base },
  mantle: { chain: chains.mantle },
  'polygon-zkevm': { chain: chains.polygonZkEvm },
  bsc: { chain: chains.bsc },
  katana: { 
    chain: {
      id: 747474,
      name: 'Katana',
      network: 'katana',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['http://localhost:5050'] },
        public: { http: ['http://localhost:5050'] },
      },
      blockExplorers: {
        default: { name: 'Katana Explorer', url: 'http://localhost:5050' },
      },
    } as Chain,
  },
}

export type SubgraphsManifestDeploymentBase = Omit<Deployment, 'pools' | 'priceOracles' | 'lpTransferSources'> & {
  poolsBySourceAbi: Record<PoolSourceAbi, PoolConfig[]>
  priceOracles: (Omit<PriceOracleConfig, 'tokens'> & { token: string; indexingStartBlock: number })[]
  registers?: BladePoolRegisterConfig[]
  // Add daily fallback prices
  dailyFallbackPrices?: {
    [tokenAddress: string]: {
      tokenAddress: string
      timestamp: number
      price: number
    }[]
  }
}

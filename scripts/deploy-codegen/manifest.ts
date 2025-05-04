import {
  PoolConfig,
  CoveConfig,
  PriceOracleConfig,
  Deployment,
  SubgraphsManifestDeploymentBase,
  PoolSourceAbiSet,
} from './config'

// --- Base Types ---
export interface AbiDefinition {
  name: string
  file: string
}

interface Mapping {
  kind: string
  apiVersion: string
  language: string
  entities: string[]
  abis: AbiDefinition[]
  eventHandlers: EventHandler[]
  file: string // Relative path to the mapping file
  // callHandlers?: CallHandler[]; // Add if needed
}

interface EventHandler {
  event: string // Signature
  handler: string // Function name
  topic1?: string[] // Optional for filtering Transfer events etc.
  calls?: Record<string, string> // Optional for parallel eth_calls
}

// Context Value Types - mirrors The Graph context types
type ContextValue = {
  type: 'Bool' | 'String' | 'Int' | 'Int8' | 'BigDecimal' | 'Bytes' | 'List' | 'BigInt'
  data: boolean | string | number | ContextValue[] // Adjust based on type
}

type DataSourceContext = Record<string, ContextValue>

export type DataSourceTemplate = {
  kind: string
  name: string
  network: string
  source: { abi: string }
  mapping: Mapping
}

export type DataSource = {
  kind: string
  name: string
  network: string
  context?: DataSourceContext
  source: { address: string; abi: string; startBlock: number }
  mapping: Mapping
}

// Represents the overall subgraph.yaml structure
export interface SubgraphManifest {
  specVersion: string
  indexerHints?: {
    prune?: number | 'never' | 'auto'
  }
  schema: {
    file: string
  }
  dataSources: DataSource[]
  templates?: DataSourceTemplate[]
}

export interface ManifestGenConfig {
  networkName: string
  prune: number | 'never' | 'auto'
  pools: PoolConfig[]
  coves: CoveConfig[]
  priceOracles: PriceOracleConfig[]
}

export function transformDeploymentToManifestBase(deployment: Deployment): SubgraphsManifestDeploymentBase {
  // Group pools by sourceAbi
  const poolsBySourceAbi: Record<string, PoolConfig[]> = {}
  for (const pool of deployment.pools) {
    if (!poolsBySourceAbi[pool.sourceAbi]) {
      poolsBySourceAbi[pool.sourceAbi] = []
    }
    poolsBySourceAbi[pool.sourceAbi].push(pool)
  }

  let firstPool = deployment.pools[0]
  if (!firstPool) {
    throw new Error('No pools to deploy')
  }
  const firstPoolBlock = deployment.pools
    .slice(1)
    .reduce((minBlock, pool) => Math.min(minBlock, pool.startBlock), firstPool.startBlock)
  const priceOracles = deployment.priceOracles.map<PriceOracleConfig & { indexingStartBlock: number }>(oracle => {
    return {
      ...oracle,
      indexingStartBlock: Math.max(oracle.startBlock, firstPoolBlock),
    }
  })

  return {
    ...deployment,
    poolsBySourceAbi,
    priceOracles,
  }
}

const CLIPPER_POOL_ABIS: AbiDefinition[] = [
  {
    name: 'ClipperVerifiedExchange',
    file: './abis/ClipperVerifiedExchange.json',
  },
  {
    name: 'ClipperVerifiedCaravelExchange',
    file: './abis/ClipperVerifiedCaravelExchange.json',
  },
  {
    name: 'ClipperApproximateCaravelExchange',
    file: './abis/ClipperApproximateCaravelExchange.json',
  },
  {
    name: 'ClipperCaravelExchange',
    file: './abis/ClipperCaravelExchange.json',
  },
  {
    name: 'ClipperPackedOracleVerifiedExchange',
    file: './abis/ClipperPackedOracleVerifiedExchange.json',
  },
  {
    name: 'ClipperPackedExchange',
    file: './abis/ClipperPackedExchange.json',
  },
  {
    name: 'ClipperPackedVerifiedExchange',
    file: './abis/ClipperPackedVerifiedExchange.json',
  },
  {
    name: 'ClipperDirectExchangeV0',
    file: './abis/ClipperDirectExchangeV0.json',
  },
  // Default ClipperPool ABI
  {
    name: 'ClipperPool',
    file: './abis/ClipperDirectExchangeV1.json',
  },
]

const ClipperCommonExchangeV0Template: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'ClipperCommonExchangeV0',
  source: { abi: 'ClipperCommonExchangeV0' },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: [
      'Token',
      'Pool',
      'PoolToken',
      'PoolEvent',
      'User',
      'TransactionSource',
      'PoolPair',
      'PoolTransactionSource',
      'Deposit',
      'Withdrawal',
      'Swap',
      'Pair',
    ],
    abis: [
      ...CLIPPER_POOL_ABIS,
      {
        name: 'ClipperCommonExchangeV0',
        file: './abis/ClipperCommonExchangeV0.json',
      },
      {
        name: 'ERC20',
        file: './abis/ERC20.json',
      },
      {
        name: 'AggregatorV3Interface',
        file: './abis/AggregatorV3Interface.json',
      },
    ],
    eventHandlers: [
      {
        event: 'Deposited(indexed address,uint256,uint256)',
        handler: 'handleDeposited',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperPool[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Withdrawn(indexed address,uint256,uint256)',
        handler: 'handleWithdrawn',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperPool[event.address].allTokensBalance()',
        },
      },
      {
        event: 'AssetWithdrawn(indexed address,uint256,indexed address,uint256)',
        handler: 'handleSingleAssetWithdrawn',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperPool[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Swapped(indexed address,indexed address,indexed address,uint256,uint256,bytes)',
        handler: 'handleSwapped',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperPool[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Transfer(indexed address,indexed address,uint256)',
        handler: 'handleTransfer',
      },
    ],
    file: './src/mapping.ts',
  },
}

const ClipperCoveTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: `ClipperCove`,
  source: {
    abi: 'ClipperCove',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: [
      'Token',
      'Pool',
      'PoolToken',
      'PoolEvent',
      'User',
      'TransactionSource',
      'Swap',
      'CoveTransactionSource',
      'CoveDeposit',
      'CoveWithdrawal',
      'Cove',
      'CoveEvent',
      'CoveParent',
      'UserCoveStake',
    ],
    abis: [
      {
        name: 'ClipperCove',
        file: './abis/ClipperCove.json',
      },
      {
        name: 'ERC20',
        file: './abis/ERC20.json',
      },
      {
        name: 'AggregatorV3Interface',
        file: './abis/AggregatorV3Interface.json',
      },
      {
        name: 'ClipperDirectExchangeV1',
        file: './abis/ClipperDirectExchangeV1.json',
      },
      {
        name: 'ClipperDirectExchangeV0',
        file: './abis/ClipperDirectExchangeV0.json',
      },
    ],
    eventHandlers: [
      {
        event: 'CoveSwapped(indexed address,indexed address,indexed address,uint256,uint256,bytes32)',
        handler: 'handleCoveSwapped',
        calls: {
          'ClipperCove.inAssetLastBalances': 'ClipperCove[event.address].lastBalances(event.params.inAsset)',
          'ClipperCove.outAssetLastBalances': 'ClipperCove[event.address].lastBalances(event.params.outAsset)',
        },
      },
      {
        event: 'CoveDeposited(indexed address,indexed address,uint256,uint256)',
        handler: 'handleCoveDeposited',
        calls: {
          'ClipperCove.lastBalances': 'ClipperCove[event.address].lastBalances(event.params.tokenAddress)',
        },
      },
      {
        event: 'CoveWithdrawn(indexed address,indexed address,uint256,uint256)',
        handler: 'handleCoveWithdrawn',
        calls: {
          'ClipperCove.lastBalances': 'ClipperCove[event.address].lastBalances(event.params.tokenAddress)',
        },
      },
    ],
    file: './src/coveMapping.ts',
  },
}

const PriceOracleTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: `PriceOracle`,
  source: {
    abi: 'AggregatorV3Interface',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['Token', 'Pool', 'PoolToken', 'PoolEvent'],
    abis: [
      {
        name: 'AggregatorV3Interface',
        file: './abis/AggregatorV3Interface.json',
      },
      {
        name: 'ERC20',
        file: './abis/ERC20.json',
      },
      {
        name: 'ClipperDirectExchangeV1',
        file: './abis/ClipperDirectExchangeV1.json',
      },
      {
        name: 'ClipperDirectExchangeV0',
        file: './abis/ClipperDirectExchangeV0.json',
      },
    ],
    eventHandlers: [{ event: 'AnswerUpdated(indexed int256,indexed uint256,uint256)', handler: 'handlePriceUpdated' }],
    file: './src/oracleMapping.ts',
  },
}

// Generates the SubgraphManifest object
export function generateSubgraphManifest(config: SubgraphsManifestDeploymentBase): SubgraphManifest {
  const templates: DataSourceTemplate[] = [
    { network: config.networkName, ...ClipperCommonExchangeV0Template },
    { network: config.networkName, ...ClipperCoveTemplate },
    { network: config.networkName, ...PriceOracleTemplate },
  ]
  const dataSources: DataSource[] = []
  for (const sourceAbi of PoolSourceAbiSet.values()) {
    if (sourceAbi === 'ClipperCommonExchangeV0') {
      for (const pool of config.poolsBySourceAbi.ClipperCommonExchangeV0) {
        const eventHandlers = ClipperCommonExchangeV0Template.mapping.eventHandlers.flatMap(({ calls, ...handler }) => {
          if (handler.handler === 'handleTransfer') {
            return []
          }
          return [
            {
              ...handler,
              ...(pool.contractAbiName !== 'ClipperDirectExchangeV0' ? { calls } : {}),
            },
          ]
        })
        const abis = ClipperCommonExchangeV0Template.mapping.abis.filter(
          abi => !CLIPPER_POOL_ABIS.find(c => c.name === abi.name),
        )
        dataSources.push({
          ...ClipperCommonExchangeV0Template,
          name: `${pool.contractAbiName}_${pool.address}`,
          network: config.networkName,
          source: {
            abi: ClipperCommonExchangeV0Template.source.abi,
            address: pool.address,
            startBlock: pool.startBlock,
          },
          context: {
            contractAbiName: { type: 'String', data: pool.contractAbiName },
          },
          mapping: {
            ...ClipperCommonExchangeV0Template.mapping,
            abis: [
              {
                name: 'ClipperPool',
                file: `./abis/${pool.contractAbiName}.json`,
              },
              ...abis,
            ],
            eventHandlers: [
              ...eventHandlers,
              {
                event: 'Transfer(indexed address,indexed address,uint256)',
                handler: 'handleTransfer',
                ...(pool.permitRouter
                  ? {
                      topic1: [pool.permitRouter],
                    }
                  : {}),
              },
            ],
          },
        })
      }
    }
  }

  for (const cove of config.coves) {
    dataSources.push({
      ...ClipperCoveTemplate,
      name: `ClipperCove_${cove.address}`,
      network: config.networkName,
      source: {
        abi: ClipperCoveTemplate.source.abi,
        address: cove.address,
        startBlock: cove.startBlock,
      },
      context: {
        //TODO: FIX
        poolContractAbiName: { type: 'String', data: cove.poolContractAbiName },
      },
      mapping: {
        ...ClipperCoveTemplate.mapping,
      },
    })
  }

  for (const oracle of config.priceOracles) {
    dataSources.push({
      ...PriceOracleTemplate,
      name: `PriceOracle_${oracle.address}`,
      network: config.networkName,
      source: {
        abi: PriceOracleTemplate.source.abi,
        address: oracle.address,
        startBlock: oracle.indexingStartBlock,
      },
      mapping: {
        ...PriceOracleTemplate.mapping,
      },
    })
  }

  // --- Assemble Manifest ---
  const manifest: SubgraphManifest = {
    specVersion: '1.2.0',
    indexerHints: {
      prune: config.prune,
    },
    schema: {
      file: './schema.graphql',
    },
    dataSources: dataSources,
    templates: templates,
  }

  return manifest
}

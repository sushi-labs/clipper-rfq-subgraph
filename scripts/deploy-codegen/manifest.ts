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
  eventHandlers?: EventHandler[]
  blockHandlers?: BlockHandler[]
  file: string // Relative path to the mapping file
  // callHandlers?: CallHandler[]; // Add if needed
}

interface BlockHandler {
  handler: string
  filter: {
    kind: string
  }
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

export type TokenMap = Map<string, { symbol?: string; address: string; poolAddresses: string[] }>

export function transformDeploymentToManifestBase(
  deployment: Deployment,
  tokenMap: TokenMap,
): SubgraphsManifestDeploymentBase {
  // Group pools by sourceAbi
  const poolsBySourceAbi: Record<string, PoolConfig[]> = {}
  for (const pool of deployment.pools) {
    if (!poolsBySourceAbi[pool.sourceAbi]) {
      poolsBySourceAbi[pool.sourceAbi] = []
    }
    poolsBySourceAbi[pool.sourceAbi].push(pool)
  }

  let firstPool = deployment.pools[0]
  if (!firstPool && (!deployment.registers || deployment.registers.length === 0)) {
    throw new Error('No pools or BladePoolRegisters to deploy')
  }

  const priceOracles: SubgraphsManifestDeploymentBase['priceOracles'] = []

  for (const oracle of deployment.priceOracles) {
    for (const tokenAddress of oracle.tokens) {
      const token = tokenMap.get(tokenAddress.toLowerCase())
      if (!token) {
        continue
      }
      let firstPoolBlock: number | undefined
      for (const pool of token.poolAddresses) {
        const poolConfig = deployment.pools.find(p => p.address === pool)
        if (poolConfig) {
          if (firstPoolBlock === undefined || poolConfig.startBlock < firstPoolBlock) {
            firstPoolBlock = poolConfig.startBlock
          }
        }
      }
      if (firstPoolBlock === undefined) {
        throw new Error(`No pools found for token ${tokenAddress}`)
      }
      const indexingStartBlock = Math.max(oracle.startBlock, firstPoolBlock)
      const priceOracleConfig = {
        address: oracle.address,
        startBlock: oracle.startBlock,
        contractAbiName: oracle.contractAbiName,
        sourceAbi: oracle.sourceAbi,
        token: token.address,
        indexingStartBlock,
      }
      priceOracles.push(priceOracleConfig)
    }
  }

  return {
    ...deployment,
    poolsBySourceAbi,
    priceOracles,
    registers: deployment.registers,
  }
}

const CLIPPER_POOL_ABIS: AbiDefinition[] = [
  // {
  //   name: 'ClipperVerifiedExchange',
  //   file: './abis/ClipperVerifiedExchange.json',
  // },
  // {
  //   name: 'ClipperVerifiedCaravelExchange',
  //   file: './abis/ClipperVerifiedCaravelExchange.json',
  // },
  // {
  //   name: 'ClipperApproximateCaravelExchange',
  //   file: './abis/ClipperApproximateCaravelExchange.json',
  // },
  // {
  //   name: 'ClipperCaravelExchange',
  //   file: './abis/ClipperCaravelExchange.json',
  // },
  // {
  //   name: 'ClipperPackedOracleVerifiedExchange',
  //   file: './abis/ClipperPackedOracleVerifiedExchange.json',
  // },
  // {
  //   name: 'ClipperPackedExchange',
  //   file: './abis/ClipperPackedExchange.json',
  // },
  // {
  //   name: 'ClipperPackedVerifiedExchange',
  //   file: './abis/ClipperPackedVerifiedExchange.json',
  // },
  {
    name: 'ClipperDirectExchangeV0',
    file: './abis/ClipperDirectExchangeV0.json',
  },
  // Default ClipperPool ABI
  {
    name: 'ClipperDirectExchangeV1',
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
      'PriceAggregatorProxy',
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
    blockHandlers: [
      {
        handler: 'handlePoolStart',
        filter: {
          kind: 'once'
        }
      }
    ],
    eventHandlers: [
      {
        event: 'Deposited(indexed address,uint256,uint256)',
        handler: 'handleDeposited',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperDirectExchangeV1[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Withdrawn(indexed address,uint256,uint256)',
        handler: 'handleWithdrawn',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperDirectExchangeV1[event.address].allTokensBalance()',
        },
      },
      {
        event: 'AssetWithdrawn(indexed address,uint256,indexed address,uint256)',
        handler: 'handleSingleAssetWithdrawn',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperDirectExchangeV1[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Swapped(indexed address,indexed address,indexed address,uint256,uint256,bytes)',
        handler: 'handleSwapped',
        calls: {
          'ClipperDirectExchange.allTokensBalance': 'ClipperDirectExchangeV1[event.address].allTokensBalance()',
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
      'PriceAggregatorProxy',
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
    blockHandlers: [
      {
        handler: 'handleCoveStart',
        filter: {
          kind: 'once'
        }
      }
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
    entities: ['Token', 'Pool', 'PoolToken', 'PoolEvent', 'PriceAggregatorProxy'],
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

const VaultFarmTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'VaultFarm',
  source: {
    abi: 'LinearVestingVault',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['PoolVault', 'PoolFarmVault'],
    abis: [
      {
        name: 'LinearVestingVault',
        file: './abis/clipper-linear-vesting-vault.json',
      },
      {
        name: 'ERC20',
        file: './abis/ERC20.json',
      },
    ],
    blockHandlers: [
      {
        handler: 'handleFarmStart',
        filter: {
          kind: 'once',
        },
      },
    ],
    eventHandlers: [],
    file: './src/mappingVaultFarm.ts',
  },
}

const VaultProtocolDepositTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'VaultProtocolDeposit',
  source: {
    abi: 'ClipperProtocolDeposit',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['PoolVault', 'PoolProtocolDepositVault'],
    abis: [
      {
        name: 'ClipperProtocolDeposit',
        file: './abis/ClipperProtocolDeposit.json',
      },
    ],

    blockHandlers: [
      {
        handler: 'handleProtocolDepositStart',
        filter: {
          kind: 'once',
        },
      },
    ],
    eventHandlers: [],
    file: './src/mappingVaultProtocolDeposit.ts',
  },
}

const VaultFeeSplitTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'VaultFeeSplit',
  source: {
    abi: 'FeeSplit',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['PoolVault'],
    abis: [
      {
        name: 'FeeSplit',
        file: './abis/FeeSplit.json',
      },
    ],
    blockHandlers: [
      {
        handler: 'handleFeeSplitStart',
        filter: {
          kind: 'once',
        },
      },
    ],
    eventHandlers: [],
    file: './src/mappingVaultFeeSplit.ts',
  },
}

const LpTransferTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'LpTransfer',
  source: {
    abi: 'LpTransfer',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['PoolLpTransfer'],
    abis: [
      {
        name: 'LpTransfer',
        file: './abis/LpTransfer.json',
      },
    ],
    blockHandlers: [
      {
        handler: 'handleLpTransferStart',
        filter: {
          kind: 'once',
        },
      },
    ],
    eventHandlers: [],
    file: './src/mappingLpTransfer.ts',
  },
}

const BladePoolRegisterTemplate: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'BladePoolRegister',
  source: {
    abi: 'BladePoolRegisterV0',
  },
  mapping: {
    kind: 'ethereum/events',
    apiVersion: '0.0.9',
    language: 'wasm/assemblyscript',
    entities: ['Pool', 'PoolLpTransfer'],
    abis: [
      {
        name: 'BladePoolRegisterV0',
        file: './abis/BladePoolRegisterV0.json',
      },
    ],
    eventHandlers: [
      {
        event: 'BladeLPTransferCreated(indexed address,indexed address,indexed address)',
        handler: 'handleBladeLPTransferCreated',
      },
      {
        event: 'BladePermitRouterCreated(indexed address,indexed address)',
        handler: 'handleBladePermitRouterCreated',
      },
      {
        event: 'BladeVerifiedExchangeCreated(indexed address,address[],address[])',
        handler: 'handleBladeVerifiedExchangeCreated',
      },
    ],
    file: './src/mappingBladePoolRegister.ts',
  },
}

const BladeCommonExchangeV0Template: Omit<DataSourceTemplate, 'network'> = {
  kind: 'ethereum/contract',
  name: 'BladeCommonExchangeV0',
  source: { abi: 'BladeCommonExchangeV0' },
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
      'PriceAggregatorProxy',
    ],
    abis: [
      {
        name: 'BladeCommonExchangeV0',
        file: './abis/BladeCommonExchangeV0.json',
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
    blockHandlers: [
      {
        handler: 'handlePoolStart',
        filter: {
          kind: 'once'
        }
      }
    ],
    eventHandlers: [
      {
        event: 'Deposited(indexed address,uint256,uint256)',
        handler: 'handleDeposited',
        calls: {
          'BladeCommonExchange.allTokensBalance': 'BladeCommonExchangeV0[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Withdrawn(indexed address,uint256,uint256)',
        handler: 'handleWithdrawn',
        calls: {
          'BladeCommonExchange.allTokensBalance': 'BladeCommonExchangeV0[event.address].allTokensBalance()',
        },
      },
      {
        event: 'AssetWithdrawn(indexed address,uint256,indexed address,uint256)',
        handler: 'handleSingleAssetWithdrawn',
        calls: {
          'BladeCommonExchange.allTokensBalance': 'BladeCommonExchangeV0[event.address].allTokensBalance()',
        },
      },
      {
        event: 'Swapped(indexed address,indexed address,indexed address,uint256,uint256,bytes)',
        handler: 'handleSwapped',
        calls: {
          'BladeCommonExchange.allTokensBalance': 'BladeCommonExchangeV0[event.address].allTokensBalance()',
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

// Generates the SubgraphManifest object
export function generateSubgraphManifest(config: SubgraphsManifestDeploymentBase): SubgraphManifest {
  const templates: DataSourceTemplate[] = [
    { network: config.networkName, ...ClipperCommonExchangeV0Template },
    { network: config.networkName, ...ClipperCoveTemplate },
    { network: config.networkName, ...PriceOracleTemplate },
    { network: config.networkName, ...VaultFarmTemplate },
    { network: config.networkName, ...VaultProtocolDepositTemplate },
    { network: config.networkName, ...VaultFeeSplitTemplate },
    { network: config.networkName, ...LpTransferTemplate },
    { network: config.networkName, ...BladePoolRegisterTemplate },
    { network: config.networkName, ...BladeCommonExchangeV0Template },
  ]
  const dataSources: DataSource[] = []

  // Add pool data sources
  for (const sourceAbi of PoolSourceAbiSet.values()) {
    if (sourceAbi === 'ClipperCommonExchangeV0') {
      for (const pool of config.poolsBySourceAbi.ClipperCommonExchangeV0 || []) {
        // Get handlers other than Transfer
        const baseEventHandlers = (ClipperCommonExchangeV0Template.mapping.eventHandlers || []).flatMap(
          ({ calls, ...handler }) => {
            if (handler.handler === 'handleTransfer') {
              return []
            }
            return [
              {
                ...handler,
                ...(pool.contractAbiName !== 'ClipperDirectExchangeV0' ? { calls } : {}),
              },
            ]
          },
        )

        // Define the Transfer handler object
        const transferEventHandler = {
          event: 'Transfer(indexed address,indexed address,uint256)',
          handler: 'handleTransfer',
        }

        // Conditionally include the Transfer handler if needed
        const finalEventHandlers =
          pool.permitRouter || pool.feeSplit || pool.farmFeeSplit
            ? [...baseEventHandlers, transferEventHandler]
            : baseEventHandlers

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
            eventHandlers: finalEventHandlers,
          },
        })

        for (const vault of pool.vaults || []) {
          if (vault.type === 'FARM') {
            dataSources.push({
              ...VaultFarmTemplate,
              name: `VaultFarm_${vault.address}`,
              network: config.networkName,
              source: {
                ...VaultFarmTemplate.source,
                address: vault.address,
                startBlock: vault.startBlock,
              },
              context: {
                farmingHelper: { type: 'String', data: vault.farmingHelper },
                abi: { type: 'String', data: vault.abi },
              },
            })
          } else if (vault.type === 'PROTOCOL_DEPOSIT') {
            dataSources.push({
              ...VaultProtocolDepositTemplate,
              name: `VaultProtocolDeposit_${vault.address}`,
              network: config.networkName,
              source: {
                ...VaultProtocolDepositTemplate.source,
                address: vault.address,
                startBlock: vault.startBlock,
              },
              context: {
                transferHelper: { type: 'String', data: vault.transferHelper },
              },
            })
          } else if (vault.type === 'FEE_SPLIT') {
            dataSources.push({
              ...VaultFeeSplitTemplate,
              name: `VaultFeeSplit_${vault.address}`,
              network: config.networkName,
              source: {
                ...VaultFeeSplitTemplate.source,
                address: vault.address,
                startBlock: vault.startBlock,
              },
            })
          }
        }
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
        poolContractAbiName: { type: 'String', data: cove.poolContractAbiName },
      },
    })
  }

  for (const oracle of config.priceOracles) {
    dataSources.push({
      kind: 'ethereum/contract',
      name: `PriceOracleProxy_${oracle.token}`,
      network: config.networkName,
      source: {
        abi: 'AggregatorV3Interface',
        address: oracle.address,
        startBlock: oracle.indexingStartBlock,
      },
      context: {
        proxyAddress: { type: 'String', data: oracle.address },
        tokenAddress: { type: 'String', data: oracle.token },
      },
      mapping: {
        kind: 'ethereum/events',
        apiVersion: '0.0.9',
        language: 'wasm/assemblyscript',
        entities: ['Token', 'Pool', 'PoolToken', 'PoolEvent', 'PriceAggregatorProxy'],
        abis: PriceOracleTemplate.mapping.abis,
        blockHandlers: [
          {
            handler: 'handleProxyStart',
            filter: {
              kind: 'once',
            },
          },
        ],
        file: './src/oracleMapping.ts',
      },
    })
  }

  for (const lpTransfer of config.lpTransfers || []) {
    dataSources.push({
      ...LpTransferTemplate,
      name: `LpTransfer_${lpTransfer.address}`,
      network: config.networkName,
      source: {
        abi: LpTransferTemplate.source.abi,
        address: lpTransfer.address,
        startBlock: lpTransfer.startBlock,
      },
      mapping: LpTransferTemplate.mapping,
    })
  }

  for (const bladePoolRegister of config.registers || []) {
    dataSources.push({
      ...BladePoolRegisterTemplate,
      name: `BladePoolRegister_${bladePoolRegister.address}`,
      network: config.networkName,
      source: {
        abi: BladePoolRegisterTemplate.source.abi,
        address: bladePoolRegister.address,
        startBlock: bladePoolRegister.startBlock,
      },
      mapping: BladePoolRegisterTemplate.mapping,
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

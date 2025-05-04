import fs from 'fs'
import handlebars from 'handlebars'
import path from 'path'
import { Address, isAddress, createPublicClient, http, erc20Abi, Chain } from 'viem'
import * as chains from 'viem/chains'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { fetchDailyPrices } from './fetchHistoricalPricesCryptoCompare'
import { clipperDirectExchangeAbi } from '../ts-abis/ClipperDirectExchange'

interface PoolConfig {
  address: string
  startBlock: number
  feeSplit?: string
  farmFeeSplit?: string
  permitRouter?: string
  farmingHelper?: string
}

interface CoveConfig {
  address: string
  startBlock: number
}

interface PriceOracleConfig {
  tokens: string[]
  address: string
  startBlock: number
}

interface Deployment {
  networkName: string
  prune: number | 'never' | 'auto'

  pools: PoolConfig[]
  coves: CoveConfig[]

  priceOracles: PriceOracleConfig[]

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
const networkChainMap: Record<string, { chain: Chain; rpcUrl?: string }> = {
  matic: { chain: chains.polygon },
  optimism: { chain: chains.optimism },
  moonbeam: { chain: chains.moonbeam },
  mainnet: { chain: chains.mainnet },
  'arbitrum-one': { chain: chains.arbitrum },
  base: { chain: chains.base },
  mantle: { chain: chains.mantle },
  'polygon-zkevm': { chain: chains.polygonZkEvm },
}

// Helper function to validate unique addresses in a config array
function validateUniqueAddresses(addresses: string[], type: string) {
  const addressesSet = new Set<string>()
  for (const address of addresses) {
    const lowerCaseAddress = address.toLowerCase()
    if (addressesSet.has(lowerCaseAddress)) {
      throw new Error(`Duplicate ${type} address found: ${address}`)
    }
    addressesSet.add(lowerCaseAddress)
  }
}

// Helper function to get the deployment for a source
const getDeploymentForSource = (source: string): Deployment => {
  const commonConfig = {
    priceOracles: [] as PriceOracleConfig[],
    pools: [] as PoolConfig[],
    coves: [] as CoveConfig[],
  }

  let deployment: Deployment | null = null

  if (source === 'matic') {
    deployment = {
      ...commonConfig,
      networkName: 'matic',
      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2.15), // 1.5 months of blocks with 2.15s block time

      pools: [
        {
          address: '0x6Bfce69d1Df30FD2B2C8e478EDEC9dAa643Ae3B8',
          startBlock: 27340300,
          permitRouter: '0xF33141BC4E9D1d92a2Adba2fa27A09c2DA2AF3eB',
        },
        {
          address: '0xd01e3549160c62acabc4d0eb89f67aafa3de8eed',
          startBlock: 21032348,
        },
      ],
      coves: [
        {
          address: '0x2370cB1278c948b606f789D2E5Ce0B41E90a756f',
          startBlock: 28486635,
        },
      ],

      addressZeroMap: {
        symbol: 'MATIC',
        decimals: 18,
        name: 'Matic',
        address: '0x0000000000000000000000000000000000000000',
      },

      priceOracles: [
        {
          tokens: ['0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'],
          address: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
          startBlock: 6275354,
        },
        {
          tokens: ['0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'],
          address: '0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6',
          startBlock: 13761599,
        },
        {
          tokens: ['0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'],
          address: '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D',
          startBlock: 6275362,
        },
        {
          tokens: ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
          address: '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
          startBlock: 6275360,
        },
        {
          tokens: ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F'],
          address: '0x0A6513e40db6EB1b165753AD52E80663aeA50545',
          startBlock: 6275356,
        },
        {
          tokens: ['0x482bc619eE7662759CDc0685B4E78f464Da39C73'],
          address: '0xD647a6fC9BC6402301583C91decC5989d8Bc382D',
          startBlock: 15715642,
        },
        {
          tokens: ['0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'],
          address: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
          startBlock: 6275364,
        },
      ],
    }
  }

  if (source === 'optimism') {
    deployment = {
      ...commonConfig,
      networkName: 'optimism',

      pools: [
        {
          address: '0x5130f6cE257B8F9bF7fac0A0b519Bd588120ed40',
          startBlock: 12746008,
          farmingHelper: '0x55f7c152b0C3cc1cD7479e4858Ac07f50D7fcFAD',
          permitRouter: '0xF33141BC4E9D1d92a2Adba2fa27A09c2DA2AF3eB',
        },
        {
          address: '0xdbd4ffc32b34f630dd8ac18d37162ec8462db7db',
          startBlock: 3183055,
        },
      ],
      coves: [
        {
          address: '0x93baB043d534FbFDD13B405241be9267D393b827',
          startBlock: 12747614,
        },
      ],

      addressZeroMap: {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
      },

      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2), // 1.5 months of blocks with 2s block time

      priceOracles: [
        {
          tokens: ['0x4200000000000000000000000000000000000006'],
          address: '0x13e3Ee699D1909E989722E753853AE30b17e08c5',
          startBlock: 2014119,
        },
        {
          tokens: ['0x68f180fcCe6836688e9084f035309E29Bf0A2095'],
          address: '0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593',
          startBlock: 2014377,
        },
        {
          tokens: ['0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'],
          address: '0x8dBa75e83DA73cc766A7e5a0ee71F656BAb470d6',
          startBlock: 2771253,
        },
        {
          tokens: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
          address: '0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3',
          startBlock: 2771613,
        },
        {
          tokens: ['0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'],
          address: '0xECef79E109e997bCA29c1c0897ec9d7b03647F5E',
          startBlock: 2771389,
        },
        {
          tokens: ['0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6'],
          address: '0xCc232dcFAAE6354cE191Bd574108c1aD03f86450',
          startBlock: 2014329,
        },
        {
          tokens: ['0x4200000000000000000000000000000000000042'],
          address: '0x0D276FC14719f9292D5C1eA2198673d1f4269246',
          startBlock: 13259747,
        },
      ],

      fallbackPrices: {
        // OP as of 6/20/2022
        ['0x4200000000000000000000000000000000000042'.toLowerCase()]: 0.52,
        
      },
    }
  }

  if (source === 'moonbeam') {
    deployment = {
      ...commonConfig,
      networkName: 'moonbeam',
      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 6), // 1.5 months of blocks with 6s block time

      pools: [
        {
          address: '0xCE37051a3e60587157DC4c0391B4C555c6E68255',
          startBlock: 855590,
        },
        {
          address: '0xe90d415af331237ae18a882ec21870f1965be933',
          startBlock: 576698,
        },
      ],
      coves: [
        {
          address: '0x3309a431de850Ec554E5F22b2d9fC0B245a2023e',
          startBlock: 1054979,
        },
      ],

      addressZeroMap: {
        symbol: 'GLMR',
        decimals: 18,
        name: 'GLMR token',
        address: '0x0000000000000000000000000000000000000802',
      },

      priceOracles: [
        {
          tokens: ['0x30D2a9F5FDf90ACe8c17952cbb4eE48a55D916A7'],
          address: '0x9ce2388a1696e22F870341C3FC1E89710C7569B5',
          startBlock: 869081,
        },
        {
          tokens: ['0x1DC78Acda13a8BC4408B207c9E48CDBc096D95e0'],
          address: '0x8c4425e141979c66423A83bE2ee59135864487Eb',
          startBlock: 869101,
        },
        {
          tokens: ['0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'],
          address: '0xA122591F60115D63421f66F752EF9f6e0bc73abC',
          startBlock: 869161,
        },
        {
          tokens: ['0x8e70cD5B4Ff3f62659049e74b6649c6603A0E594'],
          address: '0xD925C5BF88Bd0ca09312625d429240F811b437c6',
          startBlock: 2806696,
        },
        {
          tokens: ['0xc234A67a4F840E61adE794be47de455361b52413'],
          address: '0x6063e1037B1afDA2bE5A3340757261E4d6a402ac',
          startBlock: 3535022,
        },
        {
          tokens: ['0x0000000000000000000000000000000000000802'],
          address: '0x4497B606be93e773bbA5eaCFCb2ac5E2214220Eb',
          startBlock: 869142,
        },
      ],

      fallbackPrices: {
        // GLMR as of 4/19/2022
        ['0x0000000000000000000000000000000000000802'.toLowerCase()]: 4.20,
        // MOVR as of 9/03/2025
        ['0x1d4c2a246311bb9f827f4c768e277ff5787b7d7e'.toLowerCase()]: 6.12,
        // USDC
        ['0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'.toLowerCase()]: 1.00,
        // USDT
        ['0x8e70cD5B4Ff3f62659049e74b6649c6603A0E594'.toLowerCase()]: 1.00,
        // WETH
        ['0x30D2a9F5FDf90ACe8c17952cbb4eE48a55D916A7'.toLowerCase()]: 2000,
        // WBTC
        ['0x1DC78Acda13a8BC4408B207c9E48CDBc096D95e0'.toLowerCase()]: 50000,
        // DAI
        ['0xc234A67a4F840E61adE794be47de455361b52413'.toLowerCase()]: 1.00,
      },
    }
  }

  if (source === 'ethereum') {
    deployment = {
      ...commonConfig,
      networkName: 'mainnet',

      pools: [
        {
          address: '0x655eDCE464CC797526600a462A8154650EEe4B77',
          startBlock: 16908406,
          feeSplit: '0x84f4625C3E92b368E403cB002A9bF9bc7a9ae1b9',
          farmFeeSplit: '0xD0454428ecd868A9AC615125FCbDB5Da9027436e',
        },
        {
          address: '0xe7b0ce0526fbe3969035a145c9e9691d4d9d216c',
          startBlock: 15277939,
          feeSplit: '0x51b0efa27ff4f29f8315496f01952377d581ce73',
        },
        {
          address: '0xcc12532e95c2a6a4c53af153b9b739a3cc9218a7',
          startBlock: 14461923,
        },
      ],
      coves: [
        {
          address: '0x44d097113DBEad613fde74b387081FB3b547C54f',
          startBlock: 15819271,
        },
      ],

      addressZeroMap: {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
      },

      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 12), // 1.5 months of blocks with 12s block time

      priceOracles: [
        {
          tokens: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
          address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
          startBlock: 10606501,
        },
        {
          tokens: ['0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'],
          address: '0xf4030086522a5beea4988f8ca5b36dbc97bee88c',
          startBlock: 10606501,
        },
        {
          tokens: ['0x6B175474E89094C44Da98b954EedeAC495271d0F'],
          address: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
          startBlock: 10606501,
        },
        {
          tokens: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
          address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
          startBlock: 11869355,
        },
        {
          tokens: ['0xdAC17F958D2ee523a2206206994597C13D831ec7'],
          address: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
          startBlock: 11870289,
        },
      ],
    }
  }

  if (source === 'arbitrum') {
    deployment = {
      ...commonConfig,
      networkName: 'arbitrum-one',

      pools: [
        {
          address: '0x769728b5298445BA2828c0f3F5384227fbF590C5',
          startBlock: 117111604,
          permitRouter: '0x93a5943e3091e94aA16f0813BB6901C3E9D4eB98',
        },
        {
          address: '0xe7b0ce0526fbe3969035a145c9e9691d4d9d216c',
          startBlock: 30861559,
        },
      ],
      coves: [
        {
          address: '0xB873921b1ADd94ea47Bf983B060CE812e97873df',
          startBlock: 117186034,
        },
        {
          address: '0x9e233dd6a90678baacd89c05ce5c48f43fcc106e',
          startBlock: 31065917,
        },
      ],

      addressZeroMap: {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
      },

      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 0.25), // 1.5 months of blocks with 0.25s block time

      priceOracles: [
        {
          tokens: ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'],
          address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
          startBlock: 101490,
        },
        {
          tokens: ['0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'],
          address: '0x6ce185860a4963106506C203335A2910413708e9',
          startBlock: 101519,
        },
        {
          tokens: ['0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'],
          address: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB',
          startBlock: 101809,
        },
        {
          tokens: ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831'],
          address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
          startBlock: 101256,
        },
        {
          tokens: ['0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'],
          address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
          startBlock: 101256,
        },
        {
          tokens: ['0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'],
          address: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
          startBlock: 101979,
        },
        {
          tokens: ['0x912CE59144191C1204E64559FE8253a0e49E6548'],
          address: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
          startBlock: 73228817,
        },
      ],
    }
  }

  if (source === 'base') {
    deployment = {
      ...commonConfig,
      networkName: 'base',

      pools: [
        {
          address: '0xb32D856cAd3D2EF07C94867A800035E37241247C',
          startBlock: 11871349,
          permitRouter: '0x41c5362ADf3a2Cf6815454F7633172e7F6C1f834',
        },
      ],

      addressZeroMap: {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
      },

      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2), // 1.5 months of blocks with 2s block time

      priceOracles: [
        {
          tokens: ['0x4200000000000000000000000000000000000006'],
          address: '0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70',
          startBlock: 2092862,
        },
        {
          tokens: ['0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'],
          address: '0x591e79239a7d679378ec8c847e5038150364c78f',
          startBlock: 2105150,
        },
        {
          tokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
          address: '0x7e860098f58bbfc8648a4311b374b1d669a2bc6b',
          startBlock: 2093500,
        },
      ],
    }
  }

  if (source === 'mantle') {
    deployment = {
      ...commonConfig,
      networkName: 'mantle',

      pools: [
        {
          address: '0x769728b5298445BA2828c0f3F5384227fbF590C5',
          startBlock: 5192720,
          permitRouter: '0x98898Bc1975e369345519b6C11c9A1F8A37AB877',
        },
      ],

      addressZeroMap: {
        symbol: 'MNT',
        decimals: 18,
        name: 'Mantle',
        address: '0x0000000000000000000000000000000000000000',
      },

      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2), // 1.5 months of blocks with 2s block time

      priceOracles: [
        {
          tokens: ['0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111'],
          address: '0x5bc7Cf88EB131DB18b5d7930e793095140799aD5',
          startBlock: 74405378,
        },
        {
          tokens: ['0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2'],
          address: '0x7db2275279F52D0914A481e14c4Ce5a59705A25b',
          startBlock: 74402393,
        },
        {
          tokens: ['0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9'],
          address: '0x22b422CECb0D4Bd5afF3EA999b048FA17F5263bD',
          startBlock: 74405888,
        },
        {
          tokens: ['0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE'],
          address: '0xd86048D5e4fe96157CE03Ae519A9045bEDaa6551',
          startBlock: 74406306,
        },
        {
          tokens: ['0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'],
          address: '0xD97F20bEbeD74e8144134C4b148fE93417dd0F96',
          startBlock: 74406588,
        },
      ],
    }
  }

  if (source === 'polygon-zkevm') {
    deployment = {
      ...commonConfig,
      networkName: 'polygon-zkevm',
      prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 3.2), // 1.5 months of blocks with 3.2s block time

      pools: [
        {
          address: '0xae00af61be6861ee956c8e56bf22144d024acb57',
          startBlock: 16665923,
        },
        {
          address: '0xe38c90a0233f18749fb74e595c4de871e5498c13',
          startBlock: 15320389,
        },
      ],

      coves: [
        {
          address: '0x097Bf4a933747679698A97A9145Ce2c7f3c46042',
          startBlock: 16665927,
        },
      ],

      addressZeroMap: {
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
      },

      priceOracles: [
        {
          tokens: ['0x22B21BedDef74FE62F031D2c5c8F7a9F8a4b304D'],
          address: '0x44285b60Cc13557935CA4945d20475BD1f1058f4',
          startBlock: 15743026,
        },
        {
          tokens: ['0xa2036f0538221a77A3937F1379699f44945018d0'],
          address: '0x7C85dD6eBc1d318E909F22d51e756Cf066643341',
          startBlock: 4931870,
        },
        {
          tokens: ['0x37eAA0eF3549a5Bb7D431be78a3D99BD360d19e5'],
          address: '0x0167D934CB7240e65c35e347F00Ca5b12567523a',
          startBlock: 4931982,
        },
      ],
    }
  }

  if (!deployment) {
    throw new Error('Unsupported deployment')
  }

  // Validate for duplicate addresses after constructing the deployment object
  validateUniqueAddresses(deployment.pools.map(p => p.address), 'pool')
  validateUniqueAddresses(deployment.coves.map(c => c.address), 'cove')
  validateUniqueAddresses(deployment.priceOracles.map(o => o.address), 'price oracle')

  const allOracleTokens = deployment.priceOracles.flatMap(o => o.tokens)
  validateUniqueAddresses(allOracleTokens, 'price oracle token')

  return deployment
}

type HandlebarsDeployment = Deployment & {
  priceOracles: (PriceOracleConfig & { indexingStartBlock: number })[]
  // Add daily fallback prices
  dailyFallbackPrices?: {
    [tokenAddress: string]: {
      tokenAddress: string
      timestamp: number
      price: number
    }[]
  }
}

function transformDeployment(deployment: Deployment): HandlebarsDeployment {
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
    priceOracles,
  }
}

// Define type for fetched data (adjust if needed based on fetchDailyPrices output)
type FetchedDailyPrices = Awaited<ReturnType<typeof fetchDailyPrices>>

// Modify validatePoolTokenPrices signature and return type
async function validatePoolTokenPrices(
  deployment: Deployment,
  fetchedDailyPrices?: FetchedDailyPrices, // Add optional parameter
): Promise<{ deployment: Deployment; symbolToAddresses: Map<string, string[]> }> { // Return symbol map
  console.log(`Validating token pricing for network: ${deployment.networkName}...`)

  const networkConfig = networkChainMap[deployment.networkName]
  if (!networkConfig) {
    console.warn(`Skipping price validation: Unsupported network ${deployment.networkName} for viem client.`)
    return { deployment, symbolToAddresses: new Map<string, string[]>() }
  }

  const client = createPublicClient({
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl), // Use default RPC from chain if rpcUrl is undefined
  })

  // First collect all unique tokens across all pools
  console.log(`Collecting unique tokens from all pools...`)
  const tokenMap = new Map<
    string, // token address
    {
      address: Address
      poolAddresses: string[]
      symbol?: string // Optional symbol for logging purposes only
    }
  >()

  for (const pool of deployment.pools) {
    console.log(`  Scanning pool: ${pool.address}`)
    try {
      const nTokens = (await client.readContract({
        address: pool.address as Address,
        abi: clipperDirectExchangeAbi,
        functionName: 'nTokens',
        args: [],
      })) as bigint

      console.log(`    Found ${nTokens} tokens.`)

      for (let i = 0n; i < nTokens; i++) {
        const tokenAddress = (await client.readContract({
          address: pool.address as Address,
          abi: clipperDirectExchangeAbi,
          functionName: 'tokenAt',
          args: [i],
        })) as Address

        const normalizedAddress = tokenAddress.toLowerCase()
        if (!tokenMap.has(normalizedAddress)) {
          tokenMap.set(normalizedAddress, {
            address: tokenAddress,
            poolAddresses: [pool.address],
          })
        } else {
          const existingEntry = tokenMap.get(normalizedAddress)!
          existingEntry.poolAddresses.push(pool.address)
        }
      }
    } catch (error) {
      console.error(`  ❌ Error scanning pool ${pool.address}:`, error)
      throw new Error(`Failed to scan pool ${pool.address}: ${error}`)
    }
  }

  console.log(`\nFound ${tokenMap.size} unique tokens across all pools.`)

  // Create a map of token addresses to their symbols for logging purposes
  console.log(`\nCollecting token symbols for reference...`)
  const addressToSymbol = new Map<string, string>()
  const symbolToAddresses = new Map<string, string[]>()

  // Get symbols for all tokens for reporting (not for validation)
  for (const [normalizedAddress, tokenInfo] of tokenMap) {
    try {
      const symbol = (await client.readContract({
        address: tokenInfo.address,
        abi: erc20Abi,
        functionName: 'symbol',
      })) as string

      tokenInfo.symbol = symbol
      addressToSymbol.set(normalizedAddress, symbol)

      if (!symbolToAddresses.has(symbol)) {
        symbolToAddresses.set(symbol, [tokenInfo.address])
      } else {
        symbolToAddresses.get(symbol)!.push(tokenInfo.address)
      }

      console.log(`  Token ${tokenInfo.address} (Symbol: ${symbol}).`)
    } catch (symbolError) {
      console.warn(`  ⚠️ Error processing token symbol for ${tokenInfo.address}: ${symbolError}`)
    }
  }

  // Now validate each unique token against oracles
  console.log(`\n--------------------------------------------------`)
  console.log(`Validating token pricing for unique addresses...`)
  console.log(`--------------------------------------------------`)

  // Convert price oracles to address-based lookup
  const oracleAddressByToken = new Map<string, string>(deployment.priceOracles.flatMap(o => o.tokens.map(t => [t.toLowerCase(), o.address.toLowerCase()])))

  // Track which token oracle addresses are used
  const usedOracleTokens = new Set<string>()

  const missingPrices: {
    tokenAddress: string
    symbol?: string
    poolAddresses: string[]
  }[] = []

  // Track tokens with oracle start block issues
  const oracleStartBlockConflicts: {
    tokenAddress: string
    symbol?: string
    poolAddress: string
    poolStartBlock: number
    oracleAddress: string
    oracleStartBlock: number
  }[] = []

  // First check if we have fallback prices for any tokens based on symbol
  const tokenFallbacks = new Set<string>()
  if (deployment.fallbackPrices) {
    for (const [tokenAddress, _] of Object.entries(deployment.fallbackPrices)) {
      tokenFallbacks.add(tokenAddress.toLowerCase())
    }
  }

  // Track tokens using fallback prices
  const tokensUsingFallback: {
    tokenAddress: string
    symbol: string
    fallbackPrice: number | undefined
    poolAddresses: string[]
  }[] = []

  // Validate each token address
  for (const [tokenAddressKey, tokenInfo] of tokenMap) {
    let hasPriceSource = false

    // Check oracle addresses
    if (oracleAddressByToken.has(tokenAddressKey)) {
      console.log(`  ✅ Found price oracle for ${tokenInfo.address}${tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''}`)
      usedOracleTokens.add(tokenAddressKey)
      hasPriceSource = true

      // *** New Validation: Check if oracle start block is after pool start block ***
      const oracleAddress = oracleAddressByToken.get(tokenAddressKey)!;
      const oracleConfig = deployment.priceOracles.find(o => o.address.toLowerCase() === oracleAddress);
      const oracleStartBlock = oracleConfig?.startBlock;

      if (oracleStartBlock !== undefined) {
        const relevantPools = deployment.pools.filter(p => tokenInfo.poolAddresses.includes(p.address));

        for (const pool of relevantPools) {
            if (pool.startBlock < oracleStartBlock) {
                if (tokenFallbacks.has(tokenAddressKey)) {
                    // Oracle starts later, but we HAVE a fallback
                    const fallbackPrice = deployment.fallbackPrices?.[tokenAddressKey];
                    console.warn(
                        `  ⚠️ Using fallback price ($${fallbackPrice ?? 'Not Found'}) for ${tokenInfo.address}${tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''} in pool ${pool.address} between block ${pool.startBlock} and oracle start block ${oracleStartBlock}.\n`
                    );
                } else {
                    // Oracle starts later, and we DON'T have a fallback - this is a problem
                    console.warn(
                        `  ❌ Oracle/Pool Start Block Conflict: Token ${tokenInfo.address}${tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''} in pool ${pool.address} (starts ${pool.startBlock}) has oracle ${oracleAddress} starting later (${oracleStartBlock}) with NO fallback price.\n`
                    )
                    oracleStartBlockConflicts.push({
                        tokenAddress: tokenInfo.address,
                        symbol: tokenInfo.symbol,
                        poolAddress: pool.address,
                        poolStartBlock: pool.startBlock,
                        oracleAddress: oracleAddress,
                        oracleStartBlock: oracleStartBlock,
                    });
                }
            }
        }
      }
      // *** End New Validation ***
    }

    // Check fallback prices based on symbol (only if we have a symbol)
    else if (tokenInfo.symbol && tokenFallbacks.has(tokenAddressKey)) {
      const fallbackPrice = deployment.fallbackPrices?.[tokenAddressKey]
      console.log(`  ✅ Found fallback price for ${tokenInfo.address} (${tokenInfo.symbol})`)
      console.warn(
        `  ⚠️ Warning: Using fallback price $${fallbackPrice} for token ${tokenInfo.address} (${tokenInfo.symbol}) instead of an oracle\n`,
      )
      hasPriceSource = true

      // Track this token for the fallback report
      tokensUsingFallback.push({
        tokenAddress: tokenInfo.address,
        symbol: tokenInfo.symbol,
        fallbackPrice,
        poolAddresses: tokenInfo.poolAddresses,
      })
    }

    // No price source found
    if (!hasPriceSource) {
      console.error(
        `  ❌ Missing price oracle or fallback for ${tokenInfo.address}${
          tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''
        }\n`,
      )
      missingPrices.push({
        tokenAddress: tokenInfo.address,
        symbol: tokenInfo.symbol,
        poolAddresses: tokenInfo.poolAddresses,
      })
    }
  }

  // Display fallback price report if any tokens are using fallbacks
  if (tokensUsingFallback.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(`Warning: ${tokensUsingFallback.length} tokens using fallback prices`)
    console.warn(`--------------------------------------------------`)
    tokensUsingFallback.forEach(token => {
      console.warn(`- Token: ${token.tokenAddress} (${token.symbol})`)
      console.warn(`  Fallback price: $${token.fallbackPrice}`)
      console.warn(`  Affected Pools:`)
      token.poolAddresses.forEach((poolAddress, index) => {
        console.warn(`    ${index + 1}. ${poolAddress}`)
      })
    })
    console.warn(`--------------------------------------------------`)
    console.warn(`Consider implementing price oracles for these tokens for more accurate pricing.`)
  }

  // Check for unused price oracles
  console.log(`\nChecking for unused price oracles...`)
  const unusedOracles = deployment.priceOracles.filter(oracle => oracle.tokens.every(t => !usedOracleTokens.has(t.toLowerCase())))

  if (unusedOracles.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(`Warning: Found ${unusedOracles.length} unused price oracles`)
    console.warn(`--------------------------------------------------`)
    unusedOracles.forEach(oracle => {
      oracle.tokens.forEach(token => {
        console.warn(`- Token: ${token}. Oracle: ${oracle.address}`)
      })
    })
    console.warn(`--------------------------------------------------`)
    console.warn(`These price oracles are configured but not used by any token in the pools.`)
    console.warn(`Consider removing them if they're not needed.`)
  }

  // Report Oracle/Pool Start Block Conflicts
  if (oracleStartBlockConflicts.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(`Warning: Found ${oracleStartBlockConflicts.length} Oracle/Pool Start Block Conflicts (Oracle starts after Pool, no fallback)`)
    console.warn(`--------------------------------------------------`)
    oracleStartBlockConflicts.forEach(conflict => {
        console.warn(`- Token: ${conflict.tokenAddress}${conflict.symbol ? ` (${conflict.symbol})` : ''}`)
        console.warn(`  Pool: ${conflict.poolAddress} (Starts Block: ${conflict.poolStartBlock})`)
        console.warn(`  Oracle: ${conflict.oracleAddress} (Starts Block: ${conflict.oracleStartBlock})`)
        console.warn(`  Action: Provide a fallback price for this token or adjust start blocks.`)
    })
    console.warn(`--------------------------------------------------`)
    // Decide if this should be a hard error or just a warning. Currently warning.
    // To make it an error, uncomment the next line:
    // throw new Error('Oracle/Pool start block conflicts found.');
  }

  if (missingPrices.length > 0) {
    console.error('\n--------------------------------------------------')
    console.error('Validation Failed: Missing Price Information')
    console.error('--------------------------------------------------')
    missingPrices.forEach(m => {
      console.error(`- Token: ${m.tokenAddress}${m.symbol ? ` (${m.symbol})` : ''}`)
      console.error(`  Affected Pools:`)
      m.poolAddresses.forEach((poolAddress, index) => {
        console.error(`    ${index + 1}. ${poolAddress}`)
      })
    })
    console.error('--------------------------------------------------')
    console.error('Please add corresponding price oracles or fallback prices to the deployment configuration.')
    throw new Error('Token price validation failed.')
  } else {
    console.log('\n✅ Token price validation successful.')
  }

  // Return the original deployment and the symbol map
  return { deployment, symbolToAddresses }
}

yargs(hideBin(process.argv))
  .command(
    'template',
    'Generate files from templates using the deployment addresses.',
    yargs => {
      return yargs
        .option('deployment', {
          type: 'string',
          default: 'matic',
          description: 'The deployment to update',
        })
        .option('fallback-prices-start-date', {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format for fetching daily fallback prices',
        })
        .option('fallback-prices-end-date', {
          type: 'string',
          description: 'End date in YYYY-MM-DD format for fetching daily fallback prices',
        })
        .option('fallback-prices-tokens', {
          type: 'array',
          description: 'Tokens to fetch fallback prices for',
        })
        .option('fallback-prices-output', {
          type: 'string',
          default: './prices.json',
          description: 'Path to save the raw fallback price data',
        })
        .option('skip-validation', {
          type: 'boolean',
          default: false,
          description: 'Skip validation of token prices',
        })
    },
    async args => {
      let deploymentJson: HandlebarsDeployment

      handlebars.registerHelper('ifAddress', function(possibleAddress: string, options: any) {
        if (isAddress(possibleAddress)) {
          return options.fn(this)
        } else {
          return options.inverse(this)
        }
      })

      // Check if we need to fetch daily fallback prices
      if (args['fallback-prices-start-date'] && args['fallback-prices-end-date']) {
        const startDate = args['fallback-prices-start-date'] as string
        const endDate = args['fallback-prices-end-date'] as string
        const tokens = args['fallback-prices-tokens'] as string[]
        const outputPath = args['fallback-prices-output'] as string

        console.log(`Fetching or loading daily fallback prices for symbols: ${tokens.join(', ')} from ${startDate} to ${endDate}...`)
        let fetchedDailyPricesData: FetchedDailyPrices | undefined
        try {
          // Fetch or load daily prices (symbol-keyed)
          if (fs.existsSync(outputPath)) {
            console.log(`Loading existing price data from ${outputPath}...`)
            const rawData = fs.readFileSync(outputPath, 'utf8')
            fetchedDailyPricesData = JSON.parse(rawData)
          } else {
            console.log('No existing price data found, fetching from API...')
            // Ensure fetchDailyPrices returns data keyed by SYMBOL
            fetchedDailyPricesData = await fetchDailyPrices(tokens, startDate, endDate)

            const outputDir = path.dirname(outputPath)
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
            fs.writeFileSync(outputPath, JSON.stringify(fetchedDailyPricesData, null, 2))
            console.log(`Raw fallback price data saved to ${outputPath}`)
          }

          let deployment = getDeploymentForSource(args.deployment)
          // *** Validate BEFORE adding daily prices to deployment ***
          console.log('Validating deployment with fetched daily prices...')
          const { deployment: validatedDeployment, symbolToAddresses } = await validatePoolTokenPrices(
            deployment,
            fetchedDailyPricesData
          )
          deployment = validatedDeployment
          let addressKeyedDailyPrices: NonNullable<HandlebarsDeployment['dailyFallbackPrices']> = {}

          // *** Transform fetched prices (symbol->address) and add to deployment ***
          if (fetchedDailyPricesData) {
            console.log('Mapping fetched daily prices from symbols to addresses...')
            for (const [timestamp, dayPrices] of Object.entries(fetchedDailyPricesData)) {
              // For each symbol->price pair in the day's prices
              for (const [symbol, price] of Object.entries(dayPrices)) {
                const addresses = symbolToAddresses.get(symbol)
                if (addresses && addresses.length > 0) {
                  // Map the price to each address for this symbol
                  for (const address of addresses) {
                    if (!addressKeyedDailyPrices[address]) {
                      addressKeyedDailyPrices[address] = []
                    }
                    addressKeyedDailyPrices[address].push({
                      timestamp: parseInt(timestamp),
                      price: price as number,
                      tokenAddress: address,
                    })
                  }
                } else {
                  // Check if the symbol was requested but not found in any pool
                  console.warn(`  ⚠️ Could not map symbol ${symbol} from fetched daily prices to a token address found in the deployment's pools. It might not be used.`)
                }
              }
            }
          }

          deploymentJson = transformDeployment(deployment)
          deploymentJson.dailyFallbackPrices = addressKeyedDailyPrices
        } catch (error) {
          console.error('Error during daily fallback price fetching, validation, or processing:', error)
          process.exit(1)
        }
      } else {
        let deployment = getDeploymentForSource(args.deployment)
        // No daily prices to fetch
        if (!args['skip-validation']) {
          // Validate without fetched prices
          const { deployment: validatedDeployment } = await validatePoolTokenPrices(deployment)
          deployment = validatedDeployment
        }
        // Transform deployment (won't have dailyFallbackPrices unless manually added)
        deploymentJson = transformDeployment(deployment)
      }

      {
        console.log('Generating subgraph manifest')

        const templateFile = path.join(__dirname, '../templates/subgraph.yml.hbs')
        const outputFile = path.join(__dirname, '../subgraph.yaml')
        const templateContent = fs.readFileSync(templateFile, 'utf8')

        const compile = handlebars.compile(templateContent)
        const replaced = compile(deploymentJson)

        fs.writeFileSync(outputFile, replaced)
      }

      {
        console.log('Generating static address map')
        const templateFile = path.join(__dirname, '../templates/addresses.ts.hbs')
        const outputFile = path.join(__dirname, '../src/addresses.ts')
        const templateContent = fs.readFileSync(templateFile, 'utf8')

        const compile = handlebars.compile(templateContent)
        const replaced = compile(deploymentJson)

        fs.writeFileSync(outputFile, replaced)
      }
    },
  )
  .help().argv

import fs from 'fs'
import handlebars from 'handlebars'
import path from 'path'
import { isAddress } from 'viem/utils'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { fetchDailyPrices } from './fetchHistoricalPricesCryptoCompare'

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
  symbol: string
  address: string
  startBlock?: number
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
    [token: string]: number | undefined
  }

  // Add daily fallback prices
  dailyFallbackPrices?: {
    [timestamp: string]: {
      [token: string]: number | undefined
    }
  }
}

// Helper function to get the deployment for a source
const getDeploymentForSource = (source: string): Deployment => {
  const commonConfig = {
    priceOracles: [] as PriceOracleConfig[],
    prune: 'auto' as const,
    fallbackPrices: {
      DAI: 1,
      USDC: 1,
      USDT: 1,
    },
    pools: [] as PoolConfig[],
    coves: [] as CoveConfig[],
  }

  if (source === 'matic') {
    return {
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
        { symbol: 'WETH', address: '0xF9680D99D6C9589e2a93a78A04A279e509205945' },
        { symbol: 'WBTC', address: '0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6' },
        { symbol: 'DAI', address: '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D' },
        { symbol: 'USDC', address: '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7' },
        { symbol: 'USDT', address: '0x0A6513e40db6EB1b165753AD52E80663aeA50545' },
        { symbol: 'GYEN', address: '0xD647a6fC9BC6402301583C91decC5989d8Bc382D' },
        { symbol: 'MATIC', address: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0' },
        { symbol: 'WMATIC', address: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0' },
      ],
    }
  }

  if (source === 'optimism') {
    return {
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
        { symbol: 'WETH', address: '0x13e3Ee699D1909E989722E753853AE30b17e08c5' },
        { symbol: 'WBTC', address: '0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593' },
        { symbol: 'DAI', address: '0x8dBa75e83DA73cc766A7e5a0ee71F656BAb470d6' },
        { symbol: 'USDC', address: '0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3' },
        { symbol: 'USDT', address: '0xECef79E109e997bCA29c1c0897ec9d7b03647F5E' },
        { symbol: 'LINK', address: '0xCc232dcFAAE6354cE191Bd574108c1aD03f86450' },
        { symbol: 'OP', address: '0x0D276FC14719f9292D5C1eA2198673d1f4269246' },
      ],
    }
  }

  if (source === 'moonbeam') {
    return {
      ...commonConfig,
      networkName: 'moonbeam',

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
        { symbol: 'WETH', address: '0x9ce2388a1696e22F870341C3FC1E89710C7569B5' },
        { symbol: 'WBTC', address: '0x8c4425e141979c66423A83bE2ee59135864487Eb' },
        { symbol: 'USDC', address: '0xA122591F60115D63421f66F752EF9f6e0bc73abC' },
        { symbol: 'USDT', address: '0xD925C5BF88Bd0ca09312625d429240F811b437c6' },
        { symbol: 'DAI', address: '0x6063e1037B1afDA2bE5A3340757261E4d6a402ac' },
        { symbol: 'DOT', address: '0x1466b4bD0C4B6B8e1164991909961e0EE6a66d8c' },
        { symbol: 'GLMR', address: '0x4497B606be93e773bbA5eaCFCb2ac5E2214220Eb' },
      ],
    }
  }

  if (source === 'ethereum') {
    return {
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
        { symbol: 'WETH', address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' },
        { symbol: 'WBTC', address: '0xf4030086522a5beea4988f8ca5b36dbc97bee88c' },
        { symbol: 'DAI', address: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9' },
        { symbol: 'USDC', address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6' },
        { symbol: 'USDT', address: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D' },
      ],
    }
  }

  if (source === 'arbitrum') {
    return {
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
        { symbol: 'WETH', address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612' },
        { symbol: 'WBTC', address: '0x6ce185860a4963106506C203335A2910413708e9' },
        { symbol: 'DAI', address: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB' },
        { symbol: 'USDC', address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3' },
        { symbol: 'USDT', address: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7' },
        { symbol: 'ARB', address: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6' },
      ],
    }
  }

  if (source === 'base') {
    return {
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
        { symbol: 'WETH', address: '0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70' },
        { symbol: 'WBTC', address: '0xccadc697c55bbb68dc5bcdf8d3cbe83cdd4e071e' },
        { symbol: 'DAI', address: '0x591e79239a7d679378ec8c847e5038150364c78f' },
        { symbol: 'USDC', address: '0x7e860098f58bbfc8648a4311b374b1d669a2bc6b' },
      ],
    }
  }

  if (source === 'mantle') {
    return {
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
        { symbol: 'WETH', address: '0x5bc7Cf88EB131DB18b5d7930e793095140799aD5', startBlock: 74405378 },
        { symbol: 'WBTC', address: '0x7db2275279F52D0914A481e14c4Ce5a59705A25b', startBlock: 74402393 },
        { symbol: 'USDC', address: '0x22b422CECb0D4Bd5afF3EA999b048FA17F5263bD', startBlock: 74405888 },
        { symbol: 'USDT', address: '0xd86048D5e4fe96157CE03Ae519A9045bEDaa6551', startBlock: 74406306 },
        { symbol: 'MNT', address: '0xD97F20bEbeD74e8144134C4b148fE93417dd0F96', startBlock: 74406588 },
      ],
    }
  }

  throw new Error('Unsupported deployment')
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
    },
    async args => {
      let deploymentJson: any

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

        console.log(`Fetching daily fallback prices for ${tokens.join(', ')} from ${startDate} to ${endDate}...`)

        try {
          // Fetch daily prices
          const dailyPrices = await fetchDailyPrices(tokens, startDate, endDate)

          // Save raw price data
          fs.writeFileSync(outputPath, JSON.stringify(dailyPrices, null, 2))
          console.log(`Raw fallback price data saved to ${outputPath}`)

          // Format prices for deployment config
          // Get deployment with daily fallback prices
          deploymentJson = getDeploymentForSource(args.deployment)
          deploymentJson.dailyFallbackPrices = dailyPrices
        } catch (error) {
          console.error('Error fetching daily fallback prices:', error)
          process.exit(1)
        }
      } else {
        // Get deployment without daily fallback prices
        deploymentJson = getDeploymentForSource(args.deployment)
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

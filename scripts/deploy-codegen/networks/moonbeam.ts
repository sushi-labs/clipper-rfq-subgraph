import { Deployment } from '../config'

export function getMoonbeamDeploymentConfig(): Deployment {
  return {
    networkName: 'moonbeam',
    prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 6), // 1.5 months of blocks with 6s block time

    pools: [
      {
        address: '0xCE37051a3e60587157DC4c0391B4C555c6E68255',
        startBlock: 855590,
        contractAbiName: 'ClipperVerifiedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
      {
        address: '0xe90d415af331237ae18a882ec21870f1965be933',
        startBlock: 576698,
        contractAbiName: 'ClipperDirectExchangeV1',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    coves: [
      {
        address: '0x3309a431de850Ec554E5F22b2d9fC0B245a2023e',
        startBlock: 1054979,
        contractAbiName: 'ClipperCove',
        sourceAbi: 'ClipperCove',
        poolContractAbiName: 'ClipperVerifiedExchange',
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
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x1DC78Acda13a8BC4408B207c9E48CDBc096D95e0'],
        address: '0x8c4425e141979c66423A83bE2ee59135864487Eb',
        startBlock: 869101,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'],
        address: '0xA122591F60115D63421f66F752EF9f6e0bc73abC',
        startBlock: 869161,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x8e70cD5B4Ff3f62659049e74b6649c6603A0E594'],
        address: '0xD925C5BF88Bd0ca09312625d429240F811b437c6',
        startBlock: 2806696,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xc234A67a4F840E61adE794be47de455361b52413'],
        address: '0x6063e1037B1afDA2bE5A3340757261E4d6a402ac',
        startBlock: 3535022,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x0000000000000000000000000000000000000802'],
        address: '0x4497B606be93e773bbA5eaCFCb2ac5E2214220Eb',
        startBlock: 869142,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],

    fallbackPrices: {
      // GLMR as of 4/19/2022
      ['0x0000000000000000000000000000000000000802'.toLowerCase()]: 4.2,
      // MOVR as of 9/03/2025
      ['0x1d4c2a246311bb9f827f4c768e277ff5787b7d7e'.toLowerCase()]: 6.12,
      // USDC
      ['0x8f552a71EFE5eeFc207Bf75485b356A0b3f01eC9'.toLowerCase()]: 1.0,
      // USDT
      ['0x8e70cD5B4Ff3f62659049e74b6649c6603A0E594'.toLowerCase()]: 1.0,
      // WETH
      ['0x30D2a9F5FDf90ACe8c17952cbb4eE48a55D916A7'.toLowerCase()]: 2000,
      // WBTC
      ['0x1DC78Acda13a8BC4408B207c9E48CDBc096D95e0'.toLowerCase()]: 50000,
      // DAI
      ['0xc234A67a4F840E61adE794be47de455361b52413'.toLowerCase()]: 1.0,
    },
  }
}

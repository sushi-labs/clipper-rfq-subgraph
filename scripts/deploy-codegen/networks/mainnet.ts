import { Deployment } from '../config'

export function getMainnetDeploymentConfig(): Deployment {
  return {
    networkName: 'mainnet',
    pools: [
      {
        address: '0x655eDCE464CC797526600a462A8154650EEe4B77',
        startBlock: 16908406,
        feeSplit: '0x84f4625C3E92b368E403cB002A9bF9bc7a9ae1b9',
        farmFeeSplit: '0xD0454428ecd868A9AC615125FCbDB5Da9027436e',
        contractAbiName: 'ClipperApproximateCaravelExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
      {
        address: '0xe7b0ce0526fbe3969035a145c9e9691d4d9d216c',
        startBlock: 15277939,
        feeSplit: '0x51b0efa27ff4f29f8315496f01952377d581ce73',
        contractAbiName: 'ClipperVerifiedCaravelExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
      {
        address: '0xcc12532e95c2a6a4c53af153b9b739a3cc9218a7',
        startBlock: 14461923,
        contractAbiName: 'ClipperCaravelExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    coves: [
      {
        address: '0x44d097113DBEad613fde74b387081FB3b547C54f',
        startBlock: 15819271,
        contractAbiName: 'ClipperCove',
        poolContractAbiName: 'ClipperVerifiedCaravelExchange',
        sourceAbi: 'ClipperCove',
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
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'],
        address: '0xf4030086522a5beea4988f8ca5b36dbc97bee88c',
        startBlock: 10606501,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x6B175474E89094C44Da98b954EedeAC495271d0F'],
        address: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
        startBlock: 10606501,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
        address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
        startBlock: 11869355,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xdAC17F958D2ee523a2206206994597C13D831ec7'],
        address: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
        startBlock: 11870289,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

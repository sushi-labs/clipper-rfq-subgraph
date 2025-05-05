import { Deployment } from '../config'

export function getArbitrumDeploymentConfig(): Deployment {
  return {
    networkName: 'arbitrum-one',
    pools: [
        {
          address: '0x769728b5298445BA2828c0f3F5384227fbF590C5',
          startBlock: 117111604,
          permitRouter: '0x93a5943e3091e94aA16f0813BB6901C3E9D4eB98',
          contractAbiName: 'ClipperPackedVerifiedExchange',
          sourceAbi: 'ClipperCommonExchangeV0',
        },
        {
          address: '0xe7b0ce0526fbe3969035a145c9e9691d4d9d216c',
          startBlock: 30861559,
          contractAbiName: 'ClipperPackedVerifiedExchange',
          sourceAbi: 'ClipperCommonExchangeV0',
        },
      ],
      coves: [
        {
          address: '0xB873921b1ADd94ea47Bf983B060CE812e97873df',
          startBlock: 117186034,
          contractAbiName: 'ClipperCove',
          poolContractAbiName: 'ClipperPackedVerifiedExchange',
          sourceAbi: 'ClipperCove',
        },
        {
          address: '0x9e233dd6a90678baacd89c05ce5c48f43fcc106e',
          startBlock: 31065917,
          contractAbiName: 'ClipperCove',
          poolContractAbiName: 'ClipperPackedVerifiedExchange',
          sourceAbi: 'ClipperCove',
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
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'],
          address: '0x6ce185860a4963106506C203335A2910413708e9',
          startBlock: 101519,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'],
          address: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB',
          startBlock: 101809,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831', '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'],
          address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
          startBlock: 101256,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'],
          address: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
          startBlock: 101979,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0x912CE59144191C1204E64559FE8253a0e49E6548'],
          address: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
          startBlock: 73228817,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
      ],
  }
}

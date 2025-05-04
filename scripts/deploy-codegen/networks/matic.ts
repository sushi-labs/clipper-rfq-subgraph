import { Deployment } from '../config'

export function getMaticDeploymentConfig(): Deployment {
  return {
    networkName: 'matic',
    prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2.15), // 1.5 months of blocks with 2.15s block time

    pools: [
      {
        address: '0x6Bfce69d1Df30FD2B2C8e478EDEC9dAa643Ae3B8',
        startBlock: 27340300,
        permitRouter: '0xF33141BC4E9D1d92a2Adba2fa27A09c2DA2AF3eB',
        contractAbiName: 'ClipperVerifiedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
      {
        address: '0xd01e3549160c62acabc4d0eb89f67aafa3de8eed',
        startBlock: 21032348,
        contractAbiName: 'ClipperDirectExchangeV0',
        /**
         * Compliant with ClipperCommonExchangeV0 but missing AssetWithdrawn event. It will just ignore that event handler
         */
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    coves: [
      {
        address: '0x2370cB1278c948b606f789D2E5Ce0B41E90a756f',
        startBlock: 28486635,
        contractAbiName: 'ClipperCove',
        sourceAbi: 'ClipperCove',
        poolContractAbiName: 'ClipperVerifiedExchange',
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
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'],
        address: '0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6',
        startBlock: 13761599,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'],
        address: '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D',
        startBlock: 6275362,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
        address: '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
        startBlock: 6275360,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F'],
        address: '0x0A6513e40db6EB1b165753AD52E80663aeA50545',
        startBlock: 6275356,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x482bc619eE7662759CDc0685B4E78f464Da39C73'],
        address: '0xD647a6fC9BC6402301583C91decC5989d8Bc382D',
        startBlock: 15715642,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'],
        address: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
        startBlock: 6275364,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

import { Deployment } from '../config'

export function getBaseDeploymentConfig(): Deployment {
  return {
    networkName: 'base',
    pools: [
      {
        address: '0xb32D856cAd3D2EF07C94867A800035E37241247C',
        startBlock: 11871349,
        permitRouter: '0x41c5362ADf3a2Cf6815454F7633172e7F6C1f834',
        contractAbiName: 'ClipperPackedVerifiedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    coves: [],
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
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'],
        address: '0x591e79239a7d679378ec8c847e5038150364c78f',
        startBlock: 2105150,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
        address: '0x7e860098f58bbfc8648a4311b374b1d669a2bc6b',
        startBlock: 2093500,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

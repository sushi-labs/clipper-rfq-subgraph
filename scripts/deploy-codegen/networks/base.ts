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
      {
        address: '0x663fA8731045765067e2B5b6acB19BE2ce974C7f',
        startBlock: 35967593,
        permitRouter: '0xa5fC5A373D66C109f68006A60434D3e798EcF3c6',
        contractAbiName: 'BladeVerifiedExchange',
        sourceAbi: 'BladeCommonExchangeV0',
      },
    ],
    coves: [],
    registers: [
      {
        address: '0x80A06bBAB131eeeb78cac159F9DDEcF8e9a6AbF6',
        startBlock: 37354219,
        sourceAbi: 'BladePoolRegisterV1',
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
      {
        tokens: ['0x820C137fa70C8691f0e44Dc420a5e53c168921Dc'],
        address: '0x2330aaE3bca5F05169d5f4597964D44522F62930',
        startBlock: 23311104,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

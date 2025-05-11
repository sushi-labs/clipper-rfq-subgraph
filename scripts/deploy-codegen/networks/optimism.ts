import { Deployment } from '../config'

export function getOptimismDeploymentConfig(): Deployment {
  return {
    networkName: 'optimism',
    pools: [
      {
        address: '0x5130f6cE257B8F9bF7fac0A0b519Bd588120ed40',
        startBlock: 12746008,
        farmingHelper: '0x55f7c152b0C3cc1cD7479e4858Ac07f50D7fcFAD',
        permitRouter: '0xF33141BC4E9D1d92a2Adba2fa27A09c2DA2AF3eB',
        contractAbiName: 'ClipperPackedVerifiedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
        vaults: [
          {
            type: 'FARM',
            address: '0xAc2B3f9a13E7273639bcDCa55742391CDACC74cB',
            farmingHelper: '0x55f7c152b0C3cc1cD7479e4858Ac07f50D7fcFAD',
            startBlock: 107733812,
            abi: 'LinearVestingVault',
          },
        ],
      },
      {
        address: '0xdbd4ffc32b34f630dd8ac18d37162ec8462db7db',
        startBlock: 3183055,
        contractAbiName: 'ClipperPackedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    lpTransfers: [
      {
        address: '0x8e7903CA4305d2864b8C360da137F900d315E867',
        startBlock: 12747954,
      },
    ],
    coves: [
      {
        address: '0x93baB043d534FbFDD13B405241be9267D393b827',
        startBlock: 12747614,
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

    prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 2), // 1.5 months of blocks with 2s block time

    priceOracles: [
      {
        tokens: ['0x4200000000000000000000000000000000000006'],
        address: '0x13e3Ee699D1909E989722E753853AE30b17e08c5',
        startBlock: 2014119,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x68f180fcCe6836688e9084f035309E29Bf0A2095'],
        address: '0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593',
        startBlock: 2014377,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'],
        address: '0x8dBa75e83DA73cc766A7e5a0ee71F656BAb470d6',
        startBlock: 2771253,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
        address: '0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3',
        startBlock: 2771613,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'],
        address: '0xECef79E109e997bCA29c1c0897ec9d7b03647F5E',
        startBlock: 2771389,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6'],
        address: '0xCc232dcFAAE6354cE191Bd574108c1aD03f86450',
        startBlock: 2014329,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x4200000000000000000000000000000000000042'],
        address: '0x0D276FC14719f9292D5C1eA2198673d1f4269246',
        startBlock: 13259747,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],

    fallbackPrices: {
      // OP as of 6/20/2022
      ['0x4200000000000000000000000000000000000042'.toLowerCase()]: 0.52,
    },
  }
}

import { Deployment } from '../config'

export function getMantleDeploymentConfig(): Deployment {
  return {
    networkName: 'mantle',
    pools: [
      {
        address: '0x769728b5298445BA2828c0f3F5384227fbF590C5',
        startBlock: 5192720,
        permitRouter: '0x98898Bc1975e369345519b6C11c9A1F8A37AB877',
        contractAbiName: 'ClipperPackedVerifiedExchange',
        sourceAbi: 'ClipperCommonExchangeV0',
      },
    ],
    coves: [], // No coves for mantle yet
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
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2'],
        address: '0x7db2275279F52D0914A481e14c4Ce5a59705A25b',
        startBlock: 74402393,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9'],
        address: '0x22b422CECb0D4Bd5afF3EA999b048FA17F5263bD',
        startBlock: 74405888,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE'],
        address: '0xd86048D5e4fe96157CE03Ae519A9045bEDaa6551',
        startBlock: 74406306,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'],
        address: '0xD97F20bEbeD74e8144134C4b148fE93417dd0F96',
        startBlock: 74406588,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

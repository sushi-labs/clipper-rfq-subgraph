import { Deployment } from '../config'

export function getPolygonZkevmDeploymentConfig(): Deployment {
  return {
    networkName: 'polygon-zkevm',
    prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 3.2), // 1.5 months of blocks with 3.2s block time

      pools: [
        {
          address: '0xae00af61be6861ee956c8e56bf22144d024acb57',
          startBlock: 16665923,
          contractAbiName: 'ClipperPackedOracleVerifiedExchange',
          sourceAbi: 'ClipperCommonExchangeV0',
        },
        {
          address: '0xe38c90a0233f18749fb74e595c4de871e5498c13',
          startBlock: 15320389,
          contractAbiName: 'ClipperPackedOracleVerifiedExchange',
          sourceAbi: 'ClipperCommonExchangeV0',
        },
      ],

      coves: [
        {
          address: '0x097Bf4a933747679698A97A9145Ce2c7f3c46042',
          startBlock: 16665927,
          contractAbiName: 'ClipperCove',
          poolContractAbiName: 'ClipperPackedOracleVerifiedExchange',
          sourceAbi: 'ClipperCove',
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
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0xa2036f0538221a77A3937F1379699f44945018d0'],
          address: '0x7C85dD6eBc1d318E909F22d51e756Cf066643341',
          startBlock: 4931870,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
        {
          tokens: ['0x37eAA0eF3549a5Bb7D431be78a3D99BD360d19e5'],
          address: '0x0167D934CB7240e65c35e347F00Ca5b12567523a',
          startBlock: 4931982,
          contractAbiName: 'AggregatorV3Interface',
          sourceAbi: 'AggregatorV3Interface',
        },
      ],
  }
}

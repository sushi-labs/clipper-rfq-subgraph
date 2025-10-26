import { Deployment } from '../config'

export function getBinanceDeploymentConfig(): Deployment {
  return {
    networkName: 'bsc',
    pools: [],
    coves: [],
    registers: [
      {
        address: '0x2E32C76b4F50698f96fdd8Ff4aF0BD5d45F9399d',
        startBlock: 65559582,
        sourceAbi: 'BladePoolRegisterV0',
      },
    ],
    addressZeroMap: {
      symbol: 'BNB',
      decimals: 18,
      name: 'BNB',
      address: '0x0000000000000000000000000000000000000000',
    },

    prune: Math.floor((1.5 * 30 * 24 * 60 * 60) / 0.75), // 1.5 months of blocks with 0.75s (750ms) block time

    priceOracles: [],
  }
}

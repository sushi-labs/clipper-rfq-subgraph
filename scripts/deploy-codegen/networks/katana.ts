import { Deployment } from '../config'

export function getKatanaDeploymentConfig(): Deployment {
  return {
    networkName: 'katana',
    pools: [],
    coves: [],
    registers: [
      {
        address: '0x7ac96b46293F65951d70C0fCAd18947EFbEe42F7',
        startBlock: 14755195,
        sourceAbi: 'BladePoolRegisterV0',
      },
    ],
    addressZeroMap: {
      symbol: 'ETH',
      decimals: 18,
      name: 'Ether',
      address: '0x0000000000000000000000000000000000000000',
    },

    prune: Math.floor(1.5 * 30 * 24 * 60 * 60), // 1.5 months of blocks with 1s block time

    priceOracles: [],
  }
}

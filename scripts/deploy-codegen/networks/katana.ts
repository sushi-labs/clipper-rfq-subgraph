import { Deployment } from '../config'

export function getKatanaDeploymentConfig(): Deployment {
  return {
    networkName: 'katana',
    pools: [],
    coves: [],
    registers: [
      {
        address: '0xe56a524F7F35d39E5d5C34428De497da29D4B88b',
        startBlock: 4334766,
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

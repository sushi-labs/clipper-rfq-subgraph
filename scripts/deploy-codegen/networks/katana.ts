import { Deployment } from '../config'

export function getKatanaDeploymentConfig(): Deployment {
  return {
    networkName: 'katana',
    pools: [
      {
        address: '0x5699698aee5624410c1BE3aB6c15dE0999dCbC9d',
        startBlock: 5518252,
        permitRouter: '0x80A06bBAB131eeeb78cac159F9DDEcF8e9a6AbF6',
        contractAbiName: 'BladeVerifiedExchange',
        sourceAbi: 'BladeCommonExchangeV0',
      },
      {
        address: '0x989E8F547FbCa65f4FB0af41e50e4058e6c68166',
        startBlock: 4384971,
        permitRouter: '0x663fA8731045765067e2B5b6acB19BE2ce974C7f',
        contractAbiName: 'BladeVerifiedExchange',
        sourceAbi: 'BladeCommonExchangeV0',
      },
      {
        address: '0xa5fC5A373D66C109f68006A60434D3e798EcF3c6',
        startBlock: 4385079,
        permitRouter: '0xE5Fa9BBE8cAb1a5A11C10FB4273b8Bc89EcCE009',
        contractAbiName: 'BladeVerifiedExchange',
        sourceAbi: 'BladeCommonExchangeV0',
      },
      {
        address: '0xee515b1Ec16Fd470d340BB3E1A6ec2607cFc46fe',
        startBlock: 4384854,
        permitRouter: '0x2E8625cB06218706049A30118Fbd1F754cffd059',
        contractAbiName: 'BladeVerifiedExchange',
        sourceAbi: 'BladeCommonExchangeV0',
      },
    ],

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

    priceOracles: [
      {
        tokens: ['0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62'],
        address: '0x7BdBDB772f4a073BadD676A567C6ED82049a8eEE',
        startBlock: 3610390,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a'],
        address: '0x3A49D4e23868222785f148BA2bd0bAEc80d36a2A',
        startBlock: 4072143,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0xb24e3035d1FCBC0E43CF3143C3Fd92E53df2009b'],
        address: '0xF6630799b5387e0E9ACe92a5E82673021781B440',
        startBlock: 4146447,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x0913DA6Da4b42f538B445599b46Bb4622342Cf52'],
        address: '0x0D03E26E0B5D09E24E5a45696D0FcA12E9648FBB',
        startBlock: 4073842,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x2DCa96907fde857dd3D816880A0df407eeB2D2F2'],
        address: '0xF03E1566Fc6B0eBFA3dD3aA197759C4c6617ec78',
        startBlock: 3608877,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
      {
        tokens: ['0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36'],
        address: '0xbe5CE90e16B9d9d988D64b0E1f6ed46EbAfb9606',
        startBlock: 3610834,
        contractAbiName: 'AggregatorV3Interface',
        sourceAbi: 'AggregatorV3Interface',
      },
    ],
  }
}

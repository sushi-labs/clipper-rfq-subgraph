import { Address, TypedMap } from '@graphprotocol/graph-ts'

export let clipperDirectExchangeAddress = Address.fromString('{{clipperDirectExchange}}')
export let clipperCoveAddress = Address.fromString('{{clipperCove}}')
export let clipperFeeSplitAddress = Address.fromString('{{feeSplit}}')
export let clipperPermitRouterAddress = Address.fromString('{{permitRouter}}')
export let clipperFarmingHelperAddress = Address.fromString('{{farmingHelper}}')


export let PriceOracleAddresses = new TypedMap<string, string>()
PriceOracleAddresses.set('WETH', '{{ethOracleAddress}}') // eth / usd chainlink oracle
PriceOracleAddresses.set('EARTH', '{{ethOracleAddress}}') // eth / usd chainlink oracle
PriceOracleAddresses.set('ERTH', '{{ethOracleAddress}}') // eth / usd chainlink oracle
PriceOracleAddresses.set('WBTC', '{{btcOracleAddress}}') // wbtc / usd cahainlink oracle
PriceOracleAddresses.set('DAI', '{{daiOracleAddress}}') // dai / usd chainlink oracle
PriceOracleAddresses.set('USDC', '{{usdcOracleAddress}}') // usdc / usd chainlink oracle
PriceOracleAddresses.set('USDT', '{{usdtOracleAddress}}') // usdt / usd chainlink oracle
PriceOracleAddresses.set('GYEN', '{{jpyOracleAddress}}') // JPY / USD chainlink oracle
PriceOracleAddresses.set('MATIC', '{{maticOracleAddress}}') // MATIC / USD chainlink oracle
PriceOracleAddresses.set('WMATIC', '{{maticOracleAddress}}') // MATIC / USD chainlink oracle
PriceOracleAddresses.set('DOT', '{{dotOracleAddress}}') // DOT / USD chainlink oracle
PriceOracleAddresses.set('LINK', '{{linkOracleAddress}}') // LINk / USD chainlink oracle
PriceOracleAddresses.set('OP', '{{opOracleAddress}}') // OP / USD chainlink oracle
PriceOracleAddresses.set('GLMR', '{{glmrOracleAddress}}')
PriceOracleAddresses.set('ARB', '{{arbOracleAddress}}') // ARB / USD chainlink oracle

export let FallbackAssetPrice = new TypedMap<string, string>()
FallbackAssetPrice.set('GLMR', '{{fallbackPrices.GLMR}}')
FallbackAssetPrice.set('MOVR', '{{fallbackPrices.MOVR}}')
FallbackAssetPrice.set('WETH', '{{fallbackPrices.WETH}}')
FallbackAssetPrice.set('USDT', '{{fallbackPrices.USDT}}')
FallbackAssetPrice.set('DAI', '{{fallbackPrices.DAI}}')
FallbackAssetPrice.set('USDC', '{{fallbackPrices.USDC}}')
FallbackAssetPrice.set('WBTC', '{{fallbackPrices.WBTC}}')
FallbackAssetPrice.set('GYEN', '{{fallbackPrices.GYEN}}')
FallbackAssetPrice.set('MATIC', '{{fallbackPrices.MATIC}}')
FallbackAssetPrice.set('WMATIC', '{{fallbackPrices.MATIC}}')
FallbackAssetPrice.set('DOT', '{{fallbackPrices.DOT}}')
FallbackAssetPrice.set('LINK', '{{fallbackPrices.LINK}}')

export let AddressZeroSymbol = '{{addressZeroMap.symbol}}'
export let AddressZeroAddress = '{{addressZeroMap.address}}'
export let AddressZeroDecimals = '{{addressZeroMap.decimals}}'
export let AddressZeroName = '{{addressZeroMap.name}}'

export let ShorttailAssets = new TypedMap<Address, string>()
// native address across all chains
ShorttailAssets.set(Address.fromString('0x0000000000000000000000000000000000000000'), 'NATIVE')

// mainnet
ShorttailAssets.set(Address.fromString('0x0000000000000000000000000000000000000802'), 'GLMR')
ShorttailAssets.set(Address.fromString('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'), 'WBTC')
ShorttailAssets.set(Address.fromString('0x6b175474e89094c44da98b954eedeac495271d0f'), 'DAI')
ShorttailAssets.set(Address.fromString('0xdac17f958d2ee523a2206206994597c13d831ec7'), 'USDT')
ShorttailAssets.set(Address.fromString('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), 'USDC')
ShorttailAssets.set(Address.fromString('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'), 'WETH')

// polygon
ShorttailAssets.set(Address.fromString('0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'), 'WETH')
ShorttailAssets.set(Address.fromString('0x2791bca1f2de4661ed88a30c99a7a9449aa84174'), 'USDC')
ShorttailAssets.set(Address.fromString('0xc2132d05d31c914a87c6611c10748aeb04b58e8f'), 'USDT')
ShorttailAssets.set(Address.fromString('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'), 'DAI')
ShorttailAssets.set(Address.fromString('0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'), 'WBTC')
ShorttailAssets.set(Address.fromString('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'), 'WMATIC')

// optimism
ShorttailAssets.set(Address.fromString('0x4200000000000000000000000000000000000006'), 'WETH')
ShorttailAssets.set(Address.fromString('0x7f5c764cbc14f9669b88837ca1490cca17c31607'), 'USDC')
ShorttailAssets.set(Address.fromString('0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'), 'USDT')
ShorttailAssets.set(Address.fromString('0x68f180fcce6836688e9084f035309e29bf0a2095'), 'WBTC')
ShorttailAssets.set(Address.fromString('0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'), 'DAI')
ShorttailAssets.set(Address.fromString('0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6'), 'LINK')
ShorttailAssets.set(Address.fromString('0x4200000000000000000000000000000000000042'), 'OP')

// moonbeam
ShorttailAssets.set(Address.fromString('0x8f552a71efe5eefc207bf75485b356a0b3f01ec9'), 'USDC')
ShorttailAssets.set(Address.fromString('0x8e70cd5b4ff3f62659049e74b6649c6603a0e594'), 'USDT')
ShorttailAssets.set(Address.fromString('0x30d2a9f5fdf90ace8c17952cbb4ee48a55d916a7'), 'WETH')
ShorttailAssets.set(Address.fromString('0x1dc78acda13a8bc4408b207c9e48cdbc096d95e0'), 'WBTC')
ShorttailAssets.set(Address.fromString('0xc234a67a4f840e61ade794be47de455361b52413'), 'DAI')
ShorttailAssets.set(Address.fromString('0x1d4c2a246311bb9f827f4c768e277ff5787b7d7e'), 'MOVR')

// base
ShorttailAssets.set(Address.fromString('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), 'USDC')
ShorttailAssets.set(Address.fromString('0x4200000000000000000000000000000000000006'), 'WETH')
ShorttailAssets.set(Address.fromString('0x1ceA84203673764244E05693e42E6Ace62bE9BA5'), 'WBTC')
ShorttailAssets.set(Address.fromString('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), 'DAI')

// ClipperLP
ShorttailAssets.set(Address.fromString('{{clipperDirectExchange}}'), 'CLPRDRPL')

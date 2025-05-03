import { Address, BigDecimal, BigInt, TypedMap } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from '.'
import { AggregatorV3Interface } from '../../types/ClipperDirectExchange/AggregatorV3Interface'
import { FallbackAssetPrice, PriceOracleAddresses } from '../addresses'
import { ADDRESS_ZERO, BIG_DECIMAL_ZERO, BIG_INT_EIGHTEEN } from '../constants'
import { getCoveBalances } from './cove'
import { getCurrentPoolLiquidity, getPoolTokenSupply } from './pool'

export function getUsdPrice(tokenSymbol: string): BigDecimal {
  let priceOracleAddress = PriceOracleAddresses.get(tokenSymbol)
  let oracleAddressString = priceOracleAddress ? priceOracleAddress.toString() : ADDRESS_ZERO
  let oracleValueExist = PriceOracleAddresses.isSet(tokenSymbol)
  let fallbackExist = FallbackAssetPrice.isSet(tokenSymbol)

  if ((!oracleValueExist || oracleAddressString === ADDRESS_ZERO) && fallbackExist) {
    let fallbackPrice = FallbackAssetPrice.get(tokenSymbol)
    return BigDecimal.fromString(fallbackPrice ? fallbackPrice.toString() : '1')
  }

  if ((!oracleValueExist || oracleAddressString === ADDRESS_ZERO) && !fallbackExist) return BigDecimal.fromString('1')

  let oracleAddress = Address.fromString(oracleAddressString)
  let oracleContract = AggregatorV3Interface.bind(oracleAddress)
  let answer = oracleContract.latestRoundData()
  let decimals = oracleContract.decimals()
  let price = answer.value1

  let usdValue = convertTokenToDecimal(price, BigInt.fromI32(decimals))

  return usdValue
}

export function getCoveAssetPrice(poolId: string, coveAddress: Address, tokenAddress: Address, decimals: number): TypedMap<string, BigDecimal> {
  let balances = getCoveBalances(coveAddress, tokenAddress, decimals)
  let poolTokens = balances[0]
  let longtailAssetBalance = balances[1]

  // gets the USD liquidity in our current pool
  let currentPoolLiquidity = getCurrentPoolLiquidity(poolId)
  let poolTokenSupply = getPoolTokenSupply(poolId)
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BIG_INT_EIGHTEEN)

  let covePoolTokenProportion = poolTokens.div(totalPoolTokens)

  // usd amount of pool tokens owned by the cove.
  let usdProportion = currentPoolLiquidity.times(covePoolTokenProportion)

  // multiply by two since the amount of longtail assets should be approx the same, in usd value as the pool tokens added
  let coveLiquidity = usdProportion.times(BigDecimal.fromString('2'))
  let assetPrice = longtailAssetBalance.le(BIG_DECIMAL_ZERO)
    ? BIG_DECIMAL_ZERO
    : usdProportion.div(longtailAssetBalance)

  let returnValue = new TypedMap<string, BigDecimal>()
  returnValue.set('coveLiquidity', coveLiquidity)
  returnValue.set('assetPrice', assetPrice)
  returnValue.set('assetBalance', longtailAssetBalance)
  returnValue.set('poolTokenBalance', poolTokens)
  returnValue.set('longtailAssetBalance', longtailAssetBalance)
  returnValue.set('totalPoolTokens', totalPoolTokens)
  returnValue.set('currentPoolLiquidity', currentPoolLiquidity)

  return returnValue
}

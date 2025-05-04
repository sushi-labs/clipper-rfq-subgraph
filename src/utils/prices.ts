import { Address, BigDecimal, BigInt, Bytes, ethereum, TypedMap } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from '.'
import { AggregatorV3Interface } from '../../types/templates/ClipperDirectExchange/AggregatorV3Interface'
import { FallbackAssetPrice, DailyFallbackPrices, PriceOracleAddresses, OracleStartBlocks, AddressZeroAddress } from '../addresses'
import { ADDRESS_ZERO, BIG_DECIMAL_ZERO, BIG_INT_EIGHTEEN, ONE_DAY } from '../constants'
import { eth_getCoveBalances } from './cove'
import { eth_getPoolTokensLiquidity, eth_getPoolTokenSupply } from './pool'
import { loadPool } from '../entities/Pool'
import { getOpenTime } from './time'

/**
 * Get the USD price of a token.
 * TODO: ETH_CALL removed
 * @param tokenSymbol - The symbol of the token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function eth_getUsdPrice(tokenSymbol: string, block: ethereum.Block): BigDecimal {
  let priceOracleAddress = PriceOracleAddresses.get(tokenSymbol)
  let oracleAddressString = priceOracleAddress ? priceOracleAddress.toString() : AddressZeroAddress
  let oracleValueExist = PriceOracleAddresses.isSet(tokenSymbol)
  
  // Check if oracle is available at this block
  let useOracle = oracleValueExist && oracleAddressString !== ADDRESS_ZERO
  if (useOracle && OracleStartBlocks.isSet(tokenSymbol)) {
    let startBlock = OracleStartBlocks.get(tokenSymbol)
    if (startBlock && block.number.lt(BigInt.fromString(startBlock))) {
      useOracle = false // Oracle not yet available at this block
    }
  }
  
  // Try to get daily fallback price first
  let dayTimestamp = getOpenTime(block.timestamp, ONE_DAY).toString()
  let fallbackExist = DailyFallbackPrices.isSet(dayTimestamp)
  if ((!useOracle) && fallbackExist) {
    let dailyPrices = DailyFallbackPrices.get(dayTimestamp)
    if (dailyPrices && dailyPrices.isSet(tokenSymbol)) {
      let price = dailyPrices.get(tokenSymbol)
      return BigDecimal.fromString(price ? price.toString() : '0')
    }
  }
  
  // Fall back to general fallback price if no daily price is available
  fallbackExist = FallbackAssetPrice.isSet(tokenSymbol)
  if ((!useOracle) && fallbackExist) {
    let fallbackPrice = FallbackAssetPrice.get(tokenSymbol)
    return BigDecimal.fromString(fallbackPrice ? fallbackPrice.toString() : '0')
  }

  if ((!useOracle) && !fallbackExist) return BigDecimal.fromString('0')

  // Use oracle if available
  let oracleAddress = Address.fromString(oracleAddressString)
  let oracleContract = AggregatorV3Interface.bind(oracleAddress)
  let answer = oracleContract.latestRoundData()
  let decimals = oracleContract.decimals()
  let price = answer.value1

  let usdValue = convertTokenToDecimal(price, BigInt.fromI32(decimals))

  return usdValue
}

export function eth_getCoveAssetPrice(poolAddressBytes: Bytes, coveAddressBytes: Bytes, tokenAddressBytes: Bytes, decimals: i32, block: ethereum.Block): TypedMap<string, BigDecimal> {
  let poolAddress = Address.fromBytes(poolAddressBytes)
  let coveAddress = Address.fromBytes(coveAddressBytes)
  let tokenAddress = Address.fromBytes(tokenAddressBytes)
  let balances = eth_getCoveBalances(coveAddress, tokenAddress, decimals)
  let poolTokensAmount = balances[0]
  let longtailAssetBalance = balances[1]

  let pool = loadPool(poolAddress, block)
  // gets the USD liquidity in our current pool
  let currentPoolLiquidity = eth_getPoolTokensLiquidity(poolAddress, pool.tokens.load(), block)
  let poolTokenSupply = eth_getPoolTokenSupply(poolAddress)
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BIG_INT_EIGHTEEN)

  let covePoolTokenProportion = poolTokensAmount.div(totalPoolTokens)

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
  returnValue.set('poolTokenBalance', poolTokensAmount)
  returnValue.set('longtailAssetBalance', longtailAssetBalance)
  returnValue.set('totalPoolTokens', totalPoolTokens)
  returnValue.set('currentPoolLiquidity', currentPoolLiquidity)

  return returnValue
}

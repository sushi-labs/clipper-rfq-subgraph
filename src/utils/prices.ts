import { Address, BigDecimal, BigInt, Bytes, ethereum, TypedMap } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadToken } from '.'
import { AggregatorV3Interface } from '../../types/templates/ClipperDirectExchange/AggregatorV3Interface'
import {
  FallbackAssetPrice,
  DailyFallbackPrices,
  PriceOracleAddresses,
  OracleStartBlocks,
} from '../addresses'
import { BIG_DECIMAL_ZERO, BIG_INT_EIGHTEEN, ONE_DAY } from '../constants'
import { eth_getCoveBalances } from './cove'
import { loadPool } from '../entities/Pool'
import { getOpenTime } from './time'
import { Token } from '../../types/schema'

class TokenOraclePriceConfig {
  token: Token
  oracleAddress: Address | null
  fallbackPrice: BigDecimal | null
  useOracle: boolean
  block: ethereum.Block

  constructor(token: Token, block: ethereum.Block) {
    this.token = token
    this.block = block
    this.fallbackPrice = null

    let tokenSymbol = this.token.symbol
    let oracleAddressString = PriceOracleAddresses.get(tokenSymbol)
    this.oracleAddress = oracleAddressString ? Address.fromString(oracleAddressString) : null

    let oracleValueExist = PriceOracleAddresses.isSet(tokenSymbol)

    // Check if oracle is available at this block
    let useOracle = !!oracleValueExist && this.oracleAddress !== null
    if (useOracle && OracleStartBlocks.isSet(tokenSymbol)) {
      let startBlock = OracleStartBlocks.get(tokenSymbol)
      if (startBlock && block.number.lt(BigInt.fromString(startBlock))) {
        useOracle = false // Oracle not yet available at this block
      }
    }
    this.useOracle = useOracle

    // Try to get daily fallback price first
    let dayTimestamp = getOpenTime(block.timestamp, ONE_DAY).toString()
    let fallbackExist = DailyFallbackPrices.isSet(dayTimestamp)
    if (!useOracle && fallbackExist) {
      let dailyPrices = DailyFallbackPrices.get(dayTimestamp)
      if (dailyPrices && dailyPrices.isSet(tokenSymbol)) {
        let price = dailyPrices.get(tokenSymbol)
        if (price) {
          this.fallbackPrice = BigDecimal.fromString(price.toString())
        } else {
          this.fallbackPrice = BIG_DECIMAL_ZERO
        }
      }
    }

    // Fall back to general fallback price if no daily price is available
    fallbackExist = FallbackAssetPrice.isSet(tokenSymbol)
    if (!useOracle && fallbackExist) {
      let fallbackPrice = FallbackAssetPrice.get(tokenSymbol)
      if (fallbackPrice) {
        this.fallbackPrice = BigDecimal.fromString(fallbackPrice.toString())
      } else {
        this.fallbackPrice = BIG_DECIMAL_ZERO
      }
    }
  }
}

/**
 * Get the USD price of a token.
 * TODO: ETH_CALL removed
 * @param tokenAddress - The address of the token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function eth_getTokenUsdPrice(token: Token, block: ethereum.Block): BigDecimal {
  let tokenOraclePriceConfig = new TokenOraclePriceConfig(token, block)

  if (!tokenOraclePriceConfig.useOracle || !tokenOraclePriceConfig.oracleAddress) {
    if (tokenOraclePriceConfig.fallbackPrice !== null) {
      return tokenOraclePriceConfig.fallbackPrice
    } else {
      return BIG_DECIMAL_ZERO
    }
  }

  // Use oracle if available
  let oracleContract = AggregatorV3Interface.bind(tokenOraclePriceConfig.oracleAddress)
  let answer = oracleContract.latestRoundData()
  let decimals = oracleContract.decimals()
  let price = convertTokenToDecimal(answer.value1, BigInt.fromI32(decimals))
  return price
}

export function eth_getCoveAssetPrice(
  poolAddressBytes: Bytes,
  coveAddressBytes: Bytes,
  tokenAddressBytes: Bytes,
  decimals: i32,
  block: ethereum.Block,
): TypedMap<string, BigDecimal> {
  let poolAddress = Address.fromBytes(poolAddressBytes)
  let coveAddress = Address.fromBytes(coveAddressBytes)
  let tokenAddress = Address.fromBytes(tokenAddressBytes)
  let balances = eth_getCoveBalances(coveAddress, tokenAddress, decimals)
  let poolTokensAmount = balances[0]
  let longtailAssetBalance = balances[1]

  let pool = loadPool(poolAddress, block)
  // gets the USD liquidity in our current pool
  let currentPoolLiquidity = pool.poolValueUSD
  let poolTokenSupply = pool.poolTokensSupply
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

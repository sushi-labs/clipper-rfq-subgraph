import { Address, BigDecimal, BigInt, Bytes, ethereum, log, TypedMap } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from './index'
import { AggregatorV3Interface } from '../../types/templates/ClipperDirectExchange/AggregatorV3Interface'
import {
  FallbackAssetPrice,
  DailyFallbackPrices,
  PriceOracleByToken,
  OracleStartBlocks,
} from '../addresses'
import { BIG_DECIMAL_ZERO, BIG_INT_EIGHTEEN, ONE_DAY, ORACLE_PRICE_SOURCE, SNAPSHOT_PRICE_SOURCE } from '../constants'
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

    let tokenAddress = Address.fromBytes(this.token.id)
    this.oracleAddress = PriceOracleByToken.get(tokenAddress)
    let oracleStartBlock = OracleStartBlocks.get(tokenAddress)

    // Check if oracle is available at this block
    this.useOracle = this.oracleAddress !== null && oracleStartBlock !== null && block.number.lt(BigInt.fromString(oracleStartBlock))

    // Try to get daily fallback price first
    let fallbackExist = DailyFallbackPrices.isSet(tokenAddress)
    if (!this.useOracle && fallbackExist) {
      let dailyPrices = DailyFallbackPrices.get(tokenAddress)
      let dayTimestamp = getOpenTime(block.timestamp, ONE_DAY).toString()
      if (dailyPrices && dailyPrices.isSet(dayTimestamp)) {
        let price = dailyPrices.get(dayTimestamp)
        if (price) {
          this.fallbackPrice = BigDecimal.fromString(price.toString())
        } else {
          this.fallbackPrice = BIG_DECIMAL_ZERO
        }
      }
    }

    // Fall back to general fallback price if no daily price is available
    fallbackExist = FallbackAssetPrice.isSet(tokenAddress)
    if (!this.useOracle && fallbackExist) {
      let fallbackPrice = FallbackAssetPrice.get(tokenAddress)
      if (fallbackPrice) {
        this.fallbackPrice = BigDecimal.fromString(fallbackPrice.toString())
      } else {
        this.fallbackPrice = BIG_DECIMAL_ZERO
      }
    }
  }
}

class TokenPrice {
  token: Token
  priceUSD: BigDecimal
  priceSource: string

  constructor(token: Token, priceUSD: BigDecimal, priceSource: string) {
    this.token = token
    this.priceUSD = priceUSD
    this.priceSource = priceSource
  }
}

function eth_getOracleTokenUsdPrice(token: Token, oracleAddress: Address): TokenPrice {
  let oracleContract = AggregatorV3Interface.bind(oracleAddress)
  let answer = oracleContract.latestRoundData()
  let decimals = oracleContract.decimals()
  let price = convertTokenToDecimal(answer.value1, BigInt.fromI32(decimals))
  return new TokenPrice(token, price, ORACLE_PRICE_SOURCE)
}

/**
 * Get the USD price of a token with fallback or oracle.
 * @param token - The token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function eth_getTokenUsdPrice(token: Token, block: ethereum.Block): TokenPrice {
  let tokenOraclePriceConfig = new TokenOraclePriceConfig(token, block)
  let tokenOracleAddress = tokenOraclePriceConfig.oracleAddress
  // If oracle is not available, use fallback price
  if (!tokenOraclePriceConfig.useOracle || !tokenOracleAddress) {
    let fallbackPrice = tokenOraclePriceConfig.fallbackPrice
    if (fallbackPrice !== null) {
      return new TokenPrice(token, fallbackPrice, SNAPSHOT_PRICE_SOURCE)
    }
    return new TokenPrice(token, BIG_DECIMAL_ZERO, SNAPSHOT_PRICE_SOURCE)
  }

  return eth_getOracleTokenUsdPrice(token, tokenOracleAddress)
}

/**
 * Get the USD price of a token with fallback or cached from the token.
 * @param token - The token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function getTokenUsdPrice(token: Token, block: ethereum.Block): TokenPrice {
  if (token.priceSource === ORACLE_PRICE_SOURCE) {
    return new TokenPrice(token, token.priceUSD, ORACLE_PRICE_SOURCE)
  }

  let tokenPrice = eth_getTokenUsdPrice(token, block)
  if (tokenPrice.priceUSD.notEqual(token.priceUSD) || token.priceSource !== tokenPrice.priceSource) {
    token.priceUSD = tokenPrice.priceUSD
    token.priceSource = tokenPrice.priceSource
    token.priceUpdatedAt = block.timestamp.toI32()
    token.save()
  }

  return tokenPrice
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

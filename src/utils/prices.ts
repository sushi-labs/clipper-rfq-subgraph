import { Address, BigDecimal, BigInt, DataSourceContext, ethereum, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from './index'
import { AggregatorV3Interface } from '../../types/templates/ClipperCommonExchangeV0/AggregatorV3Interface'
import { FallbackAssetPrice, DailyFallbackPrices } from '../addresses'
import { BIG_DECIMAL_ZERO, ONE_DAY, ORACLE_PRICE_SOURCE, SNAPSHOT_PRICE_SOURCE } from '../constants'
import { getOpenTime } from './time'
import { PriceAggregatorProxy, Token } from '../../types/schema'
import { PriceOracle as PriceOracleTemplate } from '../../types/templates'
import { loadPriceAggregatorProxy } from '../entities/PriceAggregatorProxy'

class TokenOraclePriceConfig {
  token: Token
  priceAggregatorProxy: Address | null
  fallbackPrice: BigDecimal | null
  useOracle: boolean
  block: ethereum.Block

  constructor(token: Token, block: ethereum.Block) {
    this.token = token
    this.block = block
    this.fallbackPrice = null

    let tokenAddress = Address.fromBytes(this.token.id)
    let priceAggregatorProxyBytes = this.token.priceAggregatorProxy ? this.token.priceAggregatorProxy : null
    let priceAggregatorProxy = priceAggregatorProxyBytes ? Address.fromBytes(priceAggregatorProxyBytes) : null
    this.priceAggregatorProxy = priceAggregatorProxy

    // Check if oracle is available at this block
    this.useOracle = this.priceAggregatorProxy !== null

    // Try to get daily fallback price first
    let fallbackExist = DailyFallbackPrices.isSet(tokenAddress)
    if (!this.useOracle && fallbackExist) {
      let dailyPrices = DailyFallbackPrices.get(tokenAddress)
      let dayTimestamp = getOpenTime(block.timestamp, ONE_DAY).toString()
      if (dailyPrices && dailyPrices.isSet(dayTimestamp)) {
        let price = dailyPrices.get(dayTimestamp)
        if (price) {
          this.fallbackPrice = BigDecimal.fromString(price.toString())
        }
      }
    }

    // Fall back to general fallback price if no daily price is available
    fallbackExist = FallbackAssetPrice.isSet(tokenAddress)
    if (!this.useOracle && fallbackExist && this.fallbackPrice === null) {
      let fallbackPrice = FallbackAssetPrice.get(tokenAddress)
      if (fallbackPrice) {
        this.fallbackPrice = BigDecimal.fromString(fallbackPrice.toString())
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

export function updatePriceAggregatorProxyDaily(oracleProxyAddress: Address, block: ethereum.Block): PriceAggregatorProxy {
  let priceAggregatorProxy = loadPriceAggregatorProxy(oracleProxyAddress, block)
  let timestamp = block.timestamp.toI32()
  let timeSinceLastChecked = timestamp - priceAggregatorProxy.aggregatorLastCheckedAt
  if (timeSinceLastChecked < ONE_DAY) {
    return priceAggregatorProxy
  }

  let oracleContract = AggregatorV3Interface.bind(oracleProxyAddress)
  let aggregator = oracleContract.aggregator()
  if (aggregator.notEqual(priceAggregatorProxy.aggregator)) {
    priceAggregatorProxy.aggregator = aggregator
    priceAggregatorProxy.aggregatorConfirmedAt = timestamp

    let newContext = new DataSourceContext()
    newContext.setBytes('proxyAddress', oracleProxyAddress)
    PriceOracleTemplate.createWithContext(aggregator, newContext)
  }

  priceAggregatorProxy.aggregatorLastCheckedAt = timestamp
  priceAggregatorProxy.save()

  return priceAggregatorProxy
}

/**
 * Get the USD price of a token with fallback or oracle.
 * @param token - The token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function eth_getTokenUsdPrice(token: Token, block: ethereum.Block): TokenPrice | null {
  let tokenOraclePriceConfig = new TokenOraclePriceConfig(token, block)
  let tokenOracleAddress = tokenOraclePriceConfig.priceAggregatorProxy
  // If oracle is not available, use fallback price
  if (!tokenOraclePriceConfig.useOracle || !tokenOracleAddress) {
    let fallbackPrice = tokenOraclePriceConfig.fallbackPrice
    if (fallbackPrice !== null) {
      return new TokenPrice(token, fallbackPrice, SNAPSHOT_PRICE_SOURCE)
    }
    return null
  }

  let oracleContract = AggregatorV3Interface.bind(tokenOracleAddress)
  let answer = oracleContract.latestRoundData()
  // All USD price oracles are 8 decimals. While this may change, it would be a breaking change for many projects, so it's unlikely.
  let price = convertTokenToDecimal(answer.value1, 8)
  return new TokenPrice(token, price, ORACLE_PRICE_SOURCE)
}

/**
 * Get the USD price of a token with fallback or cached from the token.
 * @param token - The token
 * @param block - The block number
 * @returns The USD price of the token
 */
export function getTokenUsdPrice(token: Token, block: ethereum.Block): TokenPrice | null {
  let priceAggregatorProxyBytes = token.priceAggregatorProxy ? token.priceAggregatorProxy : null
  let priceAggregatorProxyAddress = priceAggregatorProxyBytes ? Address.fromBytes(priceAggregatorProxyBytes) : null
  if (priceAggregatorProxyAddress) {
    updatePriceAggregatorProxyDaily(priceAggregatorProxyAddress, block)
  }
  let savedTokenPriceUsd = token.priceUSD
  if (token.priceSource === ORACLE_PRICE_SOURCE && savedTokenPriceUsd !== null) {
    // Check if price is less than a day old when using oracle and return cached price
    // This allow us to keep the price up to date in case the aggregator event is not emitted as a fallback
    let timeSinceLastUpdate = block.timestamp.toI32() - token.priceUpdatedAt
    if (timeSinceLastUpdate < ONE_DAY) {
      return new TokenPrice(token, savedTokenPriceUsd, ORACLE_PRICE_SOURCE)
    }
  }

  let tokenPrice = eth_getTokenUsdPrice(token, block)
  let currentTokenPriceUsd = tokenPrice ? tokenPrice.priceUSD : null
  if (
    currentTokenPriceUsd !== null && tokenPrice !== null &&
    (savedTokenPriceUsd === null ||
      currentTokenPriceUsd.notEqual(savedTokenPriceUsd) ||
      token.priceSource !== tokenPrice.priceSource)
  ) {
    token.priceUSD = tokenPrice.priceUSD
    token.priceSource = tokenPrice.priceSource
    token.priceUpdatedAt = block.timestamp.toI32()
    token.save()
  }

  return tokenPrice
}

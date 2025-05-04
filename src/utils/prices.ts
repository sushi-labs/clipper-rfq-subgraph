import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from './index'
import { AggregatorV3Interface } from '../../types/templates/ClipperCommonExchangeV0/AggregatorV3Interface'
import {
  FallbackAssetPrice,
  DailyFallbackPrices,
  PriceOracleByToken,
  OracleStartBlocks,
} from '../addresses'
import { BIG_DECIMAL_ZERO, ONE_DAY, ORACLE_PRICE_SOURCE, SNAPSHOT_PRICE_SOURCE } from '../constants'
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

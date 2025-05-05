import { Address, BigInt, dataSource, DataSourceContext, ethereum, log } from '@graphprotocol/graph-ts'
import { AnswerUpdated } from '../types/templates/PriceOracle/AggregatorV3Interface'
import { convertTokenToDecimal, loadToken } from './utils'
import { Pool, PoolEvent, PriceAggregatorProxy } from '../types/schema'
import { ORACLE_PRICE_SOURCE, ORACLE_UPDATE_EVENT } from './constants'
import { PoolHelpers } from './utils/pool'
import { PriceOracle as PriceOracleTemplate } from '../types/templates'
import { updateTokenAggregatorDaily } from './utils/prices'
import { loadPriceAggregatorProxy } from './entities/PriceAggregatorProxy'

export function handleProxyStart(block: ethereum.Block): void {
  let context = dataSource.context()
  let proxyAddressString = context.getString('proxyAddress')
  let tokenAddressString = context.getString('tokenAddress')
  let proxyAddress = Address.fromString(proxyAddressString)
  let tokenAddress = Address.fromString(tokenAddressString)
  let priceAggregatorProxy = loadPriceAggregatorProxy(proxyAddress, block)

  let token = loadToken(tokenAddress, block)
  token.priceAggregatorProxy = priceAggregatorProxy.id
  token.save()
  let newContext = new DataSourceContext()
  newContext.setBytes('proxyAddress', proxyAddress)
  let aggregatorAddress = Address.fromBytes(priceAggregatorProxy.aggregator)
  log.debug('Creating PriceOracle data source for aggregator: {} at block {}', [aggregatorAddress.toHexString(), block.number.toString()])
  PriceOracleTemplate.createWithContext(aggregatorAddress, newContext)
}

export function handlePriceUpdated(event: AnswerUpdated): void {
  let context = dataSource.context()
  let proxyAddress = context.getBytes('proxyAddress')
  let priceAggregatorProxy = PriceAggregatorProxy.load(proxyAddress)
  if (!priceAggregatorProxy) {
    return
  }
  let aggregatorAddress = event.address
  /** If the aggregator address is not the same as the proxy address, it means the aggregator has been updated.
   * And we don't want to update the price with the old aggregator even if the price is updated.
   * */
  if (aggregatorAddress.notEqual(priceAggregatorProxy.aggregator)) {
    return
  }
  let updatedPoolSet = new Set<Address>()
  let tokens = priceAggregatorProxy.tokens.load()
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]
    updateTokenAggregatorDaily(token, event.block)

    /**
     * All USD price oracles are 8 decimals. While this may change, it would be a breaking change for many projects, so it's unlikely.
     * We want to avoid the eth_call of the oracle contract decimals.
     */
    token.priceUSD = convertTokenToDecimal(event.params.current, 8)
    token.priceSource = ORACLE_PRICE_SOURCE
    token.priceUpdatedAt = event.block.timestamp.toI32()
    token.save()

    let poolTokens = token.pools.load()
    for (let i = 0; i < poolTokens.length; i++) {
      let poolToken = poolTokens[i]
      let poolAddress = Address.fromBytes(poolToken.pool)
      if (updatedPoolSet.has(poolAddress)) {
        continue
      }
      updatedPoolSet.add(poolAddress)
    }
  }

  let poolAddressList = updatedPoolSet.values()
  for (let i = 0; i < poolAddressList.length; i++) {
    let poolAddress = poolAddressList[i]
    // Pool must exist as it was obtained from a relationship with pool tokens
    let pool = Pool.load(poolAddress)
    if (!pool) {
      continue
    }
    let poolHelpers = new PoolHelpers(poolAddress, pool.abi, event.block)
    let poolValueUSD = poolHelpers.updateExistingPoolTokensLiquidity()
    pool.poolValueUSD = poolValueUSD
    pool.save()

    let poolEvent = new PoolEvent(0)
    poolEvent.pool = pool.id
    poolEvent.type = ORACLE_UPDATE_EVENT
    poolEvent.poolValueUSD = poolValueUSD
    poolEvent.poolTokensSupply = pool.poolTokensSupply
    poolEvent.timestamp = event.block.timestamp.toI32()
    poolEvent.save()
  }
}

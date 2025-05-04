import { Address, BigInt } from "@graphprotocol/graph-ts"
import { AnswerUpdated } from "../types/templates/PriceOracle/AggregatorV3Interface"
import { TokenByOracle } from "./addresses"
import { convertTokenToDecimal, loadToken } from "./utils"
import { Pool, PoolEvent } from "../types/schema"
import { ORACLE_PRICE_SOURCE, ORACLE_UPDATE_EVENT } from "./constants"
import { PoolHelpers } from "./utils/pool"

export function handlePriceUpdated(event: AnswerUpdated): void {
    let tokenAddress = TokenByOracle.get(event.address)
    if (!tokenAddress) {
        return
    }
    let token = loadToken(tokenAddress, event.block)
    /**
     * All USD price oracles are 8 decimals. While this may change, it would be a breaking change for many projects, so it's unlikely.
     * We want to avoid the eth_call of the oracle contract decimals.
     */
    token.priceUSD = convertTokenToDecimal(event.params.current, BigInt.fromI32(8))
    token.priceSource = ORACLE_PRICE_SOURCE
    token.priceUpdatedAt = event.block.timestamp.toI32()
    token.save()

    let poolTokens = token.pools.load();
    for (let i = 0; i < poolTokens.length; i++) {
      let poolToken = poolTokens[i]
      let poolAddress = Address.fromBytes(poolToken.pool)
      let pool = Pool.load(poolAddress)
      if (!pool) {
        continue
      }
      let poolHelpers = new PoolHelpers(poolAddress, pool.abi, event.block)
      let poolValueUSD = poolHelpers.updateExistingPoolTokensLiquidity()
      pool.poolValueUSD = poolValueUSD
      pool.save()

      let poolEvent = new PoolEvent(0)
      poolEvent.pool = poolToken.pool
      poolEvent.type = ORACLE_UPDATE_EVENT
      poolEvent.poolValueUSD = poolValueUSD
      poolEvent.poolTokensSupply = pool.poolTokensSupply
      poolEvent.timestamp = event.block.timestamp.toI32()
      poolEvent.save()
    }
}

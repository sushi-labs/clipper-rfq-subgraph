import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadOrCreatePoolToken, loadToken } from './index'
import { eth_getTokenUsdPrice } from './prices'
import { ClipperDirectExchange, ClipperDirectExchange__allTokensBalanceResult } from '../../types/templates/ClipperDirectExchange/ClipperDirectExchange'
import { PoolToken } from '../../types/schema'
import { BIG_DECIMAL_ZERO } from '../constants'

/**
 * Load or create pool tokens.
 * Only used when creating a pool entity. Cached in Pool entities.
 * @param poolAddress - The address of the pool
 * @param block - The block number
 * @returns An array of pool tokens
 */
export function loadOrCreatePoolTokens(poolAddress: Bytes, block: ethereum.Block): PoolToken[] {
  let poolContract = ClipperDirectExchange.bind(Address.fromBytes(poolAddress))
  let nTokens = poolContract.nTokens()
  let poolTokens: PoolToken[] = []
  for (let i = 0; i < nTokens.toI32(); i++) {
    let nToken = poolContract.try_tokenAt(BigInt.fromI32(i))
    if (!nToken.reverted) {
      let token = loadToken(nToken.value)
      let poolToken = loadOrCreatePoolToken(poolAddress, token, block)
      poolTokens.push(poolToken)
    } else {
      log.info('Not able to fetch nToken {}', [i.toString()])
    }
  }

  return poolTokens
}


export function eth_getPoolAllTokensBalance(poolAddress: Address): ClipperDirectExchange__allTokensBalanceResult {
  let poolContract = ClipperDirectExchange.bind(poolAddress)
  return poolContract.allTokensBalance()
}

/**
 * Update the liquidity of the pool tokens.
 * Supports adding new tokens to the pool as the balances come from the pool assets set.
 * @param poolAddress - The address of the pool
 * @param allTokensBalance - The balance of all tokens in the pool
 * @param block - The block number
 * @returns The liquidity of the pool tokens
 */
export function eth_updatePoolTokensLiquidity(poolAddress: Address, allTokensBalance: ClipperDirectExchange__allTokensBalanceResult, block: ethereum.Block): BigDecimal {
  let currentLiquidity = BIG_DECIMAL_ZERO
  for (let i: i32 = 0; i < allTokensBalance.value0.length; i++) {
    let tokenAddress = allTokensBalance.value1[i]
    const token = loadToken(tokenAddress)
    let tokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], token.decimals)
    const poolToken = loadOrCreatePoolToken(poolAddress, token, block)
    const tokenUsdPrice = eth_getTokenUsdPrice(token, block)
    const usdTokenLiquidity = tokenBalance.times(tokenUsdPrice)
    currentLiquidity = currentLiquidity.plus(usdTokenLiquidity)
    poolToken.tvl = tokenBalance
    poolToken.tvlUSD = tokenUsdPrice.times(tokenBalance)
    poolToken.save()
  }

  return currentLiquidity
}

/*
  Get the total supply of the pool token.
  @param poolAddress - The address of the pool
  @returns The total supply of the pool token
*/
export function eth_getPoolTokenSupply(poolAddress: Bytes): BigInt {
  let poolContract = ClipperDirectExchange.bind(Address.fromBytes(poolAddress))
  let poolTokenSupply = poolContract.totalSupply()

  return poolTokenSupply
}

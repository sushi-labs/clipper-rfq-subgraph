import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadOrCreatePoolToken, loadToken } from './index'
import { ClipperDirectExchange, ClipperDirectExchange__allTokensBalanceResult } from '../../types/templates/ClipperDirectExchange/ClipperDirectExchange'
import { PoolToken } from '../../types/schema'
import { BIG_DECIMAL_ZERO } from '../constants'
import { loadPool } from '../entities/Pool'

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
      let token = loadToken(nToken.value, block)
      let poolToken = loadOrCreatePoolToken(poolAddress, token, block)
      poolTokens.push(poolToken)
    } else {
      log.info('Not able to fetch nToken {}', [i.toString()])
    }
  }

  return poolTokens
}

/**
 * Get the balance of all tokens in the pool.
 * @param poolAddress - The address of the pool
 * @returns The balance of all tokens in the pool
 */
export function eth_getPoolAllTokensBalance(poolAddress: Address, block: ethereum.Block): ClipperDirectExchange__allTokensBalanceResult {
  let poolContract = ClipperDirectExchange.bind(poolAddress)
  let allTokensBalanceResult = poolContract.try_allTokensBalance()
  if (allTokensBalanceResult.reverted) {
    log.warning('Failed to get all tokens balance for pool {}. Using fallback method of multiple calls.', [poolAddress.toHexString()])
    let pool = loadPool(poolAddress, block)
    let poolTokens = pool.tokens.load()
    let poolTokenBalances = new Array<BigInt>()
    let poolTokenAddresses = new Array<Address>()
    for (let i = 0; i < poolTokens.length; i++) {
      let tokenAddress = Address.fromBytes(poolTokens[i].token)
      poolTokenAddresses.push(tokenAddress)
      poolTokenBalances.push(poolContract.balanceOf(tokenAddress))
    }
    let allTokensBalance = new ClipperDirectExchange__allTokensBalanceResult(poolTokenBalances, poolTokenAddresses, poolContract.totalSupply())
    return allTokensBalance
  }
  return allTokensBalanceResult.value
}

/**
 * Update the liquidity of the pool tokens.
 * Supports adding new tokens to the pool as the balances come from the pool assets set.
 * @param poolAddress - The address of the pool
 * @param allTokensBalance - The balance of all tokens in the pool
 * @param block - The block number
 * @returns The liquidity of the pool tokens
 */
export function updatePoolTokensLiquidity(poolAddress: Address, allTokensBalance: ClipperDirectExchange__allTokensBalanceResult, block: ethereum.Block): BigDecimal {
  let currentLiquidity = BIG_DECIMAL_ZERO
  for (let i: i32 = 0; i < allTokensBalance.value0.length; i++) {
    let tokenAddress = allTokensBalance.value1[i]
    const token = loadToken(tokenAddress, block)
    let tokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], token.decimals)
    const poolToken = loadOrCreatePoolToken(poolAddress, token, block)
    const usdTokenLiquidity = tokenBalance.times(token.priceUSD)
    currentLiquidity = currentLiquidity.plus(usdTokenLiquidity)
    poolToken.tvl = tokenBalance
    poolToken.tvlUSD = usdTokenLiquidity
    poolToken.save()
  }

  return currentLiquidity
}

export function updateExistingPoolTokensLiquidity(poolAddress: Address, block: ethereum.Block): BigDecimal {
  let pool = loadPool(poolAddress, block)
  let poolTokens = pool.tokens.load()
  let currentLiquidity = BIG_DECIMAL_ZERO
  for (let i: i32 = 0; i < poolTokens.length; i++) {
    let poolToken = poolTokens[i]
    let tokenAddress = Address.fromBytes(poolToken.token)
    let token = loadToken(tokenAddress, block)
    const usdTokenLiquidity = poolToken.tvl.times(token.priceUSD)
    if (usdTokenLiquidity.notEqual(poolToken.tvlUSD)) {
      poolToken.tvlUSD = usdTokenLiquidity
      poolToken.save()
    }
    currentLiquidity = currentLiquidity.plus(usdTokenLiquidity)
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

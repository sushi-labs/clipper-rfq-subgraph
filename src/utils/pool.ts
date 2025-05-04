import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadOrCreatePoolToken, loadToken } from './index'
import {
  ClipperPool,
  ClipperPool__allTokensBalanceResult,
} from '../../types/templates/ClipperCommonExchangeV0/ClipperPool'
import { Pool, PoolToken } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from '../constants'

export class PoolHelpers {
  private poolAddress: Address
  private sourceAbi: string
  private block: ethereum.Block

  constructor(poolAddress: Address, sourceAbi: string, block: ethereum.Block) {
    this.poolAddress = poolAddress
    this.sourceAbi = sourceAbi
    this.block = block
  }

  loadPool(): Pool {
    let pool = Pool.load(this.poolAddress)

    if (!pool) {
      pool = new Pool(this.poolAddress)
      pool.abi = this.sourceAbi
      pool.createdAt = this.block.timestamp.toI32()
      // swaps
      pool.volumeUSD = BIG_DECIMAL_ZERO
      pool.txCount = BIG_INT_ZERO

      pool.feeUSD = BIG_DECIMAL_ZERO
      pool.revenueUSD = BIG_DECIMAL_ZERO

      //deposits
      pool.depositedUSD = BIG_DECIMAL_ZERO
      pool.depositCount = BIG_INT_ZERO

      // withdrawals
      pool.withdrewUSD = BIG_DECIMAL_ZERO
      pool.withdrawalCount = BIG_INT_ZERO

      // pool value in USD
      pool.poolValueUSD = BIG_DECIMAL_ZERO

      pool.poolTokensSupply = this.eth_getPoolTokenSupply()
      pool.uniqueUsers = BIG_INT_ZERO

      pool.save()

      this.eth_loadOrCreatePoolTokens()
    }

    return pool as Pool
  }

  getPoolContract(): ClipperPool {
    return ClipperPool.bind(this.poolAddress)
  }

  /**
   * Load or create pool tokens.
   * Only used when creating a pool entity. Cached in Pool entities.
   * @returns An array of pool tokens
   */
  eth_loadOrCreatePoolTokens(): PoolToken[] {
    let poolContract = this.getPoolContract()
    let nTokens = poolContract.nTokens()
    let poolTokens: PoolToken[] = []
    for (let i = 0; i < nTokens.toI32(); i++) {
      let nToken = poolContract.try_tokenAt(BigInt.fromI32(i))
      if (!nToken.reverted) {
        let token = loadToken(nToken.value, this.block)
        let poolToken = loadOrCreatePoolToken(this.poolAddress, token, this.block)
        poolTokens.push(poolToken)
      } else {
        log.info('Not able to fetch nToken {}', [i.toString()])
      }
    }

    return poolTokens
  }

  /**
   * Get the balance of all tokens in the pool.
   * @returns The balance of all tokens in the pool
   */
  eth_getPoolAllTokensBalance(): ClipperPool__allTokensBalanceResult {
    let poolContract = this.getPoolContract()
    let allTokensBalanceReverted: boolean
    // ClipperDirectExchangeV0 does not have the allTokensBalance function
    if (this.sourceAbi === 'ClipperDirectExchangeV0') {
      allTokensBalanceReverted = true
    } else {
      let allTokensBalanceResult = poolContract.try_allTokensBalance()
      if (allTokensBalanceResult.reverted) {
        log.warning('Failed to get all tokens balance for pool {}. Using fallback method of multiple calls.', [
          this.poolAddress.toHexString(),
        ])
        allTokensBalanceReverted = true
      }
      return allTokensBalanceResult.value
    }
    let pool = this.loadPool()
    let poolTokens = pool.tokens.load()
    let poolTokenBalances = new Array<BigInt>()
    let poolTokenAddresses = new Array<Address>()
    for (let i = 0; i < poolTokens.length; i++) {
      let tokenAddress = Address.fromBytes(poolTokens[i].token)
      poolTokenAddresses.push(tokenAddress)
      poolTokenBalances.push(poolContract.balanceOf(tokenAddress))
    }
    let allTokensBalance = new ClipperPool__allTokensBalanceResult(
      poolTokenBalances,
      poolTokenAddresses,
      poolContract.totalSupply(),
    )
    return allTokensBalance
  }

  /**
   * Update the liquidity of the pool tokens.
   * Supports adding new tokens to the pool as the balances come from the pool assets set.
   * @param allTokensBalance - The balance of all tokens in the pool
   * @returns The liquidity of the pool tokens
   */
  updatePoolTokensLiquidity(allTokensBalance: ClipperPool__allTokensBalanceResult): BigDecimal {
    let currentLiquidity = BIG_DECIMAL_ZERO
    for (let i: i32 = 0; i < allTokensBalance.value0.length; i++) {
      let tokenAddress = allTokensBalance.value1[i]
      const token = loadToken(tokenAddress, this.block)
      let tokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], token.decimals)
      const poolToken = loadOrCreatePoolToken(this.poolAddress, token, this.block)
      const usdTokenLiquidity = tokenBalance.times(token.priceUSD)
      currentLiquidity = currentLiquidity.plus(usdTokenLiquidity)
      poolToken.tvl = tokenBalance
      poolToken.tvlUSD = usdTokenLiquidity
      poolToken.save()
    }

    return currentLiquidity
  }

  updateExistingPoolTokensLiquidity(): BigDecimal {
    let pool = this.loadPool()
    let poolTokens = pool.tokens.load()
    let currentLiquidity = BIG_DECIMAL_ZERO
    for (let i: i32 = 0; i < poolTokens.length; i++) {
      let poolToken = poolTokens[i]
      let tokenAddress = Address.fromBytes(poolToken.token)
      let token = loadToken(tokenAddress, this.block)
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
    @returns The total supply of the pool token
  */
  eth_getPoolTokenSupply(): BigInt {
    let poolContract = this.getPoolContract()
    let poolTokenSupply = poolContract.totalSupply()

    return poolTokenSupply
  }
}

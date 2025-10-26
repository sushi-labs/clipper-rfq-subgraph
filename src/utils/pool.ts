import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, loadOrCreatePoolToken, loadToken } from './index'
import {
  ClipperDirectExchangeV1,
  ClipperDirectExchangeV1__allTokensBalanceResult,
} from '../../types/templates/ClipperCommonExchangeV0/ClipperDirectExchangeV1'
import { Pool, PoolToken } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from '../constants'
import { ClipperFeeSplitAddressesByPool, PermitRoutersByPool } from '../addresses'
import { eth_fetchBigIntTokenBalance } from './token'

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

      // fee taking fields
      pool.totalFeesTaken = BIG_INT_ZERO
      pool.feesTakenTransactionCount = BIG_INT_ZERO
      pool.totalRevenueUSDTaken = BIG_DECIMAL_ZERO

      if (this.sourceAbi == 'BladeVerifiedExchange' || this.sourceAbi == 'BladeApproximateExchange') {
        pool.feeSplitPoolTokens = BIG_INT_ZERO
      } else {
        let feeSplitAddresses = ClipperFeeSplitAddressesByPool.get(this.poolAddress)
        let initialFeeSplitSupply = BIG_INT_ZERO
        if (feeSplitAddresses !== null && feeSplitAddresses.length > 0) {
          for (let i = 0; i < feeSplitAddresses.length; i++) {
            initialFeeSplitSupply = initialFeeSplitSupply.plus(
              eth_fetchBigIntTokenBalance(this.poolAddress, feeSplitAddresses[i]),
            )
          }
        }
        pool.feeSplitPoolTokens = initialFeeSplitSupply
      }

      let permitRouter = PermitRoutersByPool.get(this.poolAddress)
      if (permitRouter !== null) {
        pool.permitRouter = permitRouter
      }

      pool.save()

      this.eth_loadOrCreatePoolTokens()
    }

    return pool as Pool
  }

  /**
   * Load or create pool tokens.
   * Only used when creating a pool entity. Cached in Pool entities.
   * @returns An array of pool tokens
   */
  eth_loadOrCreatePoolTokens(): PoolToken[] {
    // Supported by both ClipperDirectExchangeV0 and ClipperDirectExchangeV1
    let poolContract = ClipperDirectExchangeV1.bind(this.poolAddress)
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
  eth_getPoolAllTokensBalance(): ClipperDirectExchangeV1__allTokensBalanceResult {
    let poolContract = ClipperDirectExchangeV1.bind(this.poolAddress)
    let allTokensBalanceResult = poolContract.try_allTokensBalance()
    if (!allTokensBalanceResult.reverted) {
      return allTokensBalanceResult.value
    }
    log.warning('Failed to get all tokens balance for pool {}. Using fallback method of multiple calls.', [
      this.poolAddress.toHexString(),
    ])

    // totalSupply and balanceOf are supported by both ClipperDirectExchangeV0 and ClipperDirectExchangeV1
    let pool = this.loadPool()
    let poolTokens = pool.tokens.load()
    let poolTokenBalances = new Array<BigInt>()
    let poolTokenAddresses = new Array<Address>()
    for (let i = 0; i < poolTokens.length; i++) {
      let tokenAddress = Address.fromBytes(poolTokens[i].token)
      poolTokenAddresses.push(tokenAddress)
      poolTokenBalances.push(eth_fetchBigIntTokenBalance(tokenAddress, this.poolAddress))
    }
    let allTokensBalance = new ClipperDirectExchangeV1__allTokensBalanceResult(
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
  updatePoolTokensLiquidity(allTokensBalance: ClipperDirectExchangeV1__allTokensBalanceResult): BigDecimal {
    let currentLiquidity = BIG_DECIMAL_ZERO
    for (let i: i32 = 0; i < allTokensBalance.value0.length; i++) {
      let tokenAddress = allTokensBalance.value1[i]
      const token = loadToken(tokenAddress, this.block)
      let tokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], token.decimals)
      const poolToken = loadOrCreatePoolToken(this.poolAddress, token, this.block)
      let priceUSD = token.priceUSD
      const usdTokenLiquidity = priceUSD ? tokenBalance.times(priceUSD) : BIG_DECIMAL_ZERO
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
      let priceUSD = token.priceUSD
      const usdTokenLiquidity = priceUSD ? poolToken.tvl.times(priceUSD) : BIG_DECIMAL_ZERO
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
    // totalSupply is supported by both ClipperDirectExchangeV0 and ClipperDirectExchangeV1
    let poolContract = ClipperDirectExchangeV1.bind(this.poolAddress)
    let poolTokenSupply = poolContract.totalSupply()

    return poolTokenSupply
  }
}

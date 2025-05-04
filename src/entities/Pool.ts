import { Bytes, ethereum } from '@graphprotocol/graph-ts'
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from '../constants'
import { Pool } from '../../types/schema'
import { loadOrCreatePoolTokens } from '../utils/pool'

export function loadPool(address: Bytes, block: ethereum.Block): Pool {
  let pool = Pool.load(address)

  if (!pool) {
    pool = new Pool(address)
    pool.createdAt = block.timestamp.toI32()
    // swaps
    pool.avgTrade = BIG_DECIMAL_ZERO
    pool.volumeUSD = BIG_DECIMAL_ZERO
    pool.txCount = BIG_INT_ZERO

    pool.feeUSD = BIG_DECIMAL_ZERO
    pool.avgTradeFee = BIG_DECIMAL_ZERO
    pool.avgFeeInBps = BIG_DECIMAL_ZERO
    pool.revenueUSD = BIG_DECIMAL_ZERO

    //deposits
    pool.avgDeposit = BIG_DECIMAL_ZERO
    pool.depositedUSD = BIG_DECIMAL_ZERO
    pool.depositCount = BIG_INT_ZERO

    // withdrawals
    pool.avgWithdraw = BIG_DECIMAL_ZERO
    pool.withdrewUSD = BIG_DECIMAL_ZERO
    pool.withdrawalCount = BIG_INT_ZERO

    pool.poolTokensSupply = BIG_INT_ZERO
    pool.uniqueUsers = BIG_INT_ZERO

    pool.save()

    loadOrCreatePoolTokens(address, block)
  }

  return pool as Pool
}



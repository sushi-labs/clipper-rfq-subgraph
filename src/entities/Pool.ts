import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { DailyPoolStatus, HourlyPoolStatus, Pool } from '../../types/schema'
import { ClipperFeeSplitAddressesByDirectExchange, clipperFeeSplitAddress } from '../addresses'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, ONE_DAY, ONE_HOUR } from '../constants'
import { getCurrentPoolLiquidity, getPoolTokenSupply } from '../utils/pool'
import { getOpenTime } from '../utils/timeHelpers'
import { fetchBigIntTokenBalance } from '../utils/token'

export function loadPool(address: Address): Pool {
  let pool = Pool.load(address.toHex())

  if (!pool) {
    pool = new Pool(address.toHex())

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
  }

  return pool as Pool
}

// TODO: refactor creating and updating to same function across different intervals (day, hour, etc ...)
export function getDailyPoolStatus(pool: Pool, timestamp: BigInt): DailyPoolStatus {
  let openTime = getOpenTime(timestamp, ONE_DAY)
  let from = openTime
  let to = openTime.plus(ONE_DAY).minus(BIG_INT_ONE)

  let id = pool.id
    .concat('-')
    .concat(from.toString())
    .concat(to.toString())

  let dailyPoolStatus = DailyPoolStatus.load(id)

  if (dailyPoolStatus == null) {
    dailyPoolStatus = new DailyPoolStatus(id)

    // swaps
    dailyPoolStatus.avgTrade = BIG_DECIMAL_ZERO
    dailyPoolStatus.volumeUSD = BIG_DECIMAL_ZERO
    dailyPoolStatus.txCount = BIG_INT_ZERO

    dailyPoolStatus.feeUSD = BIG_DECIMAL_ZERO
    dailyPoolStatus.avgTradeFee = BIG_DECIMAL_ZERO
    dailyPoolStatus.avgFeeInBps = BIG_DECIMAL_ZERO
    dailyPoolStatus.revenueUSD = BIG_DECIMAL_ZERO

    //deposits
    dailyPoolStatus.avgDeposit = BIG_DECIMAL_ZERO
    dailyPoolStatus.depositedUSD = BIG_DECIMAL_ZERO
    dailyPoolStatus.depositCount = BIG_INT_ZERO

    // withdrawals
    dailyPoolStatus.avgWithdraw = BIG_DECIMAL_ZERO
    dailyPoolStatus.withdrewUSD = BIG_DECIMAL_ZERO
    dailyPoolStatus.withdrawalCount = BIG_INT_ZERO

    dailyPoolStatus.pool = pool.id
    dailyPoolStatus.from = from
    dailyPoolStatus.to = to
    dailyPoolStatus.poolTokensSupply = BIG_INT_ZERO
    dailyPoolStatus.poolValue = getCurrentPoolLiquidity(pool.id)

    dailyPoolStatus.save()
  }

  return dailyPoolStatus
}

export function getHourlyPoolStatus(pool: Pool, timestamp: BigInt): HourlyPoolStatus {
  let openTime = getOpenTime(timestamp, ONE_HOUR)
  let from = openTime
  let to = openTime.plus(ONE_HOUR).minus(BIG_INT_ONE)

  let id = pool.id
    .concat('-')
    .concat(from.toString())
    .concat(to.toString())

  let hourlyPoolStatus = HourlyPoolStatus.load(id)

  if (!hourlyPoolStatus) {
    hourlyPoolStatus = new HourlyPoolStatus(id)

    // swaps
    hourlyPoolStatus.avgTrade = BIG_DECIMAL_ZERO
    hourlyPoolStatus.volumeUSD = BIG_DECIMAL_ZERO
    hourlyPoolStatus.txCount = BIG_INT_ZERO

    hourlyPoolStatus.feeUSD = BIG_DECIMAL_ZERO
    hourlyPoolStatus.avgTradeFee = BIG_DECIMAL_ZERO
    hourlyPoolStatus.avgFeeInBps = BIG_DECIMAL_ZERO
    hourlyPoolStatus.revenueUSD = BIG_DECIMAL_ZERO

    //deposits
    hourlyPoolStatus.avgDeposit = BIG_DECIMAL_ZERO
    hourlyPoolStatus.depositedUSD = BIG_DECIMAL_ZERO
    hourlyPoolStatus.depositCount = BIG_INT_ZERO

    // withdrawals
    hourlyPoolStatus.avgWithdraw = BIG_DECIMAL_ZERO
    hourlyPoolStatus.withdrewUSD = BIG_DECIMAL_ZERO
    hourlyPoolStatus.withdrawalCount = BIG_INT_ZERO

    hourlyPoolStatus.pool = pool.id
    hourlyPoolStatus.from = from
    hourlyPoolStatus.to = to
    hourlyPoolStatus.poolValue = getCurrentPoolLiquidity(pool.id)

    hourlyPoolStatus.save()
  }

  return hourlyPoolStatus
}

export function updatePoolStatus(
  event: ethereum.Event,
  addedTxVolume: BigDecimal,
  addNewUser: boolean,
  addedTxFee: BigDecimal,
): Pool {
  let pool = loadPool(event.address)
  pool.txCount = pool.txCount.plus(BIG_INT_ONE)
  pool.volumeUSD = pool.volumeUSD.plus(addedTxVolume)
  pool.avgTrade = pool.volumeUSD.div(pool.txCount.toBigDecimal())
  pool.feeUSD = pool.feeUSD.plus(addedTxFee)
  pool.avgTradeFee = pool.feeUSD.div(pool.txCount.toBigDecimal())
  pool.avgFeeInBps = pool.feeUSD
    .div(pool.volumeUSD)
    .times(BigDecimal.fromString('100'))
    .times(BigDecimal.fromString('100'))

  if (addNewUser) {
    pool.uniqueUsers = pool.uniqueUsers.plus(BIG_INT_ONE)
  }

  let poolTokensSupply = getPoolTokenSupply(pool.id)
  let feeSplitAddresses = ClipperFeeSplitAddressesByDirectExchange.get(pool.id.toLowerCase())
  let poolTokenOwnedByFeeSplit: BigInt = BIG_INT_ZERO
  if (feeSplitAddresses !== null && feeSplitAddresses.length > 0) {
    for (let i = 0; i < feeSplitAddresses.length; i++) {
      poolTokenOwnedByFeeSplit = poolTokenOwnedByFeeSplit.plus(
        fetchBigIntTokenBalance(pool.id, Address.fromString(feeSplitAddresses[i])),
      )
    }
  } else {
    poolTokenOwnedByFeeSplit = fetchBigIntTokenBalance(pool.id, clipperFeeSplitAddress)
  }

  // the fraction owned by fee split contract
  let theFraction = poolTokenOwnedByFeeSplit.toBigDecimal().div(poolTokensSupply.toBigDecimal())
  let daoRevenueFraction = event.block.timestamp.ge(BigInt.fromI32(1690848000))
    ? BigDecimal.fromString('1')
    : BigDecimal.fromString('0.5')
  let revenueUSD = addedTxFee.times(theFraction).times(daoRevenueFraction)

  pool.revenueUSD = pool.revenueUSD.plus(revenueUSD)

  updateDailyPoolStatus(pool, event.block.timestamp, addedTxVolume, addedTxFee, poolTokensSupply, revenueUSD)
  updateHourlyPoolStatus(pool, event.block.timestamp, addedTxVolume, addedTxFee, poolTokensSupply, revenueUSD)

  pool.save()

  return pool
}

function updateDailyPoolStatus(
  pool: Pool,
  timestamp: BigInt,
  addedTxVolume: BigDecimal,
  addedTxFee: BigDecimal,
  poolTokensSupply: BigInt,
  revenueUSD: BigDecimal,
): DailyPoolStatus {
  let dailyPoolStatus = getDailyPoolStatus(pool, timestamp)

  dailyPoolStatus.txCount = dailyPoolStatus.txCount.plus(BIG_INT_ONE)
  dailyPoolStatus.volumeUSD = dailyPoolStatus.volumeUSD.plus(addedTxVolume)
  dailyPoolStatus.avgTrade = dailyPoolStatus.volumeUSD.div(dailyPoolStatus.txCount.toBigDecimal())
  dailyPoolStatus.poolTokensSupply = poolTokensSupply
  dailyPoolStatus.feeUSD = dailyPoolStatus.feeUSD.plus(addedTxFee)
  dailyPoolStatus.avgTradeFee = dailyPoolStatus.feeUSD.div(dailyPoolStatus.txCount.toBigDecimal())
  dailyPoolStatus.avgFeeInBps = dailyPoolStatus.feeUSD
    .div(dailyPoolStatus.volumeUSD)
    .times(BigDecimal.fromString('100'))
    .times(BigDecimal.fromString('100'))
  dailyPoolStatus.revenueUSD = dailyPoolStatus.revenueUSD.plus(revenueUSD)

  dailyPoolStatus.save()

  return dailyPoolStatus
}

function updateHourlyPoolStatus(
  pool: Pool,
  timestamp: BigInt,
  addedTxVolume: BigDecimal,
  addedTxFee: BigDecimal,
  poolTokensSupply: BigInt,
  revenueUSD: BigDecimal,
): HourlyPoolStatus {
  let hourlyPoolStatus = getHourlyPoolStatus(pool, timestamp)

  hourlyPoolStatus.txCount = hourlyPoolStatus.txCount.plus(BIG_INT_ONE)
  hourlyPoolStatus.volumeUSD = hourlyPoolStatus.volumeUSD.plus(addedTxVolume)
  hourlyPoolStatus.feeUSD = hourlyPoolStatus.feeUSD.plus(addedTxFee)
  hourlyPoolStatus.revenueUSD = hourlyPoolStatus.revenueUSD.plus(revenueUSD)
  hourlyPoolStatus.avgTrade = hourlyPoolStatus.volumeUSD.div(hourlyPoolStatus.txCount.toBigDecimal())
  hourlyPoolStatus.avgTradeFee = hourlyPoolStatus.feeUSD.div(hourlyPoolStatus.txCount.toBigDecimal())
  if (addedTxVolume.gt(BIG_DECIMAL_ZERO)) {
    hourlyPoolStatus.avgFeeInBps = hourlyPoolStatus.feeUSD
      .div(hourlyPoolStatus.volumeUSD)
      .times(BigDecimal.fromString('100'))
      .times(BigDecimal.fromString('100'))
  }

  hourlyPoolStatus.save()

  return hourlyPoolStatus
}

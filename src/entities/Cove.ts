import { Bytes, BigInt, Address } from '@graphprotocol/graph-ts'
import { AllCovesHistoricStatus, AllCoveStatus, Cove, HistoricCoveStatus, UserCoveStake } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, ONE_DAY, ONE_HOUR } from '../constants'
import { loadToken } from '../utils'
import { getOpenTime } from '../utils/timeHelpers'
import { loadPool } from './Pool'
import { getCovePoolAddress } from '../utils/cove'

export function loadCove(
  coveAddress: Address,
  tokenAddress: Address,
  creator: Bytes,
  timestamp: BigInt,
  transaction: Bytes,
): Cove {
  let id = coveAddress
    .toHexString()
    .concat('-')
    .concat(tokenAddress.toHexString())
  let cove = Cove.load(id)

  if (!cove) {
    let coveAsset = loadToken(tokenAddress)
    let poolAddress = getCovePoolAddress(coveAddress)
    let pool = loadPool(poolAddress)

    cove = new Cove(id)
    cove.pool = pool.id
    cove.longtailAsset = coveAsset.id
    cove.coveAssetName = coveAsset.name
    cove.coveAssetSymbol = coveAsset.symbol
    cove.createdAt = timestamp
    cove.creator = creator
    cove.transaction = transaction

    // balance state
    cove.poolTokenAmount = BIG_DECIMAL_ZERO
    cove.longtailTokenAmount = BIG_DECIMAL_ZERO
    cove.tvlUSD = BIG_DECIMAL_ZERO

    // swaps
    cove.volumeUSD = BIG_DECIMAL_ZERO
    cove.swapCount = BIG_INT_ZERO

    //deposits
    cove.depositCount = BIG_INT_ZERO

    // withdrawals
    cove.withdrawalCount = BIG_INT_ZERO

    cove.save()
  }

  return cove as Cove
}

export function loadUserCoveStake(coveId: string, userWallet: Address): UserCoveStake {
  let id = coveId.concat('-').concat(userWallet.toHexString())
  let stake = UserCoveStake.load(id)

  if (!stake) {
    stake = new UserCoveStake(id)
    stake.user = userWallet
    stake.cove = coveId
    stake.depositTokens = BIG_INT_ZERO
    stake.active = true

    stake.save()
  }

  return stake as UserCoveStake
}

export function loadAllCoveStatus(coveAddress: Address): AllCoveStatus {
  let allStatus = AllCoveStatus.load(coveAddress.toHexString())

  if (!allStatus) {
    allStatus = new AllCoveStatus(coveAddress.toHexString())

    allStatus.txCount = 0
    allStatus.depositCount = 0
    allStatus.withdrawalCount = 0
    allStatus.volumeUSD = BIG_DECIMAL_ZERO

    allStatus.save()
  }

  return allStatus as AllCoveStatus
}

export function loadHistoricAllCoveStatus(coveAddress: Address, timestamp: BigInt, statusType: string): AllCovesHistoricStatus {
  let timeRange = statusType === 'HOURLY' ? ONE_HOUR : ONE_DAY
  let openTime = getOpenTime(timestamp, timeRange)
  let from = openTime
  let to = openTime.plus(timeRange).minus(BIG_INT_ONE)
  let id = coveAddress
    .toHexString()
    .concat('-')
    .concat(from.toString())
    .concat(to.toString())

  let allStatusHistoric = AllCovesHistoricStatus.load(id)

  if (!allStatusHistoric) {
    allStatusHistoric = new AllCovesHistoricStatus(id)

    allStatusHistoric.from = from
    allStatusHistoric.to = to
    allStatusHistoric.volumeUSD = BIG_DECIMAL_ZERO
    allStatusHistoric.depositCount = 0
    allStatusHistoric.withdrawalCount = 0
    allStatusHistoric.txCount = 0
    allStatusHistoric.statusType = statusType

    allStatusHistoric.save()
  }

  return allStatusHistoric as AllCovesHistoricStatus
}

export function loadHistoricCoveStatus(cove: Cove, timestamp: BigInt, statusType: string): HistoricCoveStatus {
  let timeRange = statusType === 'HOURLY' ? ONE_HOUR : ONE_DAY
  let openTime = getOpenTime(timestamp, timeRange)
  let from = openTime
  let to = openTime.plus(timeRange).minus(BIG_INT_ONE)

  let id = cove.id
    .concat('-')
    .concat(from.toString())
    .concat(to.toString())

  let historicCoveStatus = HistoricCoveStatus.load(id)

  if (!historicCoveStatus) {
    historicCoveStatus = new HistoricCoveStatus(id)

    historicCoveStatus.from = from
    historicCoveStatus.to = to
    historicCoveStatus.volumeUSD = BIG_DECIMAL_ZERO
    historicCoveStatus.price = BIG_DECIMAL_ZERO
    historicCoveStatus.txCount = 0
    historicCoveStatus.statusType = statusType
    historicCoveStatus.cove = cove.id
    historicCoveStatus.depositCount = 0
    historicCoveStatus.withdrawalCount = 0

    historicCoveStatus.save()
  }

  return historicCoveStatus as HistoricCoveStatus
}

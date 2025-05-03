import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  AssetWithdrawn,
  Deposited,
  Swapped,
  Transfer,
  Withdrawn,
} from '../types/ClipperDirectExchange/ClipperDirectExchange'
import { Deposit, Swap, Withdrawal } from '../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE } from './constants'
import { updatePair, updatePoolPair } from './entities/Pair'
import { getDailyPoolStatus, getHourlyPoolStatus, loadPool, updatePoolStatus } from './entities/Pool'
import { upsertUser } from './entities/User'
import { convertTokenToDecimal, loadPoolTransactionSource, loadToken, loadTransactionSource } from './utils'
import { getCurrentPoolLiquidity, getPoolTokenSupply } from './utils/pool'
import { getUsdPrice } from './utils/prices'
import { fetchTokenBalance } from './utils/token'
import { clipperFarmingHelperAddress, clipperPermitRouterAddress } from './addresses'

export function handleDeposited(event: Deposited): void {
  let pool = loadPool(event.address)
  let timestamp = event.block.timestamp
  let txHash = event.transaction.hash.toHexString()
  let currentPoolLiquidity = getCurrentPoolLiquidity(pool.id)
  let poolTokenSupply = getPoolTokenSupply(pool.id)
  let receivedPoolTokens = convertTokenToDecimal(event.params.poolTokens, BigInt.fromI32(18))
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BigInt.fromI32(18))

  let poolOwnedAmount = receivedPoolTokens.div(totalPoolTokens)
  let usdProportion = currentPoolLiquidity.times(poolOwnedAmount)

  let newDeposit = new Deposit(txHash)
  newDeposit.timestamp = timestamp
  newDeposit.pool = event.address.toHexString()
  newDeposit.poolTokens = receivedPoolTokens
  newDeposit.amountUsd = usdProportion
  if (event.params.depositor.equals(clipperFarmingHelperAddress)) {
    newDeposit.depositor = event.transaction.from
  } else {
    newDeposit.depositor = event.params.depositor
  }

  pool.poolTokensSupply = poolTokenSupply
  pool.depositCount = pool.depositCount.plus(BIG_INT_ONE)
  pool.depositedUSD = pool.depositedUSD.plus(usdProportion)
  pool.avgDeposit = pool.depositedUSD.div(pool.depositCount.toBigDecimal())

  // UPDATE DAILY DEPOSIT VALUE
  let dailyPoolStatus = getDailyPoolStatus(pool, timestamp)
  dailyPoolStatus.depositCount = dailyPoolStatus.depositCount.plus(BIG_INT_ONE)
  dailyPoolStatus.depositedUSD = dailyPoolStatus.depositedUSD.plus(usdProportion)
  dailyPoolStatus.avgDeposit = dailyPoolStatus.depositedUSD.div(dailyPoolStatus.depositCount.toBigDecimal())

  // UPDATE HOURLY DEPOSIT VALUE
  let hourlyPoolStatus = getHourlyPoolStatus(pool, timestamp)
  hourlyPoolStatus.depositCount = hourlyPoolStatus.depositCount.plus(BIG_INT_ONE)
  hourlyPoolStatus.depositedUSD = hourlyPoolStatus.depositedUSD.plus(usdProportion)
  hourlyPoolStatus.avgDeposit = hourlyPoolStatus.depositedUSD.div(hourlyPoolStatus.depositCount.toBigDecimal())

  newDeposit.save()
  hourlyPoolStatus.save()
  dailyPoolStatus.save()
  pool.save()
}

function handleWithdrawnEvents(event: ethereum.Event, poolTokens: BigInt, withdrawer: Address): void {
  let pool = loadPool(event.address)
  let currentPoolLiquidity = getCurrentPoolLiquidity(pool.id)
  let poolTokenSupply = getPoolTokenSupply(pool.id)

  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BigInt.fromI32(18))
  let burntPoolTokens = convertTokenToDecimal(poolTokens, BigInt.fromI32(18))

  let burntProportion = burntPoolTokens.div(totalPoolTokens.plus(burntPoolTokens))
  let usdProportion = currentPoolLiquidity.times(burntProportion)

  let newWithdrawal = new Withdrawal(event.transaction.hash.toHexString())
  newWithdrawal.timestamp = event.block.timestamp
  newWithdrawal.amountUsd = usdProportion
  newWithdrawal.poolTokens = burntPoolTokens
  newWithdrawal.pool = event.address.toHexString()
  newWithdrawal.withdrawer = withdrawer

  pool.poolTokensSupply = poolTokenSupply
  pool.withdrawalCount = pool.withdrawalCount.plus(BIG_INT_ONE)
  pool.withdrewUSD = pool.withdrewUSD.plus(usdProportion)
  pool.avgDeposit = pool.withdrewUSD.div(pool.withdrawalCount.toBigDecimal())

  // UPDATE DAILY WITHDRAWAL VALUE
  let dailyPoolStatus = getDailyPoolStatus(pool, event.block.timestamp)
  dailyPoolStatus.withdrawalCount = dailyPoolStatus.withdrawalCount.plus(BIG_INT_ONE)
  dailyPoolStatus.withdrewUSD = dailyPoolStatus.withdrewUSD.plus(usdProportion)
  dailyPoolStatus.avgWithdraw = dailyPoolStatus.withdrewUSD.div(dailyPoolStatus.withdrawalCount.toBigDecimal())

  // UPDATE HOURLY WITHDRAWAL VALUE
  let hourlyPoolStatus = getHourlyPoolStatus(pool, event.block.timestamp)
  hourlyPoolStatus.withdrawalCount = hourlyPoolStatus.withdrawalCount.plus(BIG_INT_ONE)
  hourlyPoolStatus.withdrewUSD = hourlyPoolStatus.withdrewUSD.plus(usdProportion)
  hourlyPoolStatus.avgWithdraw = hourlyPoolStatus.withdrewUSD.div(hourlyPoolStatus.withdrawalCount.toBigDecimal())

  newWithdrawal.save()
  dailyPoolStatus.save()
  hourlyPoolStatus.save()
  pool.save()
}

export function handleWithdrawn(event: Withdrawn): void {
  handleWithdrawnEvents(event, event.params.poolTokens, event.params.withdrawer)
}

export function handleSingleAssetWithdrawn(event: AssetWithdrawn): void {
  handleWithdrawnEvents(event, event.params.poolTokens, event.params.withdrawer)
}

export function handleSwapped(event: Swapped): void {
  let poolId = event.address.toHexString()
  let inAsset = loadToken(event.params.inAsset)
  let outAsset = loadToken(event.params.outAsset)
  let poolAddress = event.address

  let amountIn = convertTokenToDecimal(event.params.inAmount, inAsset.decimals)
  let amountOut = convertTokenToDecimal(event.params.outAmount, outAsset.decimals)

  let inputPrice = getUsdPrice(inAsset.symbol)
  let outputPrice = getUsdPrice(outAsset.symbol)
  let amountInUsd = inputPrice.times(amountIn)
  let amountOutUsd = outputPrice.times(amountOut)
  let transactionVolume = amountInUsd.plus(amountOutUsd).div(BigDecimal.fromString('2'))

  // token balances
  let inTokenBalance = fetchTokenBalance(inAsset, poolAddress)
  let outTokenBalance = fetchTokenBalance(outAsset, poolAddress)
  let inTokenBalanceUsd = inputPrice.times(inTokenBalance)
  let outTokenBalanceUsd = outputPrice.times(outTokenBalance)

  let swap = new Swap(
    event.transaction.hash
      .toHex()
      .concat('-')
      .concat(event.logIndex.toString()),
  )
  swap.transaction = event.transaction.hash
  swap.timestamp = event.block.timestamp
  swap.inToken = inAsset.id
  swap.outToken = outAsset.id
  swap.origin = event.transaction.from
  swap.recipient = event.params.recipient
  swap.amountIn = amountIn
  swap.amountOut = amountOut
  swap.amountInRaw = event.params.inAmount
  swap.amountOutRaw = event.params.outAmount
  swap.logIndex = event.logIndex
  swap.pricePerInputToken = inputPrice
  swap.pricePerOutputToken = outputPrice
  swap.amountInUSD = amountInUsd
  swap.amountOutUSD = amountOutUsd
  swap.pool = poolId
  swap.swapType = 'POOL'

  let feeUSD = amountInUsd.minus(amountOutUsd).lt(BIG_DECIMAL_ZERO) ? BIG_DECIMAL_ZERO : amountInUsd.minus(amountOutUsd)
  swap.feeUSD = feeUSD

  // update assets values

  // if both assets are the same, update just one with the subtraction of both amounts
  if (inAsset.id === outAsset.id) {
    inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
    inAsset.volume = inAsset.volume.plus(amountIn.plus(amountOut).div(BigDecimal.fromString('2')))
    inAsset.volumeUSD = inAsset.volumeUSD.plus(transactionVolume)
    inAsset.tvl = inTokenBalance
    inAsset.tvlUSD = inTokenBalanceUsd
    inAsset.save()
  } else {
    outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)
    outAsset.volume = outAsset.volume.plus(amountOut)
    outAsset.volumeUSD = outAsset.volumeUSD.plus(amountOutUsd)
    outAsset.tvl = outTokenBalance
    outAsset.tvlUSD = outTokenBalanceUsd
    outAsset.save()

    inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
    inAsset.volume = inAsset.volume.plus(amountIn)
    inAsset.volumeUSD = inAsset.volumeUSD.plus(amountInUsd)
    inAsset.tvl = inTokenBalance
    inAsset.tvlUSD = inTokenBalanceUsd
    inAsset.save()
  }

  let txSource = loadTransactionSource(event.params.auxiliaryData)
  let poolTxSource = loadPoolTransactionSource(poolId, txSource.id)
  swap.transactionSource = txSource.id
  txSource.txCount = txSource.txCount.plus(BIG_INT_ONE)
  txSource.volumeUSD = txSource.volumeUSD.plus(transactionVolume)
  poolTxSource.txCount = poolTxSource.txCount.plus(BIG_INT_ONE)
  poolTxSource.volumeUSD = poolTxSource.volumeUSD.plus(transactionVolume)

  let workingPair = updatePair(
    event.params.inAsset.toHexString(),
    event.params.outAsset.toHexString(),
    transactionVolume,
  )
  updatePoolPair(poolId, workingPair.id, transactionVolume)
  let isUnique = upsertUser(event.transaction.from.toHexString(), event.block.timestamp, transactionVolume)
  swap.pair = workingPair.id
  swap.sender = event.transaction.from.toHexString()
  updatePoolStatus(event, transactionVolume, isUnique, feeUSD)

  swap.save()
  txSource.save()
  poolTxSource.save()
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from.equals(clipperPermitRouterAddress)) {
    let deposit = Deposit.load(event.transaction.hash.toHexString())
    if (!deposit) {
      return
    }

    deposit.depositor = event.params.to
    deposit.save()
  }
}

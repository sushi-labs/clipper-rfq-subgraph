import { Address, BigDecimal, dataSource } from '@graphprotocol/graph-ts'
import { CoveDeposited, CoveSwapped, CoveWithdrawn } from '../types/ClipperCove/ClipperCove'
import { CoveDeposit, CoveWithdrawal, Swap } from '../types/schema'
import { AddressZeroAddress, clipperDirectExchangeAddress } from './addresses'
import { ADDRESS_ZERO, BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, LongTailType } from './constants'
import {
  loadAllCoveStatus,
  loadCove,
  loadHistoricAllCoveStatus,
  loadHistoricCoveStatus,
  loadUserCoveStake,
} from './entities/Cove'
import { upsertUser } from './entities/User'
import { convertTokenToDecimal, loadToken, loadTransactionSource } from './utils'
import { getCoveAssetPrice, getUsdPrice } from './utils/prices'
import { fetchTokenBalance } from './utils/token'

export function handleCoveDeposited(event: CoveDeposited): void {
  let coveAddress = event.params.tokenAddress
  let cove = loadCove(coveAddress, event.params.depositor, event.block.timestamp, event.transaction.hash)
  let coveAsset = loadToken(event.params.tokenAddress)
  let userCoveStake = loadUserCoveStake(cove.id, event.params.depositor)
  let allCoveStatus = loadAllCoveStatus()
  let dailyCoveStatus = loadHistoricCoveStatus(cove, event.block.timestamp, 'DAILY')
  let dailyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'DAILY')
  let hourlyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'HOURLY')

  // internal deposit token for cove info
  let internalDepositTokens = event.params.poolTokens
  let internalTotalDepositTokens = event.params.poolTokensAfterDeposit

  // general info
  let coveInfo = getCoveAssetPrice(coveAddress, coveAsset.decimals.toI32())
  let covePoolTokens = coveInfo.get('poolTokenBalance') as BigDecimal
  let longTailTokens = coveInfo.get('longtailAssetBalance') as BigDecimal
  let coveLiquidity = coveInfo.get('coveLiquidity') as BigDecimal
  let covePrice = coveInfo.get('assetPrice') as BigDecimal

  let depositOwnedFraction = internalDepositTokens.toBigDecimal().div(internalTotalDepositTokens.toBigDecimal())

  let estimatedUsdDepositValue = coveLiquidity.times(depositOwnedFraction)

  cove.depositCount = cove.depositCount.plus(BIG_INT_ONE)
  cove.poolTokenAmount = covePoolTokens
  cove.longtailTokenAmount = longTailTokens
  cove.tvlUSD = coveLiquidity
  coveAsset.tvl = longTailTokens
  coveAsset.tvlUSD = coveLiquidity.div(BigDecimal.fromString('2'))
  coveAsset.depositedUSD = coveAsset.depositedUSD.plus(estimatedUsdDepositValue)

  userCoveStake.active = true
  userCoveStake.depositTokens = userCoveStake.depositTokens.plus(internalDepositTokens)

  let newDeposit = new CoveDeposit(event.transaction.hash.toHexString())
  newDeposit.timestamp = event.block.timestamp
  newDeposit.cove = cove.id
  newDeposit.amountUsd = estimatedUsdDepositValue
  newDeposit.depositor = event.params.depositor

  allCoveStatus.depositCount = allCoveStatus.depositCount + 1
  dailyCoveStatus.depositCount = dailyCoveStatus.depositCount + 1
  dailyCoveStatus.price = covePrice
  dailyAllCoveStatus.depositCount = dailyAllCoveStatus.depositCount + 1
  hourlyAllCoveStatus.depositCount = dailyAllCoveStatus.depositCount + 1

  dailyCoveStatus.save()
  allCoveStatus.save()
  dailyAllCoveStatus.save()
  hourlyAllCoveStatus.save()
  newDeposit.save()
  cove.save()
  userCoveStake.save()
  coveAsset.save()
}

export function handleCoveSwapped(event: CoveSwapped): void {
  let inAssetAddress =
    event.params.inAsset.toHex() == ADDRESS_ZERO ? Address.fromString(AddressZeroAddress) : event.params.inAsset
  let outAssetAddress =
    event.params.outAsset.toHex() == ADDRESS_ZERO ? Address.fromString(AddressZeroAddress) : event.params.outAsset

  let inAsset = loadToken(inAssetAddress)
  let outAsset = loadToken(outAssetAddress)

  let inAmount = convertTokenToDecimal(event.params.inAmount, inAsset.decimals)
  let outAmount = convertTokenToDecimal(event.params.outAmount, outAsset.decimals)

  let inputPrice: BigDecimal
  let outputPrice: BigDecimal
  let inTokenBalance: BigDecimal
  let outTokenBalance: BigDecimal
  let inTokenBalanceUsd: BigDecimal
  let outTokenBalanceUsd: BigDecimal
  let inCovePoolTokenAmount: BigDecimal
  let outCovePoolTokenAmount: BigDecimal
  let inCoveLiquidity: BigDecimal
  let outCoveLiquidity: BigDecimal

  if (inAsset.type == LongTailType) {
    let coveAssetPrice = getCoveAssetPrice(inAssetAddress, inAsset.decimals.toI32())
    inputPrice = coveAssetPrice.get('assetPrice') as BigDecimal
    inTokenBalance = coveAssetPrice.get('assetBalance') as BigDecimal
    inTokenBalanceUsd = inTokenBalance.times(inputPrice)
    inCovePoolTokenAmount = coveAssetPrice.get('poolTokenBalance') as BigDecimal
    inCoveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
  } else {
    inputPrice = getUsdPrice(inAsset.symbol)
    inTokenBalance = fetchTokenBalance(inAsset, clipperDirectExchangeAddress)
    inTokenBalanceUsd = inputPrice.times(inTokenBalance)
  }

  if (outAsset.type == LongTailType) {
    let coveAssetPrice = getCoveAssetPrice(outAssetAddress, outAsset.decimals.toI32())
    outputPrice = coveAssetPrice.get('assetPrice') as BigDecimal
    outTokenBalance = coveAssetPrice.get('assetBalance') as BigDecimal
    outTokenBalanceUsd = outTokenBalance.times(outputPrice)
    outCovePoolTokenAmount = coveAssetPrice.get('poolTokenBalance') as BigDecimal
    outCoveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
  } else {
    outputPrice = getUsdPrice(outAsset.symbol)
    outTokenBalance = fetchTokenBalance(outAsset, clipperDirectExchangeAddress)
    outTokenBalanceUsd = outputPrice.times(outTokenBalance)
  }

  let amountInUsd = inputPrice.times(inAmount)
  let amountOutUsd = outputPrice.times(outAmount)
  let transactionVolume = amountInUsd.plus(amountOutUsd).div(BigDecimal.fromString('2'))

  inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
  outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)

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
  swap.amountIn = inAmount
  swap.amountOut = outAmount
  swap.amountInRaw = event.params.inAmount
  swap.amountOutRaw = event.params.outAmount
  swap.logIndex = event.logIndex
  swap.pricePerInputToken = inputPrice
  swap.pricePerOutputToken = outputPrice
  swap.amountInUSD = amountInUsd
  swap.amountOutUSD = amountOutUsd
  swap.swapType = 'COVE'

  let feeUSD = amountInUsd.minus(amountOutUsd).lt(BIG_DECIMAL_ZERO) ? BIG_DECIMAL_ZERO : amountInUsd.minus(amountOutUsd)
  swap.feeUSD = feeUSD

  outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)
  outAsset.volume = outAsset.volume.plus(outAmount)
  outAsset.volumeUSD = outAsset.volumeUSD.plus(amountOutUsd)
  outAsset.tvl = outTokenBalance
  outAsset.tvlUSD = outTokenBalanceUsd
  outAsset.save()

  inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
  inAsset.volume = inAsset.volume.plus(inAmount)
  inAsset.volumeUSD = inAsset.volumeUSD.plus(amountInUsd)
  inAsset.tvl = inTokenBalance
  inAsset.tvlUSD = inTokenBalanceUsd
  inAsset.save()

  let txSource = loadTransactionSource(event.params.auxiliaryData)
  swap.transactionSource = txSource.id
  txSource.txCount = txSource.txCount.plus(BIG_INT_ONE)

  let allCoveStatus = loadAllCoveStatus()
  allCoveStatus.txCount = allCoveStatus.txCount + 1
  allCoveStatus.volumeUSD = allCoveStatus.volumeUSD.plus(allCoveStatus.volumeUSD)

  let dailyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'DAILY')
  dailyAllCoveStatus.txCount = dailyAllCoveStatus.txCount + 1
  dailyAllCoveStatus.volumeUSD = dailyAllCoveStatus.volumeUSD.plus(transactionVolume)

  let hourlyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'HOURLY')
  hourlyAllCoveStatus.txCount = hourlyAllCoveStatus.txCount + 1
  hourlyAllCoveStatus.volumeUSD = hourlyAllCoveStatus.volumeUSD.plus(transactionVolume)

  let isUnique = upsertUser(event.transaction.from.toHexString(), event.block.timestamp, transactionVolume)
  swap.sender = event.transaction.from.toHexString()

  if (inAsset.type == LongTailType) {
    let cove = loadCove(inAssetAddress, event.params.recipient, event.block.timestamp, event.transaction.hash)
    let dailyCoveStatus = loadHistoricCoveStatus(cove, event.block.timestamp, 'DAILY')
    cove.swapCount = cove.swapCount.plus(BIG_INT_ONE)
    cove.poolTokenAmount = inCovePoolTokenAmount
    cove.longtailTokenAmount = inTokenBalance
    cove.volumeUSD = cove.volumeUSD.plus(transactionVolume)
    if (inCoveLiquidity) {
      cove.tvlUSD = inCoveLiquidity
    }

    swap.cove = cove.id

    dailyCoveStatus.txCount = dailyCoveStatus.txCount + 1
    dailyCoveStatus.volumeUSD = dailyCoveStatus.volumeUSD.plus(transactionVolume)
    dailyCoveStatus.price = inputPrice

    dailyCoveStatus.save()
    cove.save()
  }

  if (outAsset.type == LongTailType) {
    let cove = loadCove(outAssetAddress, event.params.recipient, event.block.timestamp, event.transaction.hash)
    let dailyCoveStatus = loadHistoricCoveStatus(cove, event.block.timestamp, 'DAILY')
    cove.swapCount = cove.swapCount.plus(BIG_INT_ONE)
    cove.poolTokenAmount = outCovePoolTokenAmount
    cove.longtailTokenAmount = outTokenBalance
    cove.volumeUSD = cove.volumeUSD.plus(transactionVolume)
    if (outCoveLiquidity) {
      cove.tvlUSD = outCoveLiquidity
    }

    swap.cove = cove.id
    dailyCoveStatus.txCount = dailyCoveStatus.txCount + 1
    dailyCoveStatus.volumeUSD = dailyCoveStatus.volumeUSD.plus(transactionVolume)
    dailyCoveStatus.price = outputPrice

    dailyCoveStatus.save()
    cove.save()
  }

  allCoveStatus.save()
  dailyAllCoveStatus.save()
  hourlyAllCoveStatus.save()
  swap.save()
  txSource.save()
}
export function handleCoveWithdrawn(event: CoveWithdrawn): void {
  let cove = loadCove(event.params.tokenAddress, event.params.withdrawer, event.block.timestamp, event.transaction.hash)
  let coveAsset = loadToken(event.params.tokenAddress)
  let userCoveStake = loadUserCoveStake(cove.id, event.params.withdrawer)
  let allCoveStatus = loadAllCoveStatus()
  let dailyCoveStatus = loadHistoricCoveStatus(cove, event.block.timestamp, 'DAILY')
  let dailyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'DAILY')
  let hourlyAllCoveStatus = loadHistoricAllCoveStatus(event.block.timestamp, 'HOURLY')

  let coveAssetPrice = getCoveAssetPrice(event.params.tokenAddress, coveAsset.decimals.toI32())
  let assetBalance = coveAssetPrice.get('assetBalance') as BigDecimal
  let covePoolTokenBalance = coveAssetPrice.get('poolTokenBalance') as BigDecimal
  let coveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
  let inputPrice = coveAssetPrice.get('assetPrice') as BigDecimal
  let assetBalanceUsd = assetBalance.times(inputPrice)

  cove.withdrawalCount = cove.withdrawalCount.plus(BIG_INT_ONE)
  cove.poolTokenAmount = covePoolTokenBalance
  cove.longtailTokenAmount = assetBalance
  cove.tvlUSD = coveLiquidity
  coveAsset.tvl = assetBalance
  coveAsset.tvlUSD = assetBalanceUsd

  let newDepositTokens = userCoveStake.depositTokens.minus(event.params.poolTokens)
  userCoveStake.depositTokens = newDepositTokens
  if (newDepositTokens.le(BIG_INT_ZERO)) {
    userCoveStake.active = false
  }

  let internalPoolTokensBeforeWithdrawal = event.params.poolTokensAfterWithdrawal.isZero()
    ? event.params.poolTokens
    : event.params.poolTokensAfterWithdrawal
  let withdrawnFraction = event.params.poolTokens.toBigDecimal().div(internalPoolTokensBeforeWithdrawal.toBigDecimal())
  // multiply by two because the cove liquidity should be twice as the amount of pool tokens
  let estimatedUsdWithdrawalValue = coveLiquidity.times(withdrawnFraction)

  let newWithdrawal = new CoveWithdrawal(event.transaction.hash.toHexString())
  newWithdrawal.timestamp = event.block.timestamp
  newWithdrawal.cove = cove.id
  newWithdrawal.amountUsd = estimatedUsdWithdrawalValue
  newWithdrawal.withdrawer = event.params.withdrawer

  allCoveStatus.withdrawalCount = allCoveStatus.withdrawalCount + 1
  dailyAllCoveStatus.withdrawalCount = dailyAllCoveStatus.withdrawalCount + 1
  hourlyAllCoveStatus.withdrawalCount = hourlyAllCoveStatus.withdrawalCount + 1

  dailyCoveStatus.withdrawalCount = dailyCoveStatus.withdrawalCount + 1
  dailyCoveStatus.price = inputPrice

  dailyCoveStatus.save()
  newWithdrawal.save()
  allCoveStatus.save()
  dailyAllCoveStatus.save()
  hourlyAllCoveStatus.save()
  cove.save()
  userCoveStake.save()
  coveAsset.save()
}

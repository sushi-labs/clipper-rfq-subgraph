import { Address, BigDecimal, Bytes, dataSource } from '@graphprotocol/graph-ts'
import { CoveDeposited, CoveSwapped, CoveWithdrawn } from '../types/templates/ClipperCove/ClipperCove'
import { Cove, CoveDeposit, CoveEvent, CoveWithdrawal, Swap } from '../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, COVE_PRICE_SOURCE, DEPOSIT_EVENT, SNAPSHOT_PRICE_SOURCE, SWAP_EVENT, WITHDRAWAL_EVENT } from './constants'
import {
  loadCoveParent,
  loadCove,
  loadUserCoveStake,
} from './entities/Cove'
import { upsertUser } from './entities/User'
import { convertTokenToDecimal, loadCoveTransactionSource, loadToken, loadTransactionSource } from './utils'
import { getTokenUsdPrice } from './utils/prices'
import { eth_getCoveAssetPrice } from './utils/cove'
import { PoolHelpers } from './utils/pool'

export function handleCoveDeposited(event: CoveDeposited): void {
  let context = dataSource.context()
  let poolContractAbiName = context.getString('poolContractAbiName')
  let cove = loadCove(poolContractAbiName, event.address, event.params.tokenAddress, event.params.depositor, event.block, event.transaction.hash)
  let coveAsset = loadToken(event.params.tokenAddress, event.block)
  let userCoveStake = loadUserCoveStake(cove.id, event.params.depositor)
  let coveParent = loadCoveParent(poolContractAbiName, event.address, event.block)

  // internal deposit token for cove info
  let internalDepositTokens = event.params.poolTokens
  let internalTotalDepositTokens = event.params.poolTokensAfterDeposit

  // general info
  let coveInfo = eth_getCoveAssetPrice(poolContractAbiName, cove.pool, event.address, event.params.tokenAddress, coveAsset.decimals.toI32(), event.block)
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
  coveAsset.depositedUSD = coveAsset.depositedUSD.plus(estimatedUsdDepositValue)

  userCoveStake.active = true
  userCoveStake.depositTokens = userCoveStake.depositTokens.plus(internalDepositTokens)

  let newDeposit = new CoveDeposit(event.transaction.hash)
  newDeposit.timestamp = event.block.timestamp.toI32()
  newDeposit.cove = cove.id
  newDeposit.amountUsd = estimatedUsdDepositValue
  newDeposit.depositor = event.params.depositor

  coveParent.depositCount = coveParent.depositCount + 1

  let coveEvent = new CoveEvent(0)
  coveEvent.cove = cove.id
  coveEvent.coveParent = coveParent.id
  coveEvent.type = DEPOSIT_EVENT
  coveEvent.amountUSD = estimatedUsdDepositValue
  coveEvent.timestamp = event.block.timestamp.toI32()
  coveEvent.covePrice = covePrice

  coveEvent.save()
  coveParent.save()
  newDeposit.save()
  cove.save()
  userCoveStake.save()
  coveAsset.save()
}

export function handleCoveSwapped(event: CoveSwapped): void {
  let inAssetAddress = event.params.inAsset
  let outAssetAddress = event.params.outAsset
  let context = dataSource.context()
  let poolContractAbiName = context.getString('poolContractAbiName')
  let coveParent = loadCoveParent(poolContractAbiName, event.address, event.block)
  let inAsset = loadToken(inAssetAddress, event.block)
  let outAsset = loadToken(outAssetAddress, event.block)
  let poolAddress = Address.fromBytes(coveParent.pool)
  let poolHelpers = new PoolHelpers(poolAddress, poolContractAbiName, event.block)
  let pool = poolHelpers.loadPool()
  let allTokensBalance = poolHelpers.eth_getPoolAllTokensBalance()
  let poolShorttailAssets = pool.tokens.load()
  let shorttailAssetMap = new Set<Bytes>()
  // Add pool token to shorttailAssetMap
  shorttailAssetMap.add(poolAddress)
  for (let i = 0; i < poolShorttailAssets.length; i++) {
    shorttailAssetMap.add(poolShorttailAssets[i].token)
  }

  let inAmount = convertTokenToDecimal(event.params.inAmount, inAsset.decimals)
  let outAmount = convertTokenToDecimal(event.params.outAmount, outAsset.decimals)

  let inputPrice: BigDecimal = BIG_DECIMAL_ZERO
  let outputPrice: BigDecimal = BIG_DECIMAL_ZERO
  let inTokenBalance: BigDecimal = BIG_DECIMAL_ZERO
  let outTokenBalance: BigDecimal = BIG_DECIMAL_ZERO
  let inCovePoolTokenAmount: BigDecimal = BIG_DECIMAL_ZERO
  let outCovePoolTokenAmount: BigDecimal = BIG_DECIMAL_ZERO
  let inCoveLiquidity: BigDecimal = BIG_DECIMAL_ZERO
  let outCoveLiquidity: BigDecimal = BIG_DECIMAL_ZERO

  let inAssetCove: Cove | null = null
  let outAssetCove: Cove | null = null

  // There should only be one cove per swap, either in or out, but handling scenario where both are longtail for now
  if (!shorttailAssetMap.has(inAsset.id)) {
    inAssetCove = loadCove(poolContractAbiName, event.address, inAssetAddress, event.params.recipient, event.block, event.transaction.hash)
    let coveAssetPrice = eth_getCoveAssetPrice(poolContractAbiName, inAssetCove.pool, event.address, inAssetAddress, inAsset.decimals.toI32(), event.block)
    inputPrice = coveAssetPrice.get('assetPrice') as BigDecimal
    inTokenBalance = coveAssetPrice.get('assetBalance') as BigDecimal
    inCovePoolTokenAmount = coveAssetPrice.get('poolTokenBalance') as BigDecimal
    inCoveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
    // If the price source is not oracle, we want to update the token price to the cove price
    if (inAsset.priceSource === null || inAsset.priceSource === COVE_PRICE_SOURCE || inAsset.priceSource === SNAPSHOT_PRICE_SOURCE) {
      inAsset.priceUSD = inputPrice
      inAsset.priceSource = COVE_PRICE_SOURCE
      inAsset.priceUpdatedAt = event.block.timestamp.toI32()
      inAsset.save()
    }
  }

  if (!shorttailAssetMap.has(outAsset.id)) {
    outAssetCove = loadCove(poolContractAbiName, event.address, outAssetAddress, event.params.recipient, event.block, event.transaction.hash)
    let coveAssetPrice = eth_getCoveAssetPrice(poolContractAbiName, outAssetCove.pool, event.address, outAssetAddress, outAsset.decimals.toI32(), event.block)
    outputPrice = coveAssetPrice.get('assetPrice') as BigDecimal
    outTokenBalance = coveAssetPrice.get('assetBalance') as BigDecimal
    outCovePoolTokenAmount = coveAssetPrice.get('poolTokenBalance') as BigDecimal
    outCoveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
    // If the price source is not oracle, we want to update the token price to the cove price
    if (outAsset.priceSource === null || outAsset.priceSource === COVE_PRICE_SOURCE || outAsset.priceSource === SNAPSHOT_PRICE_SOURCE) {
      outAsset.priceUSD = outputPrice
      outAsset.priceSource = COVE_PRICE_SOURCE
      outAsset.priceUpdatedAt = event.block.timestamp.toI32()
      outAsset.save()
    }
  }

  for (let i = 0; i < allTokensBalance.value1.length; i++) {
    let tokenAddress = allTokensBalance.value1[i]
    if (tokenAddress.equals(inAsset.id) && !inAssetCove) {
      let tokenPrice = getTokenUsdPrice(inAsset, event.block)
      if (tokenPrice !== null) {
        inputPrice = tokenPrice.priceUSD
      } else {
        inputPrice = BIG_DECIMAL_ZERO
      }
      inTokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], inAsset.decimals)
    } else if (tokenAddress.equals(outAsset.id) && !outAssetCove) {
      let tokenPrice = getTokenUsdPrice(outAsset, event.block)
      if (tokenPrice !== null) {
        outputPrice = tokenPrice.priceUSD
      } else {
        outputPrice = BIG_DECIMAL_ZERO
      }
      outTokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], outAsset.decimals)
    }
  }

  let amountInUsd = inputPrice.times(inAmount)
  let amountOutUsd = outputPrice.times(outAmount)
  let transactionVolume = amountInUsd.plus(amountOutUsd).div(BigDecimal.fromString('2'))

  inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
  outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)

  let swap = new Swap(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  swap.transaction = event.transaction.hash
  swap.timestamp = event.block.timestamp.toI32()
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
  // No revenue for cove swaps
  swap.revenueUSD = BIG_DECIMAL_ZERO

  outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)
  outAsset.volume = outAsset.volume.plus(outAmount)
  outAsset.volumeUSD = outAsset.volumeUSD.plus(amountOutUsd)
  outAsset.save()

  inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
  inAsset.volume = inAsset.volume.plus(inAmount)
  inAsset.volumeUSD = inAsset.volumeUSD.plus(amountInUsd)
  inAsset.save()

  let txSource = loadTransactionSource(event.params.auxiliaryData)
  swap.transactionSource = txSource.id
  txSource.txCount = txSource.txCount.plus(BIG_INT_ONE)
  txSource.volumeUSD = txSource.volumeUSD.plus(transactionVolume)

  coveParent.txCount = coveParent.txCount + 1
  coveParent.volumeUSD = coveParent.volumeUSD.plus(transactionVolume)

  let isUnique = upsertUser(event.transaction.from, event.block.timestamp, transactionVolume)
  if (isUnique) {
    pool.uniqueUsers = pool.uniqueUsers.plus(BIG_INT_ONE)
    pool.save()
  }

  swap.sender = event.transaction.from

  if (inAssetCove) {
    let addedVolume = outAssetCove ? amountInUsd : transactionVolume
    inAssetCove.swapCount = inAssetCove.swapCount.plus(BIG_INT_ONE)
    inAssetCove.poolTokenAmount = inCovePoolTokenAmount
    inAssetCove.longtailTokenAmount = inTokenBalance
    inAssetCove.volumeUSD = inAssetCove.volumeUSD.plus(addedVolume)
    if (inCoveLiquidity) {
      inAssetCove.tvlUSD = inCoveLiquidity
    }

    let coveTxSource = loadCoveTransactionSource(inAssetCove.id, txSource.id)
    coveTxSource.txCount = coveTxSource.txCount.plus(BIG_INT_ONE)
    coveTxSource.volumeUSD = coveTxSource.volumeUSD.plus(addedVolume)

    swap.cove = inAssetCove.id

    let coveEvent = new CoveEvent(0)
    coveEvent.cove = inAssetCove.id
    coveEvent.coveParent = coveParent.id
    coveEvent.type = SWAP_EVENT
    coveEvent.swapVolumeUSD = addedVolume
    coveEvent.timestamp = event.block.timestamp.toI32()
    coveEvent.covePrice = outputPrice

    coveEvent.save()
    inAssetCove.save()
    coveTxSource.save()
  }

  if (outAssetCove) {
    let addedVolume = inAssetCove ? amountOutUsd : transactionVolume
    outAssetCove.swapCount = outAssetCove.swapCount.plus(BIG_INT_ONE)
    outAssetCove.poolTokenAmount = outCovePoolTokenAmount
    outAssetCove.longtailTokenAmount = outTokenBalance
    outAssetCove.volumeUSD = outAssetCove.volumeUSD.plus(addedVolume)
    if (outCoveLiquidity) {
      outAssetCove.tvlUSD = outCoveLiquidity
    }

    let coveTxSource = loadCoveTransactionSource(outAssetCove.id, txSource.id)
    coveTxSource.txCount = coveTxSource.txCount.plus(BIG_INT_ONE)
    coveTxSource.volumeUSD = coveTxSource.volumeUSD.plus(addedVolume)

    swap.cove = outAssetCove.id

    let coveEvent = new CoveEvent(0)
    coveEvent.cove = outAssetCove.id
    coveEvent.coveParent = coveParent.id
    coveEvent.type = SWAP_EVENT
    coveEvent.swapVolumeUSD = addedVolume
    coveEvent.timestamp = event.block.timestamp.toI32()
    coveEvent.covePrice = outputPrice

    coveEvent.save()
    outAssetCove.save()
    coveTxSource.save()
  }

  
  coveParent.save()
  swap.save()
  txSource.save()
}

export function handleCoveWithdrawn(event: CoveWithdrawn): void {
  let context = dataSource.context()
  let poolContractAbiName = context.getString('poolContractAbiName')
  let cove = loadCove(poolContractAbiName, event.address, event.params.tokenAddress, event.params.withdrawer, event.block, event.transaction.hash)
  let coveAsset = loadToken(event.params.tokenAddress, event.block)
  let userCoveStake = loadUserCoveStake(cove.id, event.params.withdrawer)
  let coveParent = loadCoveParent(poolContractAbiName, event.address, event.block)

  let coveAssetPrice = eth_getCoveAssetPrice(poolContractAbiName, cove.pool, event.address, event.params.tokenAddress, coveAsset.decimals.toI32(), event.block)
  let assetBalance = coveAssetPrice.get('assetBalance') as BigDecimal
  let covePoolTokenBalance = coveAssetPrice.get('poolTokenBalance') as BigDecimal
  let coveLiquidity = coveAssetPrice.get('coveLiquidity') as BigDecimal
  let inputPrice = coveAssetPrice.get('assetPrice') as BigDecimal

  cove.withdrawalCount = cove.withdrawalCount.plus(BIG_INT_ONE)
  cove.poolTokenAmount = covePoolTokenBalance
  cove.longtailTokenAmount = assetBalance
  cove.tvlUSD = coveLiquidity

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

  let newWithdrawal = new CoveWithdrawal(event.transaction.hash)
  newWithdrawal.timestamp = event.block.timestamp.toI32()
  newWithdrawal.cove = cove.id
  newWithdrawal.amountUsd = estimatedUsdWithdrawalValue
  newWithdrawal.withdrawer = event.params.withdrawer

  coveParent.withdrawalCount = coveParent.withdrawalCount + 1

  let coveEvent = new CoveEvent(0)
  coveEvent.cove = cove.id
  coveEvent.coveParent = coveParent.id
  coveEvent.type = WITHDRAWAL_EVENT
  coveEvent.amountUSD = estimatedUsdWithdrawalValue
  coveEvent.timestamp = event.block.timestamp.toI32()
  coveEvent.covePrice = inputPrice

  coveEvent.save()
  newWithdrawal.save()
  coveParent.save()
  cove.save()
  userCoveStake.save()
  coveAsset.save()
}

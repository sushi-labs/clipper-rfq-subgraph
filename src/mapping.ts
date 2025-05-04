import { Address, BigDecimal, BigInt, Bytes, dataSource, ethereum } from '@graphprotocol/graph-ts'
import {
  AssetWithdrawn,
  Deposited,
  Swapped,
  Transfer,
  Withdrawn,
} from '../types/templates/ClipperCommonExchangeV0/ClipperPool'
import { Deposit, PoolEvent, Swap, Withdrawal } from '../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, DEPOSIT_EVENT, SWAP_EVENT, WITHDRAWAL_EVENT } from './constants'
import { updatePair, updatePoolPair } from './entities/Pair'
import { upsertUser } from './entities/User'
import {
  convertTokenToDecimal,
  loadPoolToken,
  loadPoolTransactionSource,
  loadToken,
  loadTransactionSource,
} from './utils'
import { getTokenUsdPrice } from './utils/prices'
import { eth_fetchBigIntTokenBalance } from './utils/token'
import { ClipperFeeSplitAddressesByDirectExchange, FarmingHelpersByPool, PermitRoutersByPool } from './addresses'
import { PoolHelpers } from './utils/pool'

export function handleDeposited(event: Deposited): void {
  let timestamp = event.block.timestamp
  let context = dataSource.context()
  let poolContractAbiName = context.getString('contractAbiName')
  let poolHelpers = new PoolHelpers(event.address, poolContractAbiName, event.block)
  let pool = poolHelpers.loadPool()
  let allTokensBalance = poolHelpers.eth_getPoolAllTokensBalance()
  let currentPoolLiquidity = poolHelpers.updatePoolTokensLiquidity(allTokensBalance)
  let poolTokenSupply = allTokensBalance.value2
  let receivedPoolTokens = convertTokenToDecimal(event.params.poolTokens, BigInt.fromI32(18))
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BigInt.fromI32(18))

  let poolOwnedAmount = receivedPoolTokens.div(totalPoolTokens)
  let usdProportion = currentPoolLiquidity.times(poolOwnedAmount)

  let newDeposit = new Deposit(event.transaction.hash)
  newDeposit.timestamp = timestamp.toI32()
  newDeposit.pool = event.address
  newDeposit.poolTokens = receivedPoolTokens
  newDeposit.amountUsd = usdProportion

  let farmingHelper = FarmingHelpersByPool.get(event.address.toHexString().toLowerCase())
  if (farmingHelper) {
    newDeposit.depositor = farmingHelper
  } else {
    newDeposit.depositor = event.params.depositor
  }

  pool.poolTokensSupply = poolTokenSupply
  pool.depositCount = pool.depositCount.plus(BIG_INT_ONE)
  pool.depositedUSD = pool.depositedUSD.plus(usdProportion)
  pool.poolValueUSD = currentPoolLiquidity

  let poolEvent = new PoolEvent(0)
  poolEvent.timestamp = timestamp.toI32();
  poolEvent.pool = pool.id
  poolEvent.type = DEPOSIT_EVENT
  poolEvent.amountUSD = usdProportion
  poolEvent.poolValueUSD = currentPoolLiquidity
  poolEvent.poolTokensSupply = poolTokenSupply

  poolEvent.save()
  newDeposit.save()
  pool.save()
}

function handleWithdrawnEvent(event: ethereum.Event, poolTokensWithdrawn: BigInt, withdrawer: Bytes): void {
  let context = dataSource.context()
  let poolContractAbiName = context.getString('contractAbiName')
  let poolHelpers = new PoolHelpers(event.address, poolContractAbiName, event.block)
  let pool = poolHelpers.loadPool()
  let allTokensBalance = poolHelpers.eth_getPoolAllTokensBalance()
  let currentPoolLiquidity = poolHelpers.updatePoolTokensLiquidity(allTokensBalance)
  let poolTokenSupply = pool.poolTokensSupply.minus(poolTokensWithdrawn)
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BigInt.fromI32(18))
  let burntPoolTokens = convertTokenToDecimal(poolTokensWithdrawn, BigInt.fromI32(18))

  let burntProportion = burntPoolTokens.div(totalPoolTokens.plus(burntPoolTokens))
  let usdProportion = currentPoolLiquidity.times(burntProportion)

  let newWithdrawal = new Withdrawal(event.transaction.hash)
  newWithdrawal.timestamp = event.block.timestamp.toI32()
  newWithdrawal.amountUsd = usdProportion
  newWithdrawal.poolTokens = burntPoolTokens
  newWithdrawal.pool = event.address
  newWithdrawal.withdrawer = withdrawer

  let poolEvent = new PoolEvent(0)
  poolEvent.timestamp = event.block.timestamp.toI32();
  poolEvent.pool = pool.id
  poolEvent.type = WITHDRAWAL_EVENT
  poolEvent.amountUSD = usdProportion
  poolEvent.poolValueUSD = currentPoolLiquidity
  poolEvent.poolTokensSupply = poolTokenSupply

  pool.poolTokensSupply = poolTokenSupply
  pool.withdrawalCount = pool.withdrawalCount.plus(BIG_INT_ONE)
  pool.withdrewUSD = pool.withdrewUSD.plus(usdProportion)
  pool.poolValueUSD = currentPoolLiquidity

  poolEvent.save()
  newWithdrawal.save()
  pool.save()
}

export function handleWithdrawn(event: Withdrawn): void {
  handleWithdrawnEvent(event, event.params.poolTokens, event.params.withdrawer)
}

export function handleSingleAssetWithdrawn(event: AssetWithdrawn): void {
  handleWithdrawnEvent(event, event.params.poolTokens, event.params.withdrawer)
}

export function handleSwapped(event: Swapped): void {
  let poolAddress = event.address
  let context = dataSource.context()
  let poolContractAbiName = context.getString('contractAbiName')
  let poolHelpers = new PoolHelpers(event.address, poolContractAbiName, event.block)
  let pool = poolHelpers.loadPool()
  let poolTokensSupply = pool.poolTokensSupply

  let inAsset = loadToken(event.params.inAsset, event.block)
  let outAsset = loadToken(event.params.outAsset, event.block)
  let poolInAsset = loadPoolToken(poolAddress, inAsset)
  let poolOutAsset = loadPoolToken(poolAddress, outAsset)
  let amountIn = convertTokenToDecimal(event.params.inAmount, inAsset.decimals)
  let amountOut = convertTokenToDecimal(event.params.outAmount, outAsset.decimals)
  let inputPrice = getTokenUsdPrice(inAsset, event.block).priceUSD
  let outputPrice = getTokenUsdPrice(outAsset, event.block).priceUSD
  let amountInUsd = inputPrice.times(amountIn)
  let amountOutUsd = outputPrice.times(amountOut)
  let transactionVolume = amountInUsd.plus(amountOutUsd).div(BigDecimal.fromString('2'))

  let swap = new Swap(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  swap.transaction = event.transaction.hash
  swap.timestamp = event.block.timestamp.toI32()
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
  swap.pool = poolAddress
  swap.swapType = 'POOL'

  let feeUSD = amountInUsd.minus(amountOutUsd).lt(BIG_DECIMAL_ZERO) ? BIG_DECIMAL_ZERO : amountInUsd.minus(amountOutUsd)
  swap.feeUSD = feeUSD

  let allTokensBalance = poolHelpers.eth_getPoolAllTokensBalance()
  let inTokenBalance: BigDecimal = BIG_DECIMAL_ZERO
  let outTokenBalance: BigDecimal = BIG_DECIMAL_ZERO
  for (let i = 0; i < allTokensBalance.value1.length; i++) {
    let tokenAddress = allTokensBalance.value1[i]
    if (tokenAddress.equals(inAsset.id)) {
      inTokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], inAsset.decimals)
    } else if (tokenAddress.equals(outAsset.id)) {
      outTokenBalance = convertTokenToDecimal(allTokensBalance.value0[i], outAsset.decimals)
    }
  }
  // update assets values
  let inTokenBalanceUsd = inputPrice.times(inTokenBalance)
  let outTokenBalanceUsd = outputPrice.times(outTokenBalance)
  // if both assets are the same, update just one with the subtraction of both amounts
  if (inAsset.id === outAsset.id) {
    inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
    inAsset.volume = inAsset.volume.plus(amountIn.plus(amountOut).div(BigDecimal.fromString('2')))
    inAsset.volumeUSD = inAsset.volumeUSD.plus(transactionVolume)
    poolInAsset.tvl = inTokenBalance
    poolInAsset.tvlUSD = inTokenBalanceUsd
    inAsset.save()
    poolInAsset.save()
  } else {
    outAsset.txCount = outAsset.txCount.plus(BIG_INT_ONE)
    outAsset.volume = outAsset.volume.plus(amountOut)
    outAsset.volumeUSD = outAsset.volumeUSD.plus(amountOutUsd)
    poolOutAsset.tvl = outTokenBalance
    poolOutAsset.tvlUSD = outTokenBalanceUsd
    outAsset.save()
    poolOutAsset.save()

    inAsset.txCount = inAsset.txCount.plus(BIG_INT_ONE)
    inAsset.volume = inAsset.volume.plus(amountIn)
    inAsset.volumeUSD = inAsset.volumeUSD.plus(amountInUsd)
    poolInAsset.tvl = inTokenBalance
    poolInAsset.tvlUSD = inTokenBalanceUsd
    inAsset.save()
    poolInAsset.save()
  }

  let txSource = loadTransactionSource(event.params.auxiliaryData)
  let poolTxSource = loadPoolTransactionSource(poolAddress, txSource.id)
  swap.transactionSource = txSource.id
  txSource.txCount = txSource.txCount.plus(BIG_INT_ONE)
  txSource.volumeUSD = txSource.volumeUSD.plus(transactionVolume)
  poolTxSource.txCount = poolTxSource.txCount.plus(BIG_INT_ONE)
  poolTxSource.volumeUSD = poolTxSource.volumeUSD.plus(transactionVolume)

  let workingPair = updatePair(
    event.params.inAsset,
    event.params.outAsset,
    transactionVolume,
  )
  updatePoolPair(poolAddress, workingPair.id, transactionVolume)
  swap.pair = workingPair.id
  swap.sender = event.transaction.from
  
  let isUniqueUser = upsertUser(event.transaction.from, event.block.timestamp, transactionVolume)

  let feeSplitAddresses = ClipperFeeSplitAddressesByDirectExchange.get(poolAddress.toHexString().toLowerCase())
  let poolTokenOwnedByFeeSplit: BigInt = BIG_INT_ZERO
  if (feeSplitAddresses !== null && feeSplitAddresses.length > 0) {
    for (let i = 0; i < feeSplitAddresses.length; i++) {
      poolTokenOwnedByFeeSplit = poolTokenOwnedByFeeSplit.plus(
        eth_fetchBigIntTokenBalance(poolAddress, Address.fromString(feeSplitAddresses[i])),
      )
    }
  }

  // the fraction owned by fee split contract
  let theFraction = poolTokenOwnedByFeeSplit.toBigDecimal().div(poolTokensSupply.toBigDecimal())
  let daoRevenueFraction = event.block.timestamp.ge(BigInt.fromI32(1690848000))
    ? BigDecimal.fromString('1')
    : BigDecimal.fromString('0.5')
  let revenueUSD = feeUSD.times(theFraction).times(daoRevenueFraction)

  pool.txCount = pool.txCount.plus(BIG_INT_ONE)
  pool.volumeUSD = pool.volumeUSD.plus(transactionVolume)
  pool.feeUSD = pool.feeUSD.plus(feeUSD)

  if (isUniqueUser) {
    pool.uniqueUsers = pool.uniqueUsers.plus(BIG_INT_ONE)
  }

  pool.revenueUSD = pool.revenueUSD.plus(revenueUSD)
  swap.revenueUSD = revenueUSD

  let currentPoolLiquidity = poolHelpers.updatePoolTokensLiquidity(allTokensBalance)
  pool.poolValueUSD = currentPoolLiquidity

  let poolEvent = new PoolEvent(0)
  poolEvent.timestamp = event.block.timestamp.toI32();
  poolEvent.pool = poolAddress
  poolEvent.type = SWAP_EVENT
  poolEvent.swapFeeUSD = feeUSD
  poolEvent.swapRevenueUSD = revenueUSD
  poolEvent.swapVolumeUSD = transactionVolume
  poolEvent.poolValueUSD = currentPoolLiquidity
  poolEvent.poolTokensSupply = poolTokensSupply

  pool.save()
  poolEvent.save()
  swap.save()
  txSource.save()
  poolTxSource.save()
}

export function handleTransfer(event: Transfer): void {
  let permitRouter = PermitRoutersByPool.get(event.address.toHexString().toLowerCase())

  if (permitRouter && event.params.from.equals(permitRouter)) {
    let deposit = Deposit.load(event.transaction.hash)
    if (!deposit) {
      return
    }

    deposit.depositor = event.params.to
    deposit.save()
  }
}

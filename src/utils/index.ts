import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { CoveTransactionSource, PoolToken, PoolTransactionSource, Token, TransactionSource } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../constants'
import { eth_fetchTokenDecimals, eth_fetchTokenName, eth_fetchTokenSymbol } from './token'

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = BIG_INT_ZERO; i.lt(decimals as BigInt); i = i.plus(BIG_INT_ONE)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == BIG_INT_ZERO) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function loadTransactionSource(auxData: Bytes): TransactionSource {
  let txSourceId = auxData.toString() || 'Unknown'

  if (txSourceId.includes('Clipper')) {
    txSourceId = 'Clipper'
  }

  let txSource = TransactionSource.load(txSourceId)
  if (!txSource) {
    txSource = new TransactionSource(txSourceId)
    txSource.txCount = BIG_INT_ZERO
    txSource.volumeUSD = BIG_DECIMAL_ZERO

    txSource.save()
  }

  return txSource as TransactionSource
}

export function loadPoolTransactionSource(poolAddress: Bytes, txSourceId: string): PoolTransactionSource {
  let poolTxSourceId = poolAddress.toHex().concat('-').concat(txSourceId)
  let poolTxSource = PoolTransactionSource.load(poolTxSourceId)
  if (!poolTxSource) {
    poolTxSource = new PoolTransactionSource(poolTxSourceId)
    poolTxSource.pool = poolAddress
    poolTxSource.transactionSource = txSourceId
    poolTxSource.txCount = BIG_INT_ZERO
    poolTxSource.volumeUSD = BIG_DECIMAL_ZERO
    poolTxSource.save()
  }
  return poolTxSource
}

export function loadCoveTransactionSource(coveAddress: Bytes, txSourceId: string): CoveTransactionSource {
  let coveTxSourceId = coveAddress.toHex().concat('-').concat(txSourceId)
  let coveTxSource = CoveTransactionSource.load(coveTxSourceId)
  if (!coveTxSource) {
    coveTxSource = new CoveTransactionSource(coveTxSourceId)
    coveTxSource.cove = coveAddress
    coveTxSource.transactionSource = txSourceId
    coveTxSource.txCount = BIG_INT_ZERO
    coveTxSource.volumeUSD = BIG_DECIMAL_ZERO
    coveTxSource.save()
  }
  return coveTxSource
}

export function loadToken(tokenAddressBytes: Bytes): Token {
  let tokenAddress = Address.fromBytes(tokenAddressBytes)
  let token = Token.load(tokenAddress)

  if (!token) {
    token = new Token(tokenAddress)
    let symbol = eth_fetchTokenSymbol(tokenAddress)
    token.symbol = symbol
    token.name = eth_fetchTokenName(tokenAddress)
    token.decimals = eth_fetchTokenDecimals(tokenAddress)
    token.txCount = BIG_INT_ZERO
    token.volume = BIG_DECIMAL_ZERO
    token.volumeUSD = BIG_DECIMAL_ZERO
    token.deposited = BIG_DECIMAL_ZERO
    token.depositedUSD = BIG_DECIMAL_ZERO
    token.save()
  }

  return token
}

function getPoolTokenId(poolAddress: Bytes, token: Token): Bytes {
  return poolAddress.concat(token.id)
}

export function loadOrCreatePoolToken(poolAddress: Bytes, token: Token, block: ethereum.Block): PoolToken {
  let id = getPoolTokenId(poolAddress, token)
  let poolToken = PoolToken.load(id)
  if (!poolToken) {
    poolToken = new PoolToken(id)
    poolToken.pool = poolAddress
    poolToken.token = token.id
    poolToken.tvl = BIG_DECIMAL_ZERO
    poolToken.tvlUSD = BIG_DECIMAL_ZERO
    poolToken.createdAt = block.timestamp.toI32()
    poolToken.save()
  }
  return poolToken
}

export function loadPoolToken(poolAddress: Bytes, token: Token): PoolToken {
  let id = getPoolTokenId(poolAddress, token)
  let poolToken = PoolToken.load(id)
  if (!poolToken) {
    throw new Error('Token is not part of the pool')
  }
  return poolToken
}

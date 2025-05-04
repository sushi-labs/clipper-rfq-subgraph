import { BigDecimal, Bytes } from '@graphprotocol/graph-ts'
import { Pair, PoolPair } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../constants'

export function loadPair(inAsset: Bytes, outAsset: Bytes): Pair {
  let pairId = inAsset.concat(outAsset)
  let altPairId = outAsset.concat(inAsset)

  let pair = Pair.load(pairId)

  // load alternative pair id in case first is not found
  if (!pair) {
    pair = Pair.load(altPairId)
  }

  if (!pair) {
    pair = new Pair(pairId)
    pair.asset0 = inAsset
    pair.asset1 = outAsset
    pair.txCount = BIG_INT_ZERO
    pair.volumeUSD = BIG_DECIMAL_ZERO
    pair.save()
  }

  return pair as Pair
}

export function updatePair(inAsset: Bytes, outAsset: Bytes, addedTxVolume: BigDecimal): Pair {
  let pair = loadPair(inAsset, outAsset)
  pair.txCount = pair.txCount.plus(BIG_INT_ONE)
  pair.volumeUSD = pair.volumeUSD.plus(addedTxVolume)

  pair.save()

  return pair
}

export function loadPoolPair(poolAddress: Bytes, pairId: Bytes): PoolPair {
  let poolPairId = poolAddress.concat(pairId)

  let poolPair = PoolPair.load(poolPairId)

  if (!poolPair) {
    poolPair = new PoolPair(poolPairId)
    poolPair.pool = poolAddress
    poolPair.pair = pairId
    poolPair.txCount = BIG_INT_ZERO
    poolPair.volumeUSD = BIG_DECIMAL_ZERO
    poolPair.save()
  }

  return poolPair
}

export function updatePoolPair(poolAddress: Bytes, pairId: Bytes, addedTxVolume: BigDecimal): PoolPair {
  let poolPair = loadPoolPair(poolAddress, pairId)
  poolPair.txCount = poolPair.txCount.plus(BIG_INT_ONE)
  poolPair.volumeUSD = poolPair.volumeUSD.plus(addedTxVolume)
  poolPair.save()

  return poolPair
}

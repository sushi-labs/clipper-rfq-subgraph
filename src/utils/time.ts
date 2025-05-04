import { BigInt } from '@graphprotocol/graph-ts'

export function getOpenTime(timestamp: BigInt, interval: BigInt): BigInt {
  let excess = timestamp.mod(interval)
  return timestamp.minus(excess)
}

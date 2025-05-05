import { BigInt } from '@graphprotocol/graph-ts'

export function getOpenTime(timestamp: BigInt, interval: i32): BigInt {
  let excess = timestamp.mod(BigInt.fromI32(interval))
  return timestamp.minus(excess)
}

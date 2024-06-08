import { BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { User } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../constants'

export function upsertUser(userWallet: string, txTimestamp: BigInt, txVolume: BigDecimal): boolean {
  let user = User.load(userWallet)
  let isNewUser = false

  if (!user) {
    user = new User(userWallet)
    user.firstTxTimestamp = txTimestamp
    user.volumeUSD = BIG_DECIMAL_ZERO
    user.txCount = BIG_INT_ZERO
    isNewUser = true
  }

  user.lastTxTimestamp = txTimestamp
  user.volumeUSD = user.volumeUSD.plus(txVolume)
  user.txCount = user.txCount.plus(BIG_INT_ONE)
  user.save()

  return isNewUser
}

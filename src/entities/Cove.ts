import { Bytes, BigInt, Address, ethereum } from '@graphprotocol/graph-ts'
import { Cove, CoveParent, UserCoveStake } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from '../constants'
import { loadToken } from '../utils'
import { loadPool } from './Pool'
import { getCovePoolAddress } from '../utils/cove'

export function loadCove(
  coveAddress: Address,
  tokenAddress: Address,
  creator: Bytes,
  block: ethereum.Block,
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
    let pool = loadPool(poolAddress, block)

    cove = new Cove(id)
    cove.pool = pool.id
    cove.longtailAsset = coveAsset.id
    cove.coveAssetName = coveAsset.name
    cove.coveAssetSymbol = coveAsset.symbol
    cove.createdAt = block.timestamp.toI32()
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

export function loadCoveParent(coveAddress: Address, block: ethereum.Block): CoveParent {
  let parent = CoveParent.load(coveAddress.toHexString())

  if (!parent) {
    parent = new CoveParent(coveAddress.toHexString())
    let poolAddress = getCovePoolAddress(coveAddress)
    let pool = loadPool(poolAddress, block)
    parent.pool = pool.id
    parent.createdAt = block.timestamp.toI32()
    parent.txCount = 0
    parent.depositCount = 0
    parent.withdrawalCount = 0
    parent.volumeUSD = BIG_DECIMAL_ZERO

    parent.save()
  }

  return parent
}

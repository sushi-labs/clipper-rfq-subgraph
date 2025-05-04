import { Address, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Cove, CoveParent, UserCoveStake } from '../../types/schema'
import { BIG_DECIMAL_ZERO, BIG_INT_ZERO } from '../constants'
import { loadToken } from '../utils'
import { loadPool } from './Pool'
import { eth_getCovePoolAddress } from '../utils/cove'

export function loadCove(
  coveParentAddressBytes: Bytes,
  tokenAddress: Bytes,
  creator: Bytes,
  block: ethereum.Block,
  transaction: Bytes,
): Cove {
  let coveParentAddress = Address.fromBytes(coveParentAddressBytes)
  let id = coveParentAddress
    .concat(tokenAddress)
  let cove = Cove.load(id)

  if (!cove) {
    let coveAsset = loadToken(tokenAddress)
    let poolAddress = eth_getCovePoolAddress(coveParentAddress)
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

export function loadUserCoveStake(coveAddress: Bytes, userWallet: Bytes): UserCoveStake {
  let id = coveAddress.concat(userWallet)
  let stake = UserCoveStake.load(id)

  if (!stake) {
    stake = new UserCoveStake(id)
    stake.user = userWallet
    stake.cove = coveAddress
    stake.depositTokens = BIG_INT_ZERO
    stake.active = true

    stake.save()
  }

  return stake as UserCoveStake
}

export function loadCoveParent(coveParentAddressBytes: Bytes, block: ethereum.Block): CoveParent {
  let coveParentAddress = Address.fromBytes(coveParentAddressBytes)
  let parent = CoveParent.load(coveParentAddress)

  if (!parent) {
    parent = new CoveParent(coveParentAddress)
    let poolAddress = eth_getCovePoolAddress(coveParentAddress)
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

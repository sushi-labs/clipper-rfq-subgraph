import { dataSource, ethereum, Address } from '@graphprotocol/graph-ts'
import { PoolLpTransfer } from '../types/schema'
import { LpTransfer } from '../types/templates/LpTransfer/LpTransfer'

export function handleLpTransferStart(block: ethereum.Block): void {
  const contractAddress = dataSource.address()
  createLpTransferEntity(contractAddress, block)
}

export function createLpTransferEntity(
  contractAddress: Address,
  block: ethereum.Block
): void {
  const lpTransferContract = LpTransfer.bind(contractAddress)
 
  const lpTransfer = new PoolLpTransfer(contractAddress)
  lpTransfer.oldPool = lpTransferContract.OLD_EXCHANGE()
  lpTransfer.newPool = lpTransferContract.NEW_EXCHANGE()
  lpTransfer.createdAt = block.timestamp.toI32()
  lpTransfer.save()
}

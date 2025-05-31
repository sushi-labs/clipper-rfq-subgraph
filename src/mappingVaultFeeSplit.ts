import { dataSource, ethereum, Address } from '@graphprotocol/graph-ts'
import { FeeSplit } from '../types/templates/VaultFeeSplit/FeeSplit'
import { PoolVault } from '../types/schema'
import { FEE_SPLIT_VAULT_TYPE } from './constants'

export function handleFeeSplitStart(block: ethereum.Block): void {
  const contractAddress = dataSource.address()
  const context = dataSource.context()
  const nameValue = context.get('name')
  
  const name = nameValue != null ? nameValue.toString() : null
  createFeeSplitVaultEntity(contractAddress, name, block)
}

export function createFeeSplitVaultEntity(
  contractAddress: Address,
  name: string | null,
  block: ethereum.Block
): void {
  const feeSplitContract = FeeSplit.bind(contractAddress)
  const poolAddress = feeSplitContract.CLIPPER_EXCHANGE()
  
  const vault = new PoolVault(contractAddress)
  vault.pool = poolAddress
  vault.createdAt = block.timestamp.toI32()
  vault.type = FEE_SPLIT_VAULT_TYPE
  vault.name = name
  vault.save()
}

import { Address, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import { ClipperProtocolDeposit } from '../types/templates/VaultProtocolDeposit/ClipperProtocolDeposit'
import { PoolProtocolDepositVault, PoolVault } from '../types/schema'
import { PROTOCOL_DEPOSIT_VAULT_TYPE } from './constants'

export function handleProtocolDepositStart(block: ethereum.Block): void {
  const context = dataSource.context()
  const nameValue = context.get('name')
  const transferHelperString = context.getString('transferHelper')
  const transferHelper = Address.fromString(transferHelperString)
  const contractAddress = dataSource.address()
  const protocolDepositContract = ClipperProtocolDeposit.bind(contractAddress)


  const vault = new PoolVault(contractAddress)
  vault.pool = protocolDepositContract.CLIPPER_EXCHANGE()
  vault.type = PROTOCOL_DEPOSIT_VAULT_TYPE
  vault.createdAt = block.timestamp.toI32()
  vault.name = nameValue != null ? nameValue.toString() : null
  vault.protocolDeposit = contractAddress
  vault.save()

  const protocolDeposit = new PoolProtocolDepositVault(contractAddress)
  protocolDeposit.vault = vault.id
  protocolDeposit.transferHelper = transferHelper
  protocolDeposit.save()
}

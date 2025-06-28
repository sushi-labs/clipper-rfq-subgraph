import { Address, dataSource, ethereum } from '@graphprotocol/graph-ts'
import { FARM_VAULT_TYPE } from './constants'
import { PoolFarmVault, PoolVault } from '../types/schema'
import { LinearVestingVault } from '../types/templates/VaultFarm/LinearVestingVault'
import { loadToken } from './utils'

export function handleFarmStart(block: ethereum.Block): void {
  const context = dataSource.context()
  const nameValue = context.get('name')
  const farmingHelperString = context.getString('farmingHelper')
  const abi = context.getString('abi')
  const farmingHelper = Address.fromString(farmingHelperString)
  const contractAddress = dataSource.address()

  const farmContract = LinearVestingVault.bind(contractAddress)

  const vault = new PoolVault(contractAddress)
  vault.pool = farmContract.STAKING_TOKEN()
  vault.type = FARM_VAULT_TYPE
  vault.createdAt = block.timestamp.toI32()
  vault.name = nameValue != null ? nameValue.toString() : null
  vault.farm = contractAddress
  vault.save()

  const rewardToken = loadToken(farmContract.REWARD_TOKEN(), block)
  const farmVault = new PoolFarmVault(contractAddress)
  farmVault.vault = vault.id
  farmVault.rewardToken = rewardToken.id
  farmVault.abi = abi
  farmVault.farmingHelper = farmingHelper
  farmVault.save()
}

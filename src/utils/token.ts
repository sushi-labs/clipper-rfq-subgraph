import { Address, BigDecimal, BigInt, Bytes, log } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal } from '.'
import { ERC20 } from '../../types/templates/ClipperCommonExchangeV0/ERC20'
import { Token } from '../../types/schema'
import { AddressZeroName, AddressZeroSymbol } from '../addresses'
import { ADDRESS_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../constants'

/**
 * Fetch the symbol of a token.
 * Only used when creating a token entity. Cached in Token entities.
 * @param tokenAddress - The address of the token
 * @returns The symbol of the token
 */
export function eth_fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)

  if (tokenAddress.equals(ADDRESS_ZERO)) {
    return AddressZeroSymbol
  }
  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()

  if (!symbolResult.reverted) {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

/**
 * Fetch the decimals of a token.
 * Only used when creating a token entity. Cached in Token entities.
 * @param tokenAddress - The address of the token
 * @returns The decimals of the token
 */
export function eth_fetchTokenDecimals(tokenAddress: Address): i32 {
  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = 18

  let decimalResult = contract.try_decimals()

  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }

  return decimalValue
}

/**
 * Fetch the name of a token.
 * Only used when creating a token entity. Cached in Token entities.
 * @param tokenAddress - The address of the token
 * @returns The name of the token
 */
export function eth_fetchTokenName(tokenAddress: Address): string {
  if (tokenAddress.equals(ADDRESS_ZERO)) {
    return AddressZeroName
  }

  let contract = ERC20.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()

  if (!nameResult.reverted) {
    nameValue = nameResult.value
  }

  return nameValue
}

/**
 * Fetch the balance of a token.
 * @param token - The token entity
 * @param wallet - The address of the wallet
 * @returns The balance of the token
 */
export function eth_fetchTokenBalance(token: Token, wallet: Address): BigDecimal {
  let tokenContract = ERC20.bind(Address.fromBytes(token.id))

  let tokenBigBalanceResult = tokenContract.try_balanceOf(wallet)

  let tokenBigBalance = BIG_INT_ONE
  if (!tokenBigBalanceResult.reverted) {
    tokenBigBalance = tokenBigBalanceResult.value
  } else {
    log.info('Error fetching balance of {}', [token.id.toHex()])
  }
  let tokenBalance = convertTokenToDecimal(tokenBigBalance, token.decimals)

  return tokenBalance
}

/**
 * Fetch the balance of a token.
 * @param assetAddress - The address of the token
 * @param owner - The address of the owner
 * @returns The balance of the token
 */
export function eth_fetchBigIntTokenBalance(assetAddress: Address, owner: Address): BigInt {
  let tokenContract = ERC20.bind(assetAddress)

  let tokenBigBalanceResult = tokenContract.try_balanceOf(owner)

  if (!tokenBigBalanceResult.reverted) {
    return tokenBigBalanceResult.value
  } else {
    return BIG_INT_ZERO
  }
}

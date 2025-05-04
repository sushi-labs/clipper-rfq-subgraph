import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export let BIG_DECIMAL_ZERO = BigDecimal.fromString('0')
export let BIG_DECIMAL_ONE = BigDecimal.fromString('1')
export let BIG_INT_ZERO = BigInt.fromI32(0)
export let BIG_INT_ONE = BigInt.fromI32(1)
export let BIG_INT_EIGHTEEN = BigInt.fromI32(18)
export let ONE_HOUR = BigInt.fromI32(3600)
export let ONE_DAY = BigInt.fromI32(86400)

export const SWAP_EVENT = 'SWAP'
export const DEPOSIT_EVENT = 'DEPOSIT'
export const WITHDRAWAL_EVENT = 'WITHDRAWAL'

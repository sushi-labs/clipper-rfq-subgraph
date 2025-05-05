import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export let BIG_DECIMAL_ZERO = BigDecimal.fromString('0')
export let BIG_DECIMAL_ONE = BigDecimal.fromString('1')
export let BIG_INT_ZERO = BigInt.fromI32(0)
export let BIG_INT_ONE = BigInt.fromI32(1)
export let BIG_INT_EIGHTEEN = BigInt.fromI32(18)
export let ONE_DAY: i32 = 86400

export const DEPOSIT_EVENT: i8 = 0
export const WITHDRAWAL_EVENT: i8 = 1
export const SWAP_EVENT: i8 = 2
export const ORACLE_UPDATE_EVENT: i8 = 3

export const ORACLE_PRICE_SOURCE: string = 'ORACLE'
export const SNAPSHOT_PRICE_SOURCE: string = 'SNAPSHOT'
export const COVE_PRICE_SOURCE: string = 'COVE'

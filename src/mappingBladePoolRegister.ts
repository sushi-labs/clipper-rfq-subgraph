import { DataSourceContext, log } from '@graphprotocol/graph-ts'
import {
  BladeLPTransferCreated,
  BladePermitRouterCreated,
  BladeVerifiedExchangeCreated,
} from '../types/templates/BladePoolRegisterV0/BladePoolRegisterV0'
import { BladeApproximateExchangeCreated } from '../types/templates/BladePoolRegisterV1/BladePoolRegisterV1'
import { Pool, PoolLpTransfer } from '../types/schema'
import { BladeCommonExchangeV0, PriceOracleProxy } from '../types/templates'


export function handleBladeLPTransferCreated(event: BladeLPTransferCreated): void {
  let lpTransfer = new PoolLpTransfer(event.params.lpTransferAddress)
  lpTransfer.oldPool = event.params.oldExchange
  lpTransfer.newPool = event.params.newExchange
  lpTransfer.createdAt = event.block.timestamp.toI32()
  lpTransfer.save()

  log.info('Created PoolLpTransfer entity with id={}', [event.params.lpTransferAddress.toHexString()])
}

export function handleBladePermitRouterCreated(event: BladePermitRouterCreated): void {
  let pool = Pool.load(event.params.exchangeAddress)
  if (pool) {
    pool.permitRouter = event.params.permitRouterAddress
    pool.save()
  }
}

export function handleBladeVerifiedExchangeCreated(event: BladeVerifiedExchangeCreated): void {
  let context = new DataSourceContext()
  context.setString('contractAbiName', 'BladeVerifiedExchange')
  BladeCommonExchangeV0.createWithContext(event.params.exchangeAddress, context)

  for (let i = 0; i < event.params.oracles.length; i++) {
    let oracleAddress = event.params.oracles[i]
    let tokenAddress = event.params.tokens[i]
    let context = new DataSourceContext()
    context.setString('proxyAddress', oracleAddress.toHexString())
    context.setString('tokenAddress', tokenAddress.toHexString())
    PriceOracleProxy.createWithContext(oracleAddress, context)
  }
}

export function handleBladeApproximateExchangeCreated(event: BladeApproximateExchangeCreated): void {
  let context = new DataSourceContext()
  context.setString('contractAbiName', 'BladeApproximateExchange')
  BladeCommonExchangeV0.createWithContext(event.params.exchangeAddress, context)

  for (let i = 0; i < event.params.oracles.length; i++) {
    let oracleAddress = event.params.oracles[i]
    let tokenAddress = event.params.tokens[i]
    let context = new DataSourceContext()
    context.setString('proxyAddress', oracleAddress.toHexString())
    context.setString('tokenAddress', tokenAddress.toHexString())
    PriceOracleProxy.createWithContext(oracleAddress, context)
  }
} 
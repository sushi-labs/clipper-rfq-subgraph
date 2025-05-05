import { Address, ethereum, log } from '@graphprotocol/graph-ts'
import { PriceAggregatorProxy } from '../../types/schema'
import { AggregatorV3Interface } from '../../types/templates/PriceOracle/AggregatorV3Interface'

export function loadPriceAggregatorProxy(proxyAddress: Address, block: ethereum.Block): PriceAggregatorProxy {
  let proxy = PriceAggregatorProxy.load(proxyAddress)
  if (!proxy) {
    proxy = new PriceAggregatorProxy(proxyAddress)
    let proxyContract = AggregatorV3Interface.bind(proxyAddress)
    let aggregatorAddress = proxyContract.aggregator()
    proxy.aggregatorLastCheckedAt = block.timestamp.toI32()
    proxy.aggregatorConfirmedAt = block.timestamp.toI32()
    proxy.aggregator = aggregatorAddress
    proxy.save()
    log.debug('Created PriceAggregatorProxy: {} at block {}', [proxyAddress.toHexString(), block.number.toString()])
  }

  return proxy
}

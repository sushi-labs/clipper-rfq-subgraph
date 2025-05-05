import { Address, ethereum } from '@graphprotocol/graph-ts'
import { PriceAggregatorProxy } from '../../types/schema'
import { AggregatorV3Interface } from '../../types/templates/PriceOracle/AggregatorV3Interface'

export function loadPriceAggregatorProxy(proxyAddress: Address, block: ethereum.Block): PriceAggregatorProxy {
  let proxy = PriceAggregatorProxy.load(proxyAddress)
  if (!proxy) {
    proxy = new PriceAggregatorProxy(proxyAddress)
    let proxyContract = AggregatorV3Interface.bind(proxyAddress)
    let aggregatorAddress = proxyContract.aggregator()
    let timestamp = block.timestamp.toI32()
    proxy.aggregatorLastCheckedAt = timestamp
    proxy.aggregatorConfirmedAt = timestamp
    proxy.aggregator = aggregatorAddress
    proxy.save()
  }

  return proxy
}

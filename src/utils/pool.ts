import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { loadOrCreatePoolToken, loadToken } from './index'
import { getUsdPrice } from './prices'
import { fetchTokenBalance } from './token'
import { ClipperDirectExchange } from '../../types/templates/ClipperDirectExchange/ClipperDirectExchange'
import { PoolToken } from '../../types/schema'
import { BIG_DECIMAL_ZERO } from '../constants'

export function loadOrCreatePoolTokens(poolAddress: Bytes, block: ethereum.Block): PoolToken[] {
  let poolContract = ClipperDirectExchange.bind(Address.fromBytes(poolAddress))
  let nTokens = poolContract.nTokens()
  let poolTokens: PoolToken[] = []
  for (let i = 0; i < nTokens.toI32(); i++) {
    let nToken = poolContract.try_tokenAt(BigInt.fromI32(i))
    if (!nToken.reverted) {
      let token = loadToken(nToken.value)
      let poolToken = loadOrCreatePoolToken(poolAddress, token, block)
      poolTokens.push(poolToken)
    } else {
      log.info('Not able to fetch nToken {}', [i.toString()])
    }
  }

  return poolTokens
}

export function getPoolTokensLiquidity(poolAddress: Address, poolTokens: PoolToken[]): BigDecimal {
  let currentLiquidity = BIG_DECIMAL_ZERO
  for (let i = 0; i < poolTokens.length; i++) {
    const poolToken = poolTokens[i]
    const token = loadToken(poolToken.token)
    const tokenBalance = fetchTokenBalance(token, poolAddress)
    const tokenUsdPrice = getUsdPrice(token.symbol)
    const usdTokenLiquidity = tokenBalance.times(tokenUsdPrice)
    currentLiquidity = currentLiquidity.plus(usdTokenLiquidity)
    poolToken.tvl = tokenBalance
    poolToken.tvlUSD = tokenUsdPrice
    poolToken.save()
  }

  return currentLiquidity
}

export function getPoolTokenSupply(poolAddress: Bytes): BigInt {
  let poolContract = ClipperDirectExchange.bind(Address.fromBytes(poolAddress))
  let poolTokenSupply = poolContract.totalSupply()

  return poolTokenSupply
}

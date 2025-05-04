import { Address, BigDecimal, BigInt, Bytes, TypedMap, ethereum } from "@graphprotocol/graph-ts";
import { convertTokenToDecimal } from ".";
import { ClipperCove } from "../../types/templates/ClipperCove/ClipperCove";
import { BIG_DECIMAL_ZERO, BIG_INT_EIGHTEEN } from "../constants";
import { PoolHelpers } from "./pool";
export function eth_getCoveBalances(coveParentAddress: Address, tokenAddress: Address, decimals: i32): Array<BigDecimal> {
  let coveContract = ClipperCove.bind(coveParentAddress)
  let lastBalances = coveContract.lastBalances(tokenAddress)
  
  let lpTokens = lastBalances.rightShift(128)
  let mask = (BigInt.fromI32(1).leftShift(128)).minus(BigInt.fromI32(1))
  let tokenBalance = lastBalances.bitAnd(mask)

  let poolTokens = convertTokenToDecimal(lpTokens, BIG_INT_EIGHTEEN)
  let assetBalance = convertTokenToDecimal(tokenBalance, BigInt.fromI32(decimals))
  
  return [poolTokens, assetBalance]
}

/**
 * Get the pool address from the cove parent address.
 * Only used when creating a cove entity. Cached in Cove entities.
 * @param coveParentAddress - The address of the cove contract
 * @returns The address of the pool
 */
export function eth_getCovePoolAddress(coveParentAddress: Address): Address {
  let coveContract = ClipperCove.bind(coveParentAddress)
  let poolAddress = coveContract.CLIPPER_EXCHANGE()
  
  return poolAddress
}

export function eth_getCoveAssetPrice(
  poolContractAbiName: string,
  poolAddressBytes: Bytes,
  coveAddressBytes: Bytes,
  tokenAddressBytes: Bytes,
  decimals: i32,
  block: ethereum.Block,
): TypedMap<string, BigDecimal> {
  let poolAddress = Address.fromBytes(poolAddressBytes)
  let coveAddress = Address.fromBytes(coveAddressBytes)
  let tokenAddress = Address.fromBytes(tokenAddressBytes)
  let balances = eth_getCoveBalances(coveAddress, tokenAddress, decimals)
  let poolTokensAmount = balances[0]
  let longtailAssetBalance = balances[1]

  let poolHelpers = new PoolHelpers(poolAddress, poolContractAbiName, block)
  let pool = poolHelpers.loadPool()
  // gets the USD liquidity in our current pool
  let currentPoolLiquidity = pool.poolValueUSD
  let poolTokenSupply = pool.poolTokensSupply
  let totalPoolTokens = convertTokenToDecimal(poolTokenSupply, BIG_INT_EIGHTEEN)

  let covePoolTokenProportion = poolTokensAmount.div(totalPoolTokens)

  // usd amount of pool tokens owned by the cove.
  let usdProportion = currentPoolLiquidity.times(covePoolTokenProportion)

  // multiply by two since the amount of longtail assets should be approx the same, in usd value as the pool tokens added
  let coveLiquidity = usdProportion.times(BigDecimal.fromString('2'))
  let assetPrice = longtailAssetBalance.le(BIG_DECIMAL_ZERO)
    ? BIG_DECIMAL_ZERO
    : usdProportion.div(longtailAssetBalance)

  let returnValue = new TypedMap<string, BigDecimal>()
  returnValue.set('coveLiquidity', coveLiquidity)
  returnValue.set('assetPrice', assetPrice)
  returnValue.set('assetBalance', longtailAssetBalance)
  returnValue.set('poolTokenBalance', poolTokensAmount)
  returnValue.set('longtailAssetBalance', longtailAssetBalance)
  returnValue.set('totalPoolTokens', totalPoolTokens)
  returnValue.set('currentPoolLiquidity', currentPoolLiquidity)

  return returnValue
}

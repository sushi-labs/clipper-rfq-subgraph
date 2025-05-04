import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { convertTokenToDecimal } from ".";
import { ClipperCove } from "../../types/templates/ClipperCove/ClipperCove";
import { BIG_INT_EIGHTEEN } from "../constants";

export function getCoveBalances(coveParentAddress: Address, tokenAddress: Address, decimals: i32): Array<BigDecimal> {
  let coveContract = ClipperCove.bind(coveParentAddress)
  let lastBalances = coveContract.lastBalances(tokenAddress)
  
  let lpTokens = lastBalances.rightShift(128)
  let mask = (BigInt.fromI32(1).leftShift(128)).minus(BigInt.fromI32(1))
  let tokenBalance = lastBalances.bitAnd(mask)

  let poolTokens = convertTokenToDecimal(lpTokens, BIG_INT_EIGHTEEN)
  let assetBalance = convertTokenToDecimal(tokenBalance, BigInt.fromI32(decimals))
  
  return [poolTokens, assetBalance]
}

export function getCovePoolAddress(coveParentAddress: Address): Address {
  let coveContract = ClipperCove.bind(coveParentAddress)
  let poolAddress = coveContract.CLIPPER_EXCHANGE()
  
  return poolAddress
}

// export function get

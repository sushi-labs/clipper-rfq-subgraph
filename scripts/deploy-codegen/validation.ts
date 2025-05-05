import { Address, createPublicClient, http, erc20Abi } from 'viem'
import { Deployment, networkChainMap } from './config'
import { clipperDirectExchangeAbi } from '../../ts-abis/ClipperDirectExchange'
import { TokenMap } from './manifest'

// Helper function to validate unique addresses in a config array
export function validateUniqueAddresses(addresses: string[], type: string) {
  const addressesSet = new Set<string>()
  for (const address of addresses) {
    const lowerCaseAddress = address.toLowerCase()
    if (addressesSet.has(lowerCaseAddress)) {
      throw new Error(`Duplicate ${type} address found: ${address}`)
    }
    addressesSet.add(lowerCaseAddress)
  }
}

// Modify validatePoolTokenPrices signature and return type
export async function validatePoolTokenPrices(
  deployment: Deployment,
): Promise<{ deployment: Deployment; tokenMap: TokenMap }> {
  // Return symbol map
  console.log(`Validating token pricing for network: ${deployment.networkName}...`)

  const networkConfig = networkChainMap[deployment.networkName]
  if (!networkConfig) {
    throw new Error(`Unsupported network ${deployment.networkName} for viem client.`)
  }

  const client = createPublicClient({
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl), // Use default RPC from chain if rpcUrl is undefined
  })

  // First collect all unique tokens across all pools
  console.log(`Collecting unique tokens from all pools...`)
  const tokenMap: TokenMap = new Map()

  for (const pool of deployment.pools) {
    console.log(`  Scanning pool: ${pool.address}`)
    try {
      const nTokens = (await client.readContract({
        address: pool.address as Address,
        abi: clipperDirectExchangeAbi, // TODO: Make this ABI-aware based on pool.contractAbiName if needed
        functionName: 'nTokens',
        args: [],
      })) as bigint

      console.log(`    Found ${nTokens} tokens.`)

      for (let i = 0n; i < nTokens; i++) {
        const tokenAddress = (await client.readContract({
          address: pool.address as Address,
          abi: clipperDirectExchangeAbi, // TODO: Make this ABI-aware based on pool.contractAbiName if needed
          functionName: 'tokenAt',
          args: [i],
        })) as Address

        const normalizedAddress = tokenAddress.toLowerCase()
        if (!tokenMap.has(normalizedAddress)) {
          tokenMap.set(normalizedAddress, {
            address: tokenAddress,
            poolAddresses: [pool.address],
          })
        } else {
          const existingEntry = tokenMap.get(normalizedAddress)!
          existingEntry.poolAddresses.push(pool.address)
        }
      }
    } catch (error) {
      console.error(`  ❌ Error scanning pool ${pool.address}:`, error)
      throw new Error(`Failed to scan pool ${pool.address}: ${error}`)
    }
  }

  console.log(`\nFound ${tokenMap.size} unique tokens across all pools.`)

  // Create a map of token addresses to their symbols for logging purposes
  console.log(`\nCollecting token symbols for reference...`)
  const addressToSymbol = new Map<string, string>()
  const symbolToAddresses = new Map<string, string[]>()

  // Get symbols for all tokens for reporting (not for validation)
  for (const [normalizedAddress, tokenInfo] of tokenMap) {
    try {
      const symbol = (await client.readContract({
        address: tokenInfo.address as Address,
        abi: erc20Abi,
        functionName: 'symbol',
      })) as string

      tokenInfo.symbol = symbol
      addressToSymbol.set(normalizedAddress, symbol)

      if (!symbolToAddresses.has(symbol)) {
        symbolToAddresses.set(symbol, [tokenInfo.address])
      } else {
        symbolToAddresses.get(symbol)!.push(tokenInfo.address)
      }

      console.log(`  Token ${tokenInfo.address} (Symbol: ${symbol}).`)
    } catch (symbolError) {
      console.warn(`  ⚠️ Error processing token symbol for ${tokenInfo.address}: ${symbolError}`)
    }
  }

  // Now validate each unique token against oracles
  console.log(`\n--------------------------------------------------`)
  console.log(`Validating token pricing for unique addresses...`)
  console.log(`--------------------------------------------------`)

  // Convert price oracles to address-based lookup
  const oracleAddressByToken = new Map<string, string>(
    deployment.priceOracles.flatMap(o => o.tokens.map(t => [t.toLowerCase(), o.address.toLowerCase()])),
  )

  // Track which token oracle addresses are used
  const usedOracleTokens = new Set<string>()

  const missingPrices: {
    tokenAddress: string
    symbol?: string
    poolAddresses: string[]
  }[] = []

  // Track tokens with oracle start block issues
  const oracleStartBlockConflicts: {
    tokenAddress: string
    symbol?: string
    poolAddress: string
    poolStartBlock: number
    oracleAddress: string
    oracleStartBlock: number
  }[] = []

  // First check if we have fallback prices for any tokens based on symbol
  const tokenFallbacks = new Set<string>()
  if (deployment.fallbackPrices) {
    for (const [tokenAddress, _] of Object.entries(deployment.fallbackPrices)) {
      tokenFallbacks.add(tokenAddress.toLowerCase())
    }
  }

  // Track tokens using fallback prices
  const tokensUsingFallback: {
    tokenAddress: string
    symbol: string
    fallbackPrice: number | undefined
    poolAddresses: string[]
  }[] = []

  // Validate each token address
  for (const [tokenAddressKey, tokenInfo] of tokenMap) {
    let hasPriceSource = false

    // Check oracle addresses
    if (oracleAddressByToken.has(tokenAddressKey)) {
      console.log(`  ✅ Found price oracle for ${tokenInfo.address}${tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''}`)
      usedOracleTokens.add(tokenAddressKey)
      hasPriceSource = true

      // *** New Validation: Check if oracle start block is after pool start block ***
      const oracleAddress = oracleAddressByToken.get(tokenAddressKey)!
      const oracleConfig = deployment.priceOracles.find(o => o.address.toLowerCase() === oracleAddress)
      const oracleStartBlock = oracleConfig?.startBlock

      if (oracleStartBlock !== undefined) {
        const relevantPools = deployment.pools.filter(p => tokenInfo.poolAddresses.includes(p.address))

        for (const pool of relevantPools) {
          if (pool.startBlock < oracleStartBlock) {
            if (tokenFallbacks.has(tokenAddressKey)) {
              // Oracle starts later, but we HAVE a fallback
              const fallbackPrice = deployment.fallbackPrices?.[tokenAddressKey]
              console.warn(
                `  ⚠️ Using fallback price ($${fallbackPrice ?? 'Not Found'}) for ${tokenInfo.address}${
                  tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''
                } in pool ${pool.address} between block ${
                  pool.startBlock
                } and oracle start block ${oracleStartBlock}.\n`,
              )
            } else {
              // Oracle starts later, and we DON'T have a fallback - this is a problem
              console.warn(
                `  ❌ Oracle/Pool Start Block Conflict: Token ${tokenInfo.address}${
                  tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''
                } in pool ${pool.address} (starts ${
                  pool.startBlock
                }) has oracle ${oracleAddress} starting later (${oracleStartBlock}) with NO fallback price.\n`,
              )
              oracleStartBlockConflicts.push({
                tokenAddress: tokenInfo.address,
                symbol: tokenInfo.symbol,
                poolAddress: pool.address,
                poolStartBlock: pool.startBlock,
                oracleAddress: oracleAddress,
                oracleStartBlock: oracleStartBlock,
              })
            }
          }
        }
      }
      // *** End New Validation ***
    }

    // Check fallback prices based on symbol (only if we have a symbol)
    else if (tokenInfo.symbol && tokenFallbacks.has(tokenAddressKey)) {
      const fallbackPrice = deployment.fallbackPrices?.[tokenAddressKey]
      console.log(`  ✅ Found fallback price for ${tokenInfo.address} (${tokenInfo.symbol})`)
      console.warn(
        `  ⚠️ Warning: Using fallback price $${fallbackPrice} for token ${tokenInfo.address} (${tokenInfo.symbol}) instead of an oracle\n`,
      )
      hasPriceSource = true

      // Track this token for the fallback report
      tokensUsingFallback.push({
        tokenAddress: tokenInfo.address,
        symbol: tokenInfo.symbol,
        fallbackPrice,
        poolAddresses: tokenInfo.poolAddresses,
      })
    }

    // No price source found
    if (!hasPriceSource) {
      console.error(
        `  ❌ Missing price oracle or fallback for ${tokenInfo.address}${
          tokenInfo.symbol ? ` (${tokenInfo.symbol})` : ''
        }\n`,
      )
      missingPrices.push({
        tokenAddress: tokenInfo.address,
        symbol: tokenInfo.symbol,
        poolAddresses: tokenInfo.poolAddresses,
      })
    }
  }

  // Display fallback price report if any tokens are using fallbacks
  if (tokensUsingFallback.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(`Warning: ${tokensUsingFallback.length} tokens using fallback prices`)
    console.warn(`--------------------------------------------------`)
    tokensUsingFallback.forEach(token => {
      console.warn(`- Token: ${token.tokenAddress} (${token.symbol})`)
      console.warn(`  Fallback price: $${token.fallbackPrice}`)
      console.warn(`  Affected Pools:`)
      token.poolAddresses.forEach((poolAddress, index) => {
        console.warn(`    ${index + 1}. ${poolAddress}`)
      })
    })
    console.warn(`--------------------------------------------------`)
    console.warn(`Consider implementing price oracles for these tokens for more accurate pricing.`)
  }

  // Check for unused price oracles
  console.log(`\nChecking for unused price oracles...`)
  const unusedOracles = deployment.priceOracles.filter(oracle =>
    oracle.tokens.every(t => !usedOracleTokens.has(t.toLowerCase())),
  )

  if (unusedOracles.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(`Warning: Found ${unusedOracles.length} unused price oracles`)
    console.warn(`--------------------------------------------------`)
    unusedOracles.forEach(oracle => {
      oracle.tokens.forEach(token => {
        console.warn(`- Token: ${token}. Oracle: ${oracle.address}`)
      })
    })
    console.warn(`--------------------------------------------------`)
    console.warn(`These price oracles are configured but not used by any token in the pools.`)
    console.warn(`Consider removing them if they're not needed.`)
  }

  // Report Oracle/Pool Start Block Conflicts
  if (oracleStartBlockConflicts.length > 0) {
    console.warn(`\n--------------------------------------------------`)
    console.warn(
      `Warning: Found ${oracleStartBlockConflicts.length} Oracle/Pool Start Block Conflicts (Oracle starts after Pool, no fallback)`,
    )
    console.warn(`--------------------------------------------------`)
    oracleStartBlockConflicts.forEach(conflict => {
      console.warn(`- Token: ${conflict.tokenAddress}${conflict.symbol ? ` (${conflict.symbol})` : ''}`)
      console.warn(`  Pool: ${conflict.poolAddress} (Starts Block: ${conflict.poolStartBlock})`)
      console.warn(`  Oracle: ${conflict.oracleAddress} (Starts Block: ${conflict.oracleStartBlock})`)
      console.warn(`  Action: Provide a fallback price for this token or adjust start blocks.`)
    })
    console.warn(`--------------------------------------------------`)
    // Decide if this should be a hard error or just a warning. Currently warning.
    // To make it an error, uncomment the next line:
    // throw new Error('Oracle/Pool start block conflicts found.');
  }

  if (missingPrices.length > 0) {
    console.error('\n--------------------------------------------------')
    console.error('Validation Failed: Missing Price Information')
    console.error('--------------------------------------------------')
    missingPrices.forEach(m => {
      console.error(`- Token: ${m.tokenAddress}${m.symbol ? ` (${m.symbol})` : ''}`)
      console.error(`  Affected Pools:`)
      m.poolAddresses.forEach((poolAddress, index) => {
        console.error(`    ${index + 1}. ${poolAddress}`)
      })
    })
    console.error('--------------------------------------------------')
    console.error('Please add corresponding price oracles or fallback prices to the deployment configuration.')
    throw new Error('Token price validation failed.')
  } else {
    console.log('\n✅ Token price validation successful.')
  }

  // Return the original deployment and the symbol map
  return { deployment, tokenMap }
}

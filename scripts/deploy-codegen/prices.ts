import fs from 'fs'
import path from 'path'
import { fetchDailyPrices } from '../fetchHistoricalPricesCryptoCompare'
import { SubgraphsManifestDeploymentBase } from './config'

// Define type for fetched data (keyed by timestamp string, then symbol string)
export type FetchedDailyPrices = Record<string, Record<string, number>>;

// Type for address-keyed daily prices used in HandlebarsDeployment
export type AddressKeyedDailyPrices = NonNullable<SubgraphsManifestDeploymentBase['dailyFallbackPrices']>;

/**
 * Fetches daily prices from API or loads them from a local file if it exists.
 * @param tokens Symbols to fetch prices for.
 * @param startDate Start date (YYYY-MM-DD).
 * @param endDate End date (YYYY-MM-DD).
 * @param outputPath Path to load/save the raw price data.
 * @returns Fetched daily prices keyed by timestamp, then symbol.
 */
export async function loadOrFetchDailyPrices(
  tokens: string[],
  startDate: string,
  endDate: string,
  outputPath: string
): Promise<FetchedDailyPrices | undefined> {
  console.log(`Fetching or loading daily fallback prices for symbols: ${tokens.join(', ')} from ${startDate} to ${endDate}...`)
  let fetchedDailyPricesData: FetchedDailyPrices | undefined

  try {
    if (fs.existsSync(outputPath)) {
      console.log(`Loading existing price data from ${outputPath}...`)
      const rawData = fs.readFileSync(outputPath, 'utf8')
      fetchedDailyPricesData = JSON.parse(rawData)
    } else {
      console.log('No existing price data found, fetching from API...')
      // Ensure fetchDailyPrices returns data keyed by SYMBOL
      fetchedDailyPricesData = await fetchDailyPrices(tokens, startDate, endDate)

      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(outputPath, JSON.stringify(fetchedDailyPricesData, null, 2))
      console.log(`Raw fallback price data saved to ${outputPath}`)
    }
    return fetchedDailyPricesData;
  } catch (error) {
    console.error('Error during daily fallback price fetching/loading:', error)
    throw error; // Re-throw the error to be caught by the main script
  }
}

/**
 * Maps symbol-keyed daily prices to address-keyed daily prices.
 * @param fetchedDailyPrices Prices keyed by timestamp, then symbol.
 * @param symbolToAddresses Map from symbol string to list of corresponding addresses.
 * @param requestedSymbols List of symbols originally requested for fetching.
 * @returns Prices keyed by lowercase address, then timestamp.
 */
export function mapPricesToAddresses(
    fetchedDailyPrices: FetchedDailyPrices | undefined,
    symbolToAddresses: Map<string, string[]>,
    requestedSymbols: string[]
): AddressKeyedDailyPrices {
    const addressKeyedDailyPrices: AddressKeyedDailyPrices = {};

    if (!fetchedDailyPrices) {
        console.warn("No fetched daily prices data provided for mapping.");
        return addressKeyedDailyPrices;
    }

    console.log('Mapping fetched daily prices from symbols to addresses...')
    for (const [timestamp, dayPrices] of Object.entries(fetchedDailyPrices)) {
        for (const [symbol, price] of Object.entries(dayPrices)) {
            const addresses = symbolToAddresses.get(symbol);
            if (addresses && addresses.length > 0) {
                for (const address of addresses) {
                    const lowerCaseAddress = address.toLowerCase();
                    if (!addressKeyedDailyPrices[lowerCaseAddress]) {
                        addressKeyedDailyPrices[lowerCaseAddress] = [];
                    }
                    addressKeyedDailyPrices[lowerCaseAddress].push({
                        timestamp: parseInt(timestamp),
                        price: price as number,
                        tokenAddress: address, // Keep original casing if needed
                    });
                }
            } else {
                // Only warn if the symbol was explicitly requested but couldn't be mapped
                if (requestedSymbols.includes(symbol)) {
                    console.warn(`  ⚠️ Could not map symbol ${symbol} from fetched daily prices to a token address found in the deployment's pools. It might not be used or validation was skipped.`);
                }
            }
        }
    }
    return addressKeyedDailyPrices;
}

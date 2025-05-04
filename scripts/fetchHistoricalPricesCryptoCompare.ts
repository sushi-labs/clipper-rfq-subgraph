import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Map of token symbols to their CryptoCompare symbols
export const cryptoCompareTokenIds: { [tokenSymbol: string]: string } = {
  ETH: "ETH",
  WETH: "ETH", // Using ETH as price is same as WETH
  WBTC: "BTC", // Using BTC as price is same as WBTC
  DAI: "DAI",
  USDC: "USDC",
  USDT: "USDT",
  MATIC: "MATIC",
  WMATIC: "MATIC", // Using MATIC as price is same as WMATIC
  GYEN: "GYEN",
  REP: "REP",
  DOT: "DOT",
  GLMR: "GLMR",
  LINK: "LINK",
  MOVR: "MOVR",
  OP: "OP",
  ARB: "ARB",
  SAIL: "SAIL",
  MNT: "MANTLE",
  WMNT: "MANTLE", // Using MNT as price is same as WMNT
};

// Delay function to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches historical price data for a token from CryptoCompare
 * @param symbol Token symbol
 * @param from Start date in UNIX timestamp (seconds)
 * @param to End date in UNIX timestamp (seconds)
 * @returns Array of [timestamp, price] pairs
 */
async function fetchCryptoCompareHistoricalPrices(
  symbol: string,
  from: number,
  to: number
): Promise<[number, number][]> {
  try {
    const url = 'https://min-api.cryptocompare.com/data/v2/histoday';
    const response = await axios.get(url, {
      params: {
        fsym: symbol,
        tsym: 'USD',
        toTs: to,
        limit: Math.ceil((to - from) / 86400), // Convert time difference to days
      },
    });

    if (response.data.Response === 'Error') {
      throw new Error(response.data.Message);
    }

    // Transform the data to [timestamp, price] pairs
    return response.data.Data.Data.map((item: any) => [
      item.time * 1000, // Convert to milliseconds to match CoinGecko format
      item.close,
    ]);
  } catch (error) {
    console.error(`Error fetching prices for ${symbol}:`, error);
    return [];
  }
}

/**
 * Converts a date string to a UNIX timestamp (seconds) at 12am GMT
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns UNIX timestamp in seconds at 12am GMT
 */
export function dateToTimestamp(dateStr: string): number {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Converts a UNIX timestamp to a date string
 * @param timestamp UNIX timestamp in seconds
 * @returns Date string in YYYY-MM-DD format
 */
export function timestampToDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Normalizes a timestamp to 12am GMT of the same day
 * @param timestamp UNIX timestamp in seconds
 * @returns UNIX timestamp in seconds at 12am GMT of the same day
 */
export function normalizeToMidnightGMT(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Fetches daily historical prices for specified tokens
 * @param tokens Array of token symbols to fetch prices for
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Object mapping 12am GMT epoch timestamps to token prices
 */
export async function fetchDailyPrices(
  tokens: string[],
  startDate: string,
  endDate: string
): Promise<{ [timestamp: string]: { [token: string]: number } }> {
  const startTimestamp = dateToTimestamp(startDate);
  const endTimestamp = dateToTimestamp(endDate) + 86400; // Add one day to include the end date
  
  const dailyPrices: { [timestamp: string]: { [token: string]: number } } = {};
  
  for (const token of tokens) {
    if (!cryptoCompareTokenIds[token]) {
      console.warn(`No CryptoCompare symbol found for token: ${token}`);
      continue;
    }
    
    console.log(`Fetching historical prices for ${token}...`);
    const symbol = cryptoCompareTokenIds[token];
    const priceData = await fetchCryptoCompareHistoricalPrices(symbol, startTimestamp, endTimestamp);
    
    // Process the price data to get daily prices at 12am GMT
    for (const [timestamp, price] of priceData) {
      // Normalize to 12am GMT of the same day
      const midnightTimestamp = normalizeToMidnightGMT(timestamp);
      const midnightTimestampStr = midnightTimestamp.toString();
      
      if (!dailyPrices[midnightTimestampStr]) {
        dailyPrices[midnightTimestampStr] = {};
      }
      
      dailyPrices[midnightTimestampStr][token] = price;
    }
    
    // Wait to avoid rate limiting
    await delay(1000);
  }
  
  return dailyPrices;
}

// /**
//  * Saves daily prices to a JSON file
//  * @param dailyPrices Object mapping timestamps to token prices
//  * @param outputPath Path to save the JSON file
//  */
// export function saveDailyPrices(
//   dailyPrices: { [timestamp: string]: { [token: string]: number } },
//   outputPath: string
// ): void {
//   const outputDir = path.dirname(outputPath);
//   if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }
  
//   fs.writeFileSync(outputPath, JSON.stringify(dailyPrices, null, 2));
//   console.log(`Daily prices saved to ${outputPath}`);
// }


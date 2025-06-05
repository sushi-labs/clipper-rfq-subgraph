import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Map of token symbols to their CoinGecko IDs
export const coingeckoPriceTokenIds: { [tokenSymbol: string]: string } = {
  ETH: "ethereum",
  WBTC: "wrapped-bitcoin",
  DAI: "dai",
  USDC: "usd-coin",
  USDT: "tether",
  MATIC: "matic-network",
  WETH: "weth",
  WMATIC: "wmatic",
  GYEN: "gyen",
  REP: "augur",
  DOT: "polkadot",
  GLMR: "moonbeam",
  EARTH: "ethereum",
  ERTH: "ethereum",
  LINK: "chainlink",
  MOVR: "moonriver",
  OP: "optimism",
  COLLAB: "collab-land",
  "USDC.e": "usd-coin",
  ARB: "arbitrum",
  SAIL: "sail-2",
  MNT: "mantle",
  WMNT: "mantle",
};

// Delay function to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches historical price data for a token from CoinGecko
 * @param coinId CoinGecko ID for the token
 * @param from Start date in UNIX timestamp (seconds)
 * @param to End date in UNIX timestamp (seconds)
 * @returns Array of [timestamp, price] pairs
 */
async function fetchCoinGeckoHistoricalPrices(
  coinId: string,
  from: number,
  to: number
): Promise<[number, number][]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range`;
    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        from,
        to,
        interval: 'daily',
      },
    });

    return response.data.prices;
  } catch (error) {
    console.error(`Error fetching prices for ${coinId}:`, error);
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
  // Set time to 00:00:00 GMT
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
  const date = new Date(timestamp * 1000);
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
    if (!coingeckoPriceTokenIds[token]) {
      console.warn(`No CoinGecko ID found for token: ${token}`);
      continue;
    }
    
    console.log(`Fetching historical prices for ${token}...`);
    const coinId = coingeckoPriceTokenIds[token];
    const priceData = await fetchCoinGeckoHistoricalPrices(coinId, startTimestamp, endTimestamp);
    
    // Process the price data to get daily prices at 12am GMT
    for (const [timestamp, price] of priceData) {
      // Convert to seconds if in milliseconds
      const timestampInSeconds = timestamp / 1000 > 10000000000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
      // Normalize to 12am GMT of the same day
      const midnightTimestamp = normalizeToMidnightGMT(timestampInSeconds);
      const midnightTimestampStr = midnightTimestamp.toString();
      
      if (!dailyPrices[midnightTimestampStr]) {
        dailyPrices[midnightTimestampStr] = {};
      }
      
      // Only update if we don't have a price for this token at this timestamp yet
      // or if the timestamp is closer to midnight than the previous one
      if (!dailyPrices[midnightTimestampStr][token]) {
        dailyPrices[midnightTimestampStr][token] = price;
      }
    }
    
    // Wait to avoid rate limiting
    await delay(1200);
  }
  
  return dailyPrices;
}

/**
 * Saves daily prices to a JSON file
 * @param dailyPrices Object mapping timestamps to token prices
 * @param outputPath Path to save the JSON file
 */
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

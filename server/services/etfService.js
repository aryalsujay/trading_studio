import axios from 'axios';
import * as cheerio from 'cheerio';
import YahooFinanceRaw from 'yahoo-finance2';
import { getDatabase } from '../database.js';

// Instantiate yahoo-finance2 to fix v2 -> v3 error logs
const yahooFinance = new YahooFinanceRaw();

// List of target ETFs (can be moved to DB later, but hardcoded for MVP)
const TARGET_ETFS = [
    { symbol: 'GOLDBEES.NS', googleSymbol: 'GOLDBEES:NSE', name: 'Nippon India ETF Gold BeES' },
    { symbol: 'NIFTYBEES.NS', googleSymbol: 'NIFTYBEES:NSE', name: 'Nippon India ETF Nifty 50 BeES' },
    { symbol: 'BANKBEES.NS', googleSymbol: 'BANKBEES:NSE', name: 'Nippon India ETF Bank BeES' },
    { symbol: 'SILVERBEES.NS', googleSymbol: 'SILVERBEES:NSE', name: 'Nippon India Silver ETF' },
    { symbol: 'LIQUIDBEES.NS', googleSymbol: 'LIQUIDBEES:NSE', name: 'Nippon India ETF Liquid BeES' },
    { symbol: 'ITBEES.NS', googleSymbol: 'ITBEES:NSE', name: 'Nippon India ETF IT' },
    { symbol: 'PHARMABEES.NS', googleSymbol: 'PHARMABEES:NSE', name: 'Nippon India ETF Pharma' },
    { symbol: 'CPSEETF.NS', googleSymbol: 'CPSEETF:NSE', name: 'CPSE ETF' },
    { symbol: 'AXISGOLD.NS', googleSymbol: 'AXISGOLD:NSE', name: 'Axis Gold ETF' },
    { symbol: 'HDFCGOLD.NS', googleSymbol: 'HDFCGOLD:NSE', name: 'HDFC Gold Exchange Traded Fund' }
];

/**
 * Main entry point: Fetch data for all ETFs using preferred provider
 */
export async function updateEtfData() {
    const db = getDatabase();

    // Get preferred provider from DB
    let provider = 'google';
    try {
        const setting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'etf_data_provider'").get();
        if (setting && setting.setting_value) {
            provider = setting.setting_value.toLowerCase();
        }
    } catch (e) {
        console.warn('Could not read etf_data_provider setting, defaulting to google', e);
    }

    console.log(`[ETF Service] Starting ETF data update using provider: ${provider}`);
    const updatedData = [];

    for (const etf of TARGET_ETFS) {
        try {
            let data = null;
            if (provider === 'yahoo') {
                data = await fetchFromYahoo(etf);
            } else {
                data = await fetchFromGoogle(etf);
            }

            if (data) {
                saveEtfToDb(db, data);
                updatedData.push(data);
                console.log(`[ETF Service] Updated ${etf.symbol}: ₹${data.price} (${data.change_percent_1d}%)`);
            }
        } catch (error) {
            console.error(`[ETF Service] Failed to fetch data for ${etf.symbol} using ${provider}:`, error.message);
        }

        // Small delay to prevent rate-limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[ETF Service] Completed update. Successfully fetched ${updatedData.length}/${TARGET_ETFS.length} ETFs.`);
    return { success: true, count: updatedData.length, provider };
}

/**
 * Fetch ETF data from Google Finance using Cheerios (Scraping)
 */
async function fetchFromGoogle(etf) {
    try {
        const url = `https://www.google.com/finance/quote/${etf.googleSymbol}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // Google Finance CSS selectors (as of early 2026, these are common patterns, but can change)
        const priceStr = $('.YMlKec.fxKbKc').first().text().replace(/[^0-9.]/g, '');
        const changeStr = $('.JwB6zf').first().text(); // Contains both abs and % e.g. "+1.23 (1.45%)"

        // Extract exact numbers
        const price = parseFloat(priceStr);
        let changeAbs = 0;
        let changePct = 0;

        if (changeStr) {
            const match = changeStr.match(/([+-]?[\d,.]+)\s*\(([+-]?[\d,.]+)%\)/);
            if (match) {
                changeAbs = parseFloat(match[1].replace(/,/g, ''));
                changePct = parseFloat(match[2].replace(/,/g, ''));
            }
        }

        // For 1W, 1M we would need separate HTTP requests on Google, or complex graph parsing.
        // For MVP, if scraping Google we'll mainly get 1D accurately. 
        // Real-world scrapers would hit the chart API endpoints. 
        // We'll set 1W/1M to null to indicate they are unavailable via simple scrape.

        if (!price || isNaN(price)) {
            throw new Error("Could not parse price from HTML");
        }

        return {
            symbol: etf.symbol,
            name: etf.name,
            price: price,
            change_1d: changeAbs,
            change_percent_1d: changePct,
            change_1w: null,
            change_percent_1w: null,
            change_1m: null,
            change_percent_1m: null,
            volume: 0 // Volume requires deeper scraping on Google
        };
    } catch (e) {
        throw new Error(`Google Scrape Error: ${e.message}`);
    }
}

/**
 * Fetch ETF data using yahoo-finance2 package
 */
async function fetchFromYahoo(etf) {
    try {
        const quote = await yahooFinance.quote(etf.symbol);

        let change_1w = null;
        let change_percent_1w = null;
        let change_1m = null;
        let change_percent_1m = null;

        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 40); // 40 days back to cover 1M trading days

            // Convert to unix timestamp for chart API
            const queryOptions = {
                period1: Math.floor(startDate.getTime() / 1000),
                period2: Math.floor(endDate.getTime() / 1000),
                interval: '1d'
            };

            // Use chart() instead of deprecated historical()
            const chartResult = await yahooFinance.chart(etf.symbol, queryOptions);
            const history = chartResult?.quotes || [];

            if (history && history.length > 0) {
                const currentPrice = quote.regularMarketPrice || history[history.length - 1].close;

                let quote1W = null;
                let quote1M = null;

                const currentEpoch = new Date().getTime();
                // Iterate backwards to find the closest trading day >= 7 days and >= 30 days ago
                for (let i = history.length - 1; i >= 0; i--) {
                    const hDate = new Date(history[i].date).getTime();
                    const daysDiff = (currentEpoch - hDate) / (1000 * 60 * 60 * 24);

                    if (!quote1W && daysDiff >= 7) {
                        quote1W = history[i];
                    }
                    if (!quote1M && daysDiff >= 30) {
                        quote1M = history[i];
                    }
                }

                if (quote1W) {
                    change_1w = currentPrice - quote1W.close;
                    change_percent_1w = (change_1w / quote1W.close) * 100;
                }
                if (quote1M) {
                    change_1m = currentPrice - quote1M.close;
                    change_percent_1m = (change_1m / quote1M.close) * 100;
                }
            }
        } catch (histError) {
            console.warn(`[ETF Service] Failed to fetch history for ${etf.symbol}: ${histError.message}`);
        }

        return {
            symbol: etf.symbol,
            name: etf.name,
            price: quote.regularMarketPrice || 0,
            change_1d: quote.regularMarketChange || 0,
            change_percent_1d: quote.regularMarketChangePercent || 0,
            change_1w: change_1w,
            change_percent_1w: change_percent_1w,
            change_1m: change_1m,
            change_percent_1m: change_percent_1m,
            volume: quote.regularMarketVolume || 0
        };
    } catch (e) {
        throw new Error(`Yahoo API Error: ${e.message}`);
    }
}

/**
 * Save ETF data to database
 */
function saveEtfToDb(db, data) {
    const stmt = db.prepare(`
        INSERT INTO etf_data (
            symbol, name, price, change_1d, change_percent_1d, 
            change_1w, change_percent_1w, change_1m, change_percent_1m, 
            volume, updated_at
        ) VALUES (
            @symbol, @name, @price, @change_1d, @change_percent_1d,
            @change_1w, @change_percent_1w, @change_1m, @change_percent_1m,
            @volume, CURRENT_TIMESTAMP
        )
        ON CONFLICT(symbol) DO UPDATE SET
            name=excluded.name,
            price=excluded.price,
            change_1d=excluded.change_1d,
            change_percent_1d=excluded.change_percent_1d,
            change_1w=COALESCE(excluded.change_1w, etf_data.change_1w),
            change_percent_1w=COALESCE(excluded.change_percent_1w, etf_data.change_percent_1w),
            change_1m=COALESCE(excluded.change_1m, etf_data.change_1m),
            change_percent_1m=COALESCE(excluded.change_percent_1m, etf_data.change_percent_1m),
            volume=excluded.volume,
            updated_at=CURRENT_TIMESTAMP
    `);

    stmt.run(data);
}

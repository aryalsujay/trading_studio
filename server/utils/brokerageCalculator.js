/**
 * Zerodha Brokerage Calculator for Delivery Equity
 * Exactly matches Zerodha's calculation including all rounding rules
 * Supports both NSE and BSE exchanges with different transaction charge rates
 */

/**
 * Calculate brokerage and all charges for a delivery equity trade
 * @param {number} buyPrice - Buy price per share
 * @param {number} sellPrice - Sell price per share
 * @param {number} quantity - Number of shares
 * @param {string} exchange - Exchange type: 'NSE' or 'BSE' (default: 'NSE')
 * @returns {object} Breakdown of all charges and total brokerage
 */
export function calculateBrokerage(buyPrice, sellPrice, quantity, exchange = 'NSE') {
    // Zerodha rates for delivery equity (as of Jan 2026)
    const sttRate = 0.001;        // 0.1% on BOTH buy and sell sides
    const sebiRate = 0.000001;    // ₹10 per crore
    const stampRate = 0.00015;    // 0.015% on buy side only (₹1500 per crore max)
    const gstRate = 0.18;         // 18% GST
    const brokerage = 0;          // Zerodha: ₹0 for delivery equity

    // Exchange transaction charge rates
    const txnRates = {
        'NSE': 0.0000304,  // NSE: 0.00304%
        'BSE': 0.0000376   // BSE: 0.00376%
    };

    const txnRate = txnRates[exchange.toUpperCase()] || txnRates['NSE'];

    // Calculate turnovers
    const buyTurnover = buyPrice * quantity;
    const sellTurnover = sellPrice * quantity;
    const totalTurnover = buyTurnover + sellTurnover;

    // 1. STT (Securities Transaction Tax) - 0.1% on BOTH buy and sell
    // Total STT is rounded to nearest rupee
    const stt = Math.round((buyTurnover + sellTurnover) * sttRate);

    // 2. Exchange transaction charge
    // Applied on total turnover, rounded to 2 decimal places
    const exchangeTxn = Math.round(totalTurnover * txnRate * 100) / 100;

    // 3. SEBI charges - ₹10 per crore of turnover
    // Rounded to 2 decimal places
    const sebi = Math.round(totalTurnover * sebiRate * 100) / 100;

    // 4. Stamp duty - 0.015% on buy turnover only
    // Rounded to nearest rupee
    const stampDuty = Math.round(buyTurnover * stampRate);

    // 5. GST - 18% on (brokerage + exchange charges + SEBI charges)
    // Rounded to 2 decimal places
    const gstBase = brokerage + exchangeTxn + sebi;
    const gst = Math.round(gstBase * gstRate * 100) / 100;

    // Total charges
    const total = stt + exchangeTxn + gst + sebi + stampDuty + brokerage;

    return {
        breakdown: {
            buyTurnover,
            sellTurnover,
            totalTurnover,
            stt,
            exchangeTxn,
            sebi,
            gst,
            stampDuty,
            brokerage
        },
        total,
        exchange: exchange.toUpperCase()
    };
}

/**
 * Calculate net profit after brokerage
 * @param {number} buyPrice - Buy price per share
 * @param {number} sellPrice - Sell price per share
 * @param {number} quantity - Number of shares
 * @param {string} exchange - Exchange type: 'NSE' or 'BSE' (default: 'NSE')
 * @returns {object} Gross profit, brokerage, and net profit
 */
export function calculateNetProfit(buyPrice, sellPrice, quantity, exchange = 'NSE') {
    const grossProfit = (sellPrice - buyPrice) * quantity;
    const { total: brokerage } = calculateBrokerage(buyPrice, sellPrice, quantity, exchange);
    const netProfit = grossProfit - brokerage;

    return {
        grossProfit,
        brokerage,
        netProfit
    };
}

/**
 * Calculate breakeven points
 * @param {number} buyPrice - Buy price per share
 * @param {number} quantity - Number of shares
 * @param {string} exchange - Exchange type: 'NSE' or 'BSE' (default: 'NSE')
 * @returns {object} Breakeven sell price and points needed
 */
export function calculateBreakeven(buyPrice, quantity, exchange = 'NSE') {
    // We need to find the sell price where net profit = 0
    // This requires iterating since brokerage depends on sell price

    let sellPrice = buyPrice;
    let netProfit = -1;
    let iterations = 0;
    const maxIterations = 1000;

    // Binary search for breakeven
    let low = buyPrice;
    let high = buyPrice * 2; // Assume breakeven is within 2x buy price

    while (iterations < maxIterations && Math.abs(netProfit) > 0.01) {
        sellPrice = (low + high) / 2;
        const result = calculateNetProfit(buyPrice, sellPrice, quantity, exchange);
        netProfit = result.netProfit;

        if (netProfit < 0) {
            low = sellPrice;
        } else {
            high = sellPrice;
        }

        iterations++;
    }

    const pointsToBreakeven = sellPrice - buyPrice;

    return {
        breakevenSellPrice: sellPrice,
        pointsToBreakeven
    };
}

import Database from 'better-sqlite3';
import { calculateBrokerage } from '../server/utils/brokerageCalculator.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../db/trading.db');
const db = new Database(dbPath);

// Sample trades: 5 profitable, 5 loss trades
const sampleTrades = [
    // Profitable Trades
    {
        symbol: 'NIFTYBEES',
        buy_date: '2026-01-05',
        buy_price: 240,
        sell_date: '2026-01-15',
        sell_price: 255,
        quantity: 25,
        notes: 'Profit trade - NIFTY uptrend'
    },
    {
        symbol: 'BANKBEES',
        buy_date: '2026-01-08',
        buy_price: 450,
        sell_date: '2026-01-20',
        sell_price: 470,
        quantity: 15,
        notes: 'Profit trade - Banking sector rally'
    },
    {
        symbol: 'GOLDBEES',
        buy_date: '2026-01-10',
        buy_price: 58,
        sell_date: '2026-01-22',
        sell_price: 62,
        quantity: 50,
        notes: 'Profit trade - Gold price increase'
    },
    {
        symbol: 'NIFTYBEES',
        buy_date: '2026-01-12',
        buy_price: 248,
        sell_date: '2026-01-25',
        sell_price: 258,
        quantity: 20,
        notes: 'Profit trade - Market momentum'
    },
    {
        symbol: 'SETFNIF50',
        buy_date: '2026-01-14',
        buy_price: 180,
        sell_date: '2026-01-26',
        sell_price: 188,
        quantity: 30,
        notes: 'Profit trade - NIFTY 50 gains'
    },

    // Loss Trades
    {
        symbol: 'JUNIORBEES',
        buy_date: '2026-01-07',
        buy_price: 500,
        sell_date: '2026-01-18',
        sell_price: 485,
        quantity: 10,
        notes: 'Loss trade - Mid-cap correction'
    },
    {
        symbol: 'LIQUIDBEES',
        buy_date: '2026-01-09',
        buy_price: 1002,
        sell_date: '2026-01-19',
        sell_price: 1000,
        quantity: 20,
        notes: 'Loss trade - Slight liquidity adjustment'
    },
    {
        symbol: 'BANKBEES',
        buy_date: '2026-01-11',
        buy_price: 465,
        sell_date: '2026-01-21',
        sell_price: 455,
        quantity: 12,
        notes: 'Loss trade - Banking sector dip'
    },
    {
        symbol: 'GOLDBEES',
        buy_date: '2026-01-16',
        buy_price: 61,
        sell_date: '2026-01-24',
        sell_price: 59,
        quantity: 40,
        notes: 'Loss trade - Gold price drop'
    },
    {
        symbol: 'NIFTYBEES',
        buy_date: '2026-01-17',
        buy_price: 252,
        sell_date: '2026-01-23',
        sell_price: 246,
        quantity: 18,
        notes: 'Loss trade - Market volatility'
    }
];

console.log('🔄 Inserting sample trades...\n');

// Get the first member ID (default member)
const member = db.prepare('SELECT id FROM members LIMIT 1').get();
if (!member) {
    console.error('❌ No members found in database. Please set up members first.');
    process.exit(1);
}

const memberId = member.id;
const exchange = 'NSE'; // Default exchange
const instrumentTypeId = 1; // Assuming ETF

// Get the highest trade number
const maxTradeNumber = db.prepare('SELECT MAX(trade_number) as max FROM trades').get();
let tradeNumber = (maxTradeNumber.max || 0) + 1;

let profitCount = 0;
let lossCount = 0;
let totalBrokerage = 0;

const insertStmt = db.prepare(`
  INSERT INTO trades (
    trade_number, member_id, instrument_type_id, symbol, 
    buy_date, buy_price, sell_date, sell_price, quantity,
    brokerage, net_profit, notes, exchange
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const trade of sampleTrades) {
    // Calculate brokerage and net profit
    const brokerageResult = calculateBrokerage(
        trade.buy_price,
        trade.sell_price,
        trade.quantity,
        exchange
    );

    const grossProfit = (trade.sell_price - trade.buy_price) * trade.quantity;
    const netProfit = grossProfit - brokerageResult.total;

    insertStmt.run(
        tradeNumber,
        memberId,
        instrumentTypeId,
        trade.symbol,
        trade.buy_date,
        trade.buy_price,
        trade.sell_date,
        trade.sell_price,
        trade.quantity,
        brokerageResult.total,
        netProfit,
        trade.notes,
        exchange
    );

    console.log(`✅ Trade #${tradeNumber}: ${trade.symbol} - ${netProfit >= 0 ? 'PROFIT' : 'LOSS'} ₹${Math.abs(netProfit).toFixed(2)}`);
    console.log(`   Brokerage: ₹${brokerageResult.total.toFixed(2)}, Net P/L: ₹${netProfit.toFixed(2)}`);

    if (netProfit >= 0) profitCount++;
    else lossCount++;

    totalBrokerage += brokerageResult.total;
    tradeNumber++;
}

console.log(`\n📊 Summary:`);
console.log(`   Total Trades: ${sampleTrades.length}`);
console.log(`   Profitable: ${profitCount}`);
console.log(`   Loss: ${lossCount}`);
console.log(`   Total Brokerage: ₹${totalBrokerage.toFixed(2)}`);
console.log(`\n✨ Sample trades inserted successfully!`);

db.close();

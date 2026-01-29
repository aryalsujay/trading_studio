import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'trading.db');
const db = new Database(dbPath);

console.log('🌱 Starting Data Reset & Seeding...');

// 1. Clear existing data
console.log('🗑️  Clearing all existing data...');
db.prepare('DELETE FROM trades').run();
db.prepare('DELETE FROM capital_transactions').run();
db.prepare('DELETE FROM member_profit_shares').run();
db.prepare('DELETE FROM profit_distributions').run();
db.prepare('DELETE FROM members').run();
db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('trades', 'capital_transactions', 'members', 'member_profit_shares', 'profit_distributions')").run();

// 2. Insert Members
console.log('👤 Creating Members...');
const users = [
    { code: 'DS', name: 'DS', capital: 3000000 },
    { code: 'SA', name: 'SA', capital: 700000 },
    { code: 'SG', name: 'SG', capital: 300000 }
];

const insertMember = db.prepare('INSERT INTO members (member_code, member_name, is_active) VALUES (?, ?, 1)');
const insertCapital = db.prepare('INSERT INTO capital_transactions (member_id, transaction_date, amount, transaction_type, notes) VALUES (?, ?, ?, ?, ?)');

const memberMap = {}; // code -> id

for (const user of users) {
    const res = insertMember.run(user.code, user.name);
    const memberId = res.lastInsertRowid;
    memberMap[user.code] = memberId;

    // Add Initial Capital
    insertCapital.run(memberId, '2025-01-01', user.capital, 'DEPOSIT', 'Initial Capital');
    console.log(`   - Added Member: ${user.name} with ₹${user.capital.toLocaleString()}`);
}

// 3. Create Trades
console.log('📈 Creating Trades...');
const insertTrade = db.prepare(`
    INSERT INTO trades (
        member_id, instrument_type_id, symbol, trade_number, 
        buy_date, buy_price, sell_date, sell_price, 
        quantity, brokerage, net_profit, notes, exchange
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Get instrument type
const instrumentType = db.prepare("SELECT id FROM instrument_types WHERE type_code = 'DELIVERY_EQUITY'").get();
if (!instrumentType) {
    // Should exist from schema, but safety check
    console.error('CRITICAL: Instrument Type DELIVERY_EQUITY not found.');
    process.exit(1);
}

// Helper to calculate brokerage/profit
function calculateTrade(buyPrice, sellPrice, qty) {
    if (!sellPrice) return { brokerage: 0, netProfit: 0 };

    const turnover = (buyPrice + sellPrice) * qty;
    // Rough estimate for seeding: 0.1% STT + small charges ~ 0.12% turnover or flat
    // Using a simplified logic similar to server.js for consistency if copied, 
    // but here we just want *reasonable* numbers.
    // Let's assume ~0.1% of turnover as brokerage+taxes for simplicity in seeding
    const brokerage = turnover * 0.001;
    const gross = (sellPrice - buyPrice) * qty;
    const netProfit = gross - brokerage;
    return { brokerage, netProfit };
}

let tradeCount = 0;

// 3.1 Personal Trades (10 per member)
for (const user of users) {
    const memberId = memberMap[user.code];
    for (let i = 1; i <= 10; i++) {
        const symbol = ['NIFTYBEES', 'BANKBEES', 'GOLDBEES', 'SILVERBEES', 'LIQUIDBEES'][i % 5];
        const buyPrice = 100 + (Math.random() * 100);
        const profitScenario = Math.random() > 0.5; // 50% profit
        const sellPrice = profitScenario ? buyPrice * 1.05 : buyPrice * 0.95;
        const qty = 10;

        const { brokerage, netProfit } = calculateTrade(buyPrice, sellPrice, qty);

        insertTrade.run(
            memberId,
            instrumentType.id,
            symbol,
            ++tradeCount,
            '2025-01-10',
            buyPrice.toFixed(2),
            '2025-01-15',
            sellPrice.toFixed(2),
            qty,
            brokerage.toFixed(2),
            netProfit.toFixed(2),
            `Personal Trade ${i} for ${user.code}`,
            'NSE'
        );
    }
    console.log(`   - added 10 personal trades for ${user.code}`);
}

// 3.2 Autosplit Trades (30 trades, split across all 3 members)
// This effectively means 30 "parent" trades becoming 30 * 3 = 90 entries? 
// Or 30 entries total distributed?
// User said: "30 autosplit trades". Usually this implies 30 *exectutions* that are split.
// If the user sees them as "Trade Lines", then it's 30 sets of splits.
// The task says "Add 60 trades (10 personal * 3 members, 30 autosplit)". 
// 10*3 = 30 personal trades. 
// "30 autosplit" likely means 30 *logical* trades that are split into usually 3 parts each.
// So 30 * 3 = 90 actual trade rows? Or does "60 trades" mean 60 rows total?
// "3add 60 trades 10 each for personal 3 members, 30 autosplit trades"
// 10*3 = 30 personal. 30 autosplit = 60 total EVENTS. 
// If an autosplit trade creates 3 rows, then we'll have 30 + (30*3) = 120 rows.
// Let's assumes "30 autosplit trades" means 30 ORIGINATING trades.
// I will create 30 split scenarios.

console.log('   - Creating 30 Autosplit Trade Sets...');

// Calculate ratios
const totalCap = users.reduce((sum, u) => sum + u.capital, 0);

for (let i = 1; i <= 30; i++) {
    const symbol = ['INFY', 'TCS', 'RELIANCE', 'HDFCBANK', 'ICICIBANK'][i % 5];
    const buyPrice = 1000 + (Math.random() * 1000);
    const sellPrice = buyPrice * (1 + (Math.random() * 0.1 - 0.05)); // +/- 5%
    const totalQty = 100; // Block quantity

    // Split logic
    let remainingQty = totalQty;

    // Sort buy capital desc for remainder distribution
    const sortedUsers = [...users].sort((a, b) => b.capital - a.capital);
    const allocations = [];

    // First pass: ratio based
    for (const user of sortedUsers) {
        const ratio = user.capital / totalCap;
        const qty = Math.floor(totalQty * ratio);
        allocations.push({ code: user.code, qty: qty });
        remainingQty -= qty;
    }

    // Distribute remainder
    let rIdx = 0;
    while (remainingQty > 0) {
        allocations[rIdx].qty++;
        remainingQty--;
        rIdx = (rIdx + 1) % allocations.length;
    }

    // Insert trade rows
    for (const alloc of allocations) {
        if (alloc.qty <= 0) continue;
        const memberId = memberMap[alloc.code];
        const { brokerage, netProfit } = calculateTrade(buyPrice, sellPrice, alloc.qty);

        insertTrade.run(
            memberId,
            instrumentType.id,
            symbol,
            ++tradeCount, // Autosplit trades might share a "Trade Number" in some systems, but schema has unique trade_number/id or loose. I'll incr distinct for now.
            '2025-01-20',
            buyPrice.toFixed(2),
            '2025-01-25',
            sellPrice.toFixed(2),
            alloc.qty,
            brokerage.toFixed(2),
            netProfit.toFixed(2),
            `Autosplit Trade ${i} [${alloc.code}]`,
            'NSE'
        );
    }
}

console.log('✅ Seeding Complete!');

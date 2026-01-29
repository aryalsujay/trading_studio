import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'db', 'trading.db');

// Ensure database directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

console.log('\n🔧 Starting data import from Excel...\n');

// First, clear existing data (except schema tables)
console.log('📝 Resetting database...');
db.exec(`
  DELETE FROM member_profit_shares;
  DELETE FROM profit_distributions;
  DELETE FROM trades;
  DELETE FROM capital_transactions;
  DELETE FROM members WHERE member_code != 'PRIMARY';
`);

// Step 1: Add all members
console.log('👥 Adding members: SA, SG, DS...');

const insertMember = db.prepare(`
  INSERT INTO members (member_code, member_name, profit_share_ratio, capital_division, is_active)
  VALUES (?, ?, ?, ?, 1)
`);

// Based on your Excel data:
// SA: ₹150,000 capital, 30 divisions
// SG: ₹700,000 capital, 35 divisions  
// DS: ₹2,500,000 capital, 36 divisions

const members = [
    { code: 'SA', name: 'Sujay', profit_ratio: 0.9, division: 30, capital: 150000 }, // 90% to Sujay, 10% to Denish
    { code: 'SG', name: 'SG', profit_ratio: 0.9, division: 35, capital: 700000 },     // 90% to SG, 10% to Denish
    { code: 'DS', name: 'DS', profit_ratio: 1.0, division: 36, capital: 2500000 }     // 100% to DS
];

const memberIds = {};

members.forEach(m => {
    const result = insertMember.run(m.code, m.name, m.profit_ratio, m.division);
    memberIds[m.code] = result.lastInsertRowid;
    console.log(`  ✅ ${m.code}: ${m.name} (₹${m.capital.toLocaleString('en-IN')})`);
});

// Step 2: Add capital transactions from Excel TXN sheet
console.log('\n💰 Adding capital transactions...');

const insertCapital = db.prepare(`
  INSERT INTO capital_transactions (member_id, transaction_date, amount, transaction_type, notes)
  VALUES (?, ?, ?, 'DEPOSIT', ?)
`);

// From your Excel TXN sheet:
const capitalTransactions = [
    // SA transactions
    { member: 'SA', date: '2025-05-05', amount: 50000, notes: 'Initial deposit 1' },
    { member: 'SA', date: '2025-05-21', amount: 40000, notes: 'Deposit 2' },
    { member: 'SA', date: '2025-06-24', amount: 60000, notes: 'Deposit 3' },

    // SG transactions
    { member: 'SG', date: '2025-05-12', amount: 200000, notes: 'Initial deposit 1' },
    { member: 'SG', date: '2025-06-26', amount: 200000, notes: 'Deposit 2' },
    { member: 'SG', date: '2025-08-05', amount: 100000, notes: 'Deposit 3' },
    { member: 'SG', date: '2025-11-18', amount: 200000, notes: 'Deposit 4' },

    // DS - single large capital
    { member: 'DS', date: '2025-01-01', amount: 2500000, notes: 'Initial capital' }
];

capitalTransactions.forEach(txn => {
    insertCapital.run(memberIds[txn.member], txn.date, txn.amount, txn.notes);
    console.log(`  ✅ ${txn.member}: ₹${txn.amount.toLocaleString('en-IN')} on ${txn.date}`);
});

// Step 3: Verify totals
console.log('\n📊 Verifying capital totals...');

members.forEach(m => {
    const result = db.prepare(`
    SELECT SUM(amount) as total
    FROM capital_transactions
    WHERE member_id = ?
  `).get(memberIds[m.code]);

    console.log(`  ${m.code}: ₹${result.total.toLocaleString('en-IN')} / ₹${m.capital.toLocaleString('en-IN')} ${result.total === m.capital ? '✅' : '⚠️'}`);
});

// Summary
console.log('\n✅ Import completed successfully!\n');
console.log('📋 Summary:');
console.log(`   - Members: ${members.length}`);
console.log(`   - Capital transactions: ${capitalTransactions.length}`);
console.log(`   - Total capital: ₹${(150000 + 700000 + 2500000).toLocaleString('en-IN')}`);
console.log('\n🚀 Ready to use! Refresh your browser to see the data.\n');

db.close();

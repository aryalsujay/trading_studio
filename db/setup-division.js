import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'trading.db');
const db = new Database(dbPath);

console.log('🔄 Starting Database Reset for Division Logic...');

// 1. Drop Tables to ensure Schema update
const tables = ['trades', 'capital_transactions', 'member_profit_shares', 'profit_distributions', 'members', 'instrument_types'];
tables.forEach(t => db.prepare(`DROP TABLE IF EXISTS ${t}`).run());
console.log('🗑️  Dropped old tables.');

// 2. Re-apply Schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);
console.log('🏗️  Re-created tables with new schema (Quantity: REAL).');

// 3. Seed Members & Capital
// Division Defaults: DS (36), SA (35), SG (30)
console.log('👤 Seeding Members with Divisions...');

const users = [
    { code: 'DS', name: 'DS', capital: 3000000, division: 36 },
    { code: 'SA', name: 'SA', capital: 700000, division: 35 },
    { code: 'SG', name: 'SG', capital: 300000, division: 30 }
];

const insertMember = db.prepare('INSERT INTO members (member_code, member_name, capital_division, is_active) VALUES (?, ?, ?, 1)');
const insertCapital = db.prepare('INSERT INTO capital_transactions (member_id, transaction_date, amount, transaction_type, notes) VALUES (?, ?, ?, ?, ?)');

for (const user of users) {
    const res = insertMember.run(user.code, user.name, user.division);
    const memberId = res.lastInsertRowid;

    // Add Initial Capital
    insertCapital.run(memberId, '2025-01-01', user.capital, 'DEPOSIT', 'Initial Capital');
    console.log(`   - Added ${user.code} (Div: ${user.division}, Cap: ₹${user.capital.toLocaleString()})`);
}

console.log('✅ Database Ready (Empty Trades).');

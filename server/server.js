import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { getDatabase, closeDatabase, initDatabase } from './database.js';
import { calculateBrokerage, calculateNetProfit } from './utils/brokerageCalculator.js';

// Import new services
import { updateEtfData } from './services/etfService.js';
import { updateFiiDiiData } from './services/fiiDiiService.js';

const app = express();
const PORT = 3000;

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
let db = getDatabase();

// ===== CRON JOBS =====
// Update ETF Data every 5 minutes during market hours (09:15 to 15:30 IST)
cron.schedule('*/5 9-15 * * 1-5', async () => {
  try {
    await updateEtfData();
  } catch (e) {
    console.error("Cron: Failed ETF Update", e);
  }
}, { timezone: "Asia/Kolkata" });

// Update FII/DII Data at end of day (18:00 IST)
cron.schedule('0 18 * * 1-5', async () => {
  try {
    await updateFiiDiiData();
  } catch (e) {
    console.error("Cron: Failed FII DII Update", e);
  }
}, { timezone: "Asia/Kolkata" });

// Kick off initial fetch on startup
setTimeout(async () => {
  console.log("Starting initial data fetches...");
  await updateEtfData();
  await updateFiiDiiData();
}, 2000);



// Get all members
app.get('/api/members', (req, res) => {
  try {
    const members = db.prepare("SELECT * FROM members WHERE is_active = 1 ORDER BY id").all();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MARKETS MODULE ROUTES (ETF / FII DII) =====

// Get all ETFs
app.get('/api/etfs', (req, res) => {
  try {
    const etfs = db.prepare("SELECT * FROM etf_data ORDER BY symbol").all();
    res.json(etfs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force refresh ETFs
app.post('/api/etfs/refresh', async (req, res) => {
  try {
    const result = await updateEtfData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get FII/DII Data
app.get('/api/fii-dii', (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM fii_dii_data ORDER BY date DESC, category ASC limit 60").all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force refresh FII DII
app.post('/api/fii-dii/refresh', async (req, res) => {
  try {
    const result = await updateFiiDiiData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get App Setting (Targeted for ETF Provider)
app.get('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    const setting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = ?").get(key);
    res.json({ key, value: setting ? setting.setting_value : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update App Setting
app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) return res.status(400).json({ error: "Missing key or value" });

    db.prepare(`
      INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=CURRENT_TIMESTAMP
    `).run(key, value);

    // If we changed ETF provider, kick off an immediate sync
    if (key === 'etf_data_provider') {
      updateEtfData();
    }

    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current member (backwards compatibility)
app.get('/api/member', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM members WHERE is_active = 1 LIMIT 1').get();
    res.json(member || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new member
app.post('/api/members', (req, res) => {
  try {
    const { member_code, member_name, capital, capital_division } = req.body;

    if (!member_code || !member_name) {
      return res.status(400).json({ error: 'Member code and name are required' });
    }

    const check = db.prepare('SELECT id FROM members WHERE member_code = ?').get(member_code);
    if (check) {
      return res.status(409).json({ error: 'Member code already exists' });
    }

    const stmt = db.prepare('INSERT INTO members (member_code, member_name, capital_division, is_active) VALUES (?, ?, ?, 1)');
    const result = stmt.run(member_code, member_name, capital_division || 30);
    const newMemberId = result.lastInsertRowid;

    // Add initial capital if provided
    if (capital && capital > 0) {
      db.prepare(`
        INSERT INTO capital_transactions (member_id, transaction_date, amount, transaction_type, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(newMemberId, new Date().toISOString().split('T')[0], capital, 'DEPOSIT', 'Initial Capital');
    }

    const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(newMemberId);
    res.json(newMember);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error);
  }
});

// Update member
app.put('/api/member', (req, res) => {
  try {
    const { member_name, capital_division } = req.body;
    const stmt = db.prepare(`
      UPDATE members 
      SET member_name = ?, capital_division = ?, updated_at = CURRENT_TIMESTAMP
      WHERE is_active = 1
    `);
    stmt.run(member_name, capital_division);

    const updated = db.prepare('SELECT * FROM members WHERE is_active = 1 LIMIT 1').get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete member (Soft delete)
app.delete('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Optional: Check if default member? Maybe prevent deleting the last member?
    // For now, simple soft delete
    const stmt = db.prepare('UPDATE members SET is_active = 0 WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found or already deleted' });
    }

    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CAPITAL TRANSACTION ROUTES =====

// Get all capital transactions
app.get('/api/capital-transactions', (req, res) => {
  try {
    const { member_id } = req.query;

    let query = `
      SELECT ct.*, m.member_name, m.member_code
      FROM capital_transactions ct
      JOIN members m ON ct.member_id = m.id
      WHERE 1=1
    `;

    const params = [];
    if (member_id) {
      query += ' AND ct.member_id = ?';
      params.push(member_id);
    }

    query += ' ORDER BY ct.transaction_date DESC';

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add capital transaction
app.post('/api/capital-transactions', (req, res) => {
  try {
    const { transaction_date, amount, transaction_type, notes, member_id } = req.body;

    let memberId = member_id;
    if (!memberId) {
      const member = db.prepare('SELECT id FROM members WHERE is_active = 1 LIMIT 1').get();
      memberId = member.id;
    }

    const stmt = db.prepare(`
      INSERT INTO capital_transactions (member_id, transaction_date, amount, transaction_type, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(memberId, transaction_date, amount, transaction_type, notes);

    const newTransaction = db.prepare('SELECT * FROM capital_transactions WHERE id = ?').get(result.lastInsertRowid);
    res.json(newTransaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update capital transaction
app.put('/api/capital-transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_date, amount, transaction_type, notes } = req.body;

    const stmt = db.prepare(`
      UPDATE capital_transactions
      SET transaction_date = ?, amount = ?, transaction_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(transaction_date, amount, transaction_type, notes, id);

    const updated = db.prepare('SELECT * FROM capital_transactions WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete capital transaction
app.delete('/api/capital-transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM capital_transactions WHERE id = ?');
    stmt.run(id);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SYMBOL ROUTES =====

// Get all active symbols
app.get('/api/symbols', (req, res) => {
  try {
    const symbols = db.prepare('SELECT * FROM symbols WHERE is_active = 1 ORDER BY symbol').all();
    res.json(symbols);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new symbol (with case-insensitive duplicate check)
app.post('/api/symbols', (req, res) => {
  try {
    const { symbol, category } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check for existing symbol (case-insensitive)
    const existing = db.prepare('SELECT id FROM symbols WHERE UPPER(symbol) = ?').get(normalizedSymbol);
    if (existing) {
      return res.status(409).json({ error: 'Symbol already exists', symbol: normalizedSymbol });
    }

    const stmt = db.prepare('INSERT INTO symbols (symbol, category) VALUES (?, ?)');
    const result = stmt.run(normalizedSymbol, category || null);

    const newSymbol = db.prepare('SELECT * FROM symbols WHERE id = ?').get(result.lastInsertRowid);
    res.json(newSymbol);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to ensure symbol exists (auto-add if new)
function ensureSymbolExists(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  // Check if symbol exists
  const existing = db.prepare('SELECT id FROM symbols WHERE UPPER(symbol) = ?').get(normalizedSymbol);
  if (existing) {
    return normalizedSymbol;
  }

  // Auto-add new symbol
  try {
    const stmt = db.prepare('INSERT INTO symbols (symbol, category) VALUES (?, ?)');
    stmt.run(normalizedSymbol, 'User-Added');
    console.log(`✨ Auto-added new symbol: ${normalizedSymbol}`);
  } catch (error) {
    // Ignore duplicate errors from race conditions
    if (!error.message.includes('UNIQUE constraint')) {
      console.error(`Failed to auto-add symbol ${normalizedSymbol}:`, error.message);
    }
  }

  return normalizedSymbol;
}

// Helper function to get member's current capital
// Capital = (Deposits - Withdrawals) + Realized P&L
function getMemberCapital(memberId) {
  // 1. Get Net Deposits (Deposits - Withdrawals)
  const capitalResult = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END), 0) as net_deposits
    FROM capital_transactions
    WHERE member_id = ?
  `).get(memberId);

  // 2. Get Realized P&L from trades
  const tradesResult = db.prepare(`
    SELECT 
      COALESCE(SUM(net_profit), 0) as realized_pnl
    FROM trades
    WHERE member_id = ? AND sell_price IS NOT NULL
  `).get(memberId);

  const netDeposits = capitalResult ? capitalResult.net_deposits : 0;
  const realizedPnl = tradesResult ? tradesResult.realized_pnl : 0;

  return {
    netDeposits,
    realizedPnl,
    currentCapital: netDeposits + realizedPnl
  };
}



// ===== TRADE ROUTES =====

// Get all trades
app.get('/api/trades', (req, res) => {
  try {
    const { symbol, start_date, end_date, profit_only, member_id, status } = req.query;

    let query = `
      SELECT t.*, m.member_name, m.member_code, it.type_name
      FROM trades t
      JOIN members m ON t.member_id = m.id
      JOIN instrument_types it ON t.instrument_type_id = it.id
      WHERE 1=1
    `;

    const params = [];

    if (member_id) {
      query += ' AND t.member_id = ?';
      params.push(member_id);
    }

    if (symbol) {
      query += ' AND t.symbol LIKE ?';
      params.push(`%${symbol}%`);
    }

    if (start_date) {
      query += ' AND t.buy_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND t.buy_date <= ?';
      params.push(end_date);
    }

    if (profit_only === 'true') {
      query += ' AND t.net_profit > 0';
    } else if (profit_only === 'false') {
      query += ' AND t.net_profit < 0';
    }

    // Status filter: live (no sell_price), closed (has sell_price), or all
    if (status === 'live') {
      query += ' AND t.sell_price IS NULL';
    } else if (status === 'closed') {
      query += ' AND t.sell_price IS NOT NULL';
    }

    query += ' ORDER BY t.buy_date DESC, t.id DESC';

    const trades = db.prepare(query).all(...params);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== IMPORT/EXPORT ROUTES =====

// Import CSV
app.post('/api/trades/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const errors = [];
  let successCount = 0;
  let failCount = 0;

  try {
    let fileContent = req.file.buffer.toString('utf8');

    // Strip BOM if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // Normalize line endings to \n
    fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    console.log('--- CSV Raw Content Snippet ---');
    console.log(fileContent.substring(0, 200));
    console.log('-------------------------------');

    const stream = Readable.from(fileContent);

    // Get all members for mapping logic
    const allMembers = db.prepare('SELECT * FROM members').all();
    const memberMap = new Map(allMembers.map(m => [m.member_code.toUpperCase(), m.id]));
    const defaultMember = allMembers[0]; // Fallback to first member if needed

    // Helper to parse date from DD-MMM-YY to YYYY-MM-DD
    const parseDate = (dateStr) => {
      if (!dateStr || dateStr === 'LIVE') return null;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    };

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`CSV Parsed. Rows found: ${results.length}`);
        if (results.length > 0) {
          console.log('Sample Row keys:', Object.keys(results[0]));
        }

        try {
          const insertStmt = db.prepare(`
            INSERT INTO trades (
              member_id, instrument_type_id, symbol, trade_number, 
              buy_date, buy_price, sell_date, sell_price, 
              quantity, brokerage, net_profit, notes, exchange
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const instrumentType = db.prepare("SELECT id FROM instrument_types WHERE type_code = 'DELIVERY_EQUITY'").get();

          // Get max trade number
          const maxTradeNumRow = db.prepare('SELECT MAX(trade_number) as max_num FROM trades').get();
          let nextTradeNum = (maxTradeNumRow.max_num || 0) + 1;

          const transaction = db.transaction((rows) => {
            for (const row of rows) {
              try {
                // Basic validation
                // Check common variations of keys
                const symbol = row.Symbol || row.symbol || row.SYMBOL;
                const rawQty = row.Quantity || row.quantity || row.qty;
                const rawPrice = row['Entry Price'] || row['Entry Price '] || row.price;

                if (!symbol || !rawQty || !rawPrice) {
                  console.log('Skipping invalid row:', row);
                  failCount++;
                  continue;
                }

                const normalizedSymbol = ensureSymbolExists(symbol);
                // Clean quantity (remove commas)
                const qty = parseFloat(rawQty.toString().replace(/,/g, ''));
                const buyPrice = parseFloat(rawPrice.toString().replace(/,/g, ''));
                const rawExitPrice = row['Exit Price'] || row['Exit Price '] || null;
                const sellPrice = rawExitPrice ? parseFloat(rawExitPrice.toString().replace(/,/g, '')) : null;

                // Date Parsing
                let buyDate = parseDate(row['Entry Date']) || new Date().toISOString().split('T')[0];
                let sellDate = parseDate(row['Exit Date']);

                const notes = row.Notes || '';

                // Member Logic
                // Last column "Member" (or mapped from header)
                // Logic:
                // - Empty/Null => Default Member (Primary/first active) - OR maybe keep unsplit? User said "if 2 then DS,SA". 'Default' implies single.
                // - "ALL" => Split across all active members
                // - "DS,SA" => Split across specific members
                // - "DS" => Single member

                let tradeMembers = [];
                let isSplit = false;

                const memberStr = (row.Member || row.member || '').trim().toUpperCase();

                if (memberStr === 'ALL') {
                  tradeMembers = allMembers.filter(m => m.is_active);
                  isSplit = true;
                } else if (memberStr.includes(',')) {
                  // Specific list
                  const codes = memberStr.split(',').map(s => s.trim());
                  tradeMembers = allMembers.filter(m => codes.includes(m.member_code.toUpperCase()));
                  isSplit = true;
                } else if (memberStr) {
                  // Single member
                  const m = memberMap.get(memberStr);
                  if (m) tradeMembers = [allMembers.find(am => am.id === m)];
                }

                if (tradeMembers.length === 0) {
                  // Default to first active member
                  tradeMembers = [defaultMember];
                }

                if (isSplit && tradeMembers.length > 0) {
                  // Check for Division overrides in CSV Row
                  // Look for keys like "Div {Code}", "Div_{Code}", "Division {Code}", etc.
                  const divisionOverrides = {};
                  Object.keys(row).forEach(key => {
                    const k = key.trim();
                    if (k.toLowerCase().startsWith('div ') || k.toLowerCase().startsWith('div_')) {
                      const parts = k.split(/[ _]+/);
                      if (parts.length >= 2) {
                        const code = parts[1].toUpperCase();
                        const val = parseFloat(row[key]);
                        if (code && !isNaN(val) && val > 0) {
                          divisionOverrides[code] = val;
                        }
                      }
                    }
                  });

                  // Apply overrides to a clone of tradeMembers
                  const activeMembersForSplit = tradeMembers.map(m => {
                    const overrideDiv = divisionOverrides[m.member_code];
                    if (overrideDiv) {
                      return { ...m, capital_division: overrideDiv };
                    }
                    return m;
                  });

                  // Split Logic
                  const allocations = calculateSplitAllocations(qty, activeMembersForSplit);

                  // Calc total brokerage for the block first (for distribution)
                  let totalBrokerage = 0;
                  if (sellPrice) {
                    const calc = calculateNetProfit(buyPrice, sellPrice, qty, 'NSE');
                    totalBrokerage = calc.brokerage;
                  }

                  for (const alloc of allocations) {
                    if (alloc.allocatedQty <= 0) continue;

                    let allocatedBrokerage = 0;
                    let allocatedNetProfit = 0;

                    if (sellPrice) {
                      allocatedBrokerage = totalBrokerage * (alloc.allocatedQty / qty);
                      const grossProfit = (sellPrice - buyPrice) * alloc.allocatedQty;
                      allocatedNetProfit = grossProfit - allocatedBrokerage;
                    }

                    insertStmt.run(
                      alloc.id,
                      instrumentType.id,
                      symbol,
                      nextTradeNum,
                      buyDate,
                      buyPrice,
                      sellDate,
                      sellPrice,
                      alloc.allocatedQty,
                      allocatedBrokerage,
                      allocatedNetProfit,
                      notes ? `${notes} [Import Split]` : `[Import Split]`,
                      'NSE'
                    );
                  }
                  // Increment trade number once per split group? Matches 'autosplit' logic desire
                  nextTradeNum++;
                } else {
                  // Single Trade
                  // Calculation logic
                  const memberId = tradeMembers[0].id;
                  let brokerage = 0;
                  let netProfit = 0;

                  if (sellPrice) {
                    const calc = calculateNetProfit(buyPrice, sellPrice, qty, 'NSE');
                    brokerage = calc.brokerage;
                    netProfit = calc.netProfit;
                  }

                  insertStmt.run(
                    memberId,
                    instrumentType.id,
                    symbol,
                    nextTradeNum++,
                    buyDate,
                    buyPrice,
                    sellDate,
                    sellPrice,
                    qty,
                    brokerage,
                    netProfit,
                    notes,
                    'NSE'
                  );
                }
                successCount++;
              } catch (err) {
                console.error("Row error:", err);
                failCount++;
              }
            }
          });

          transaction(results);
          res.json({ success: successCount, failed: failCount });

        } catch (dbError) {
          res.status(500).json({ error: dbError.message });
        }
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CSV EXPORT ROUTE (must be before :id route) =====
app.get('/api/trades/export', (req, res) => {
  try {
    const trades = db.prepare(`
      SELECT 
        m.member_code,
        t.trade_number,
        t.symbol,
        t.buy_date,
        t.buy_price,
        t.quantity,
        (t.buy_price * t.quantity) as investment,
        t.sell_date,
        t.sell_price,
        (t.sell_price * t.quantity) as turnover,
        ((t.sell_price - t.buy_price) * t.quantity) as gross_profit,
        CASE 
          WHEN t.sell_price IS NULL THEN NULL
          ELSE ROUND(((t.sell_price - t.buy_price) / t.buy_price) * 100, 2)
        END as profit_percent,
        t.brokerage,
        t.net_profit,
        t.notes
      FROM trades t
      JOIN members m ON t.member_id = m.id
      ORDER BY t.trade_number DESC
    `).all();

    const headers = [
      'Member', 'Trade #', 'Symbol', 'Entry Date', 'Entry Price', 'Quantity', 'Investment',
      'Exit Price', 'Exit Date', 'Turnover', 'Gross P/L', 'Profit %',
      'Brokerage', 'Net P/L', 'Status', 'Notes'
    ];

    const rows = trades.map(trade => {
      const isLive = !trade.sell_price;
      const status = isLive ? 'LIVE' : (trade.net_profit >= 0 ? 'Profit' : 'Loss');

      return [
        trade.member_code || '',
        trade.trade_number || '',
        trade.symbol || '',
        trade.buy_date || '',
        trade.buy_price || '',
        trade.quantity || '',
        trade.investment ? trade.investment.toFixed(2) : '',
        trade.sell_price || '',
        trade.sell_date || '',
        trade.turnover ? trade.turnover.toFixed(2) : '',
        !isLive && trade.gross_profit ? trade.gross_profit.toFixed(2) : '',
        !isLive && trade.profit_percent ? trade.profit_percent.toFixed(2) : '',
        trade.brokerage ? trade.brokerage.toFixed(2) : '',
        trade.net_profit ? trade.net_profit.toFixed(2) : '',
        status,
        `"${(trade.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=trades-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single trade
app.get('/api/trades/:id', (req, res) => {
  try {
    const { id } = req.params;
    const trade = db.prepare(`
      SELECT t.*, m.member_name, it.type_name
      FROM trades t
      JOIN members m ON t.member_id = m.id
      JOIN instrument_types it ON t.instrument_type_id = it.id
      WHERE t.id = ?
    `).get(id);

    if (trade) {
      res.json(trade);
    } else {
      res.status(404).json({ error: 'Trade not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new trade WITH AUTO-NUMBERING AND OPTIONAL EXIT
app.post('/api/trades', (req, res) => {
  try {
    const { symbol, buy_date, buy_price, sell_date, sell_price, quantity, notes, exchange, member_id } = req.body;

    // Ensure symbol exists in database (auto-add if new)
    const normalizedSymbol = ensureSymbolExists(symbol);

    // Get member - use provided member_id or default to first active member
    let member;
    if (member_id) {
      member = db.prepare('SELECT id FROM members WHERE id = ?').get(member_id);
    } else {
      member = db.prepare('SELECT id FROM members WHERE is_active = 1 LIMIT 1').get();
    }

    const instrumentType = db.prepare("SELECT id FROM instrument_types WHERE type_code = 'DELIVERY_EQUITY'").get();

    // Auto-increment trade_number
    const maxTradeNum = db.prepare('SELECT MAX(trade_number) as max_num FROM trades').get();
    const trade_number = (maxTradeNum.max_num || 0) + 1;

    // Calculate brokerage and net profit ONLY if sell data exists
    const exchangeType = exchange || 'NSE';
    let brokerage = 0;
    let net_profit = 0;

    if (sell_price && sell_date) {
      const brokerageCalc = calculateBrokerage(buy_price, sell_price, quantity, exchangeType);
      brokerage = brokerageCalc.total;
      net_profit = ((sell_price - buy_price) * quantity) - brokerage;
    }

    const stmt = db.prepare(`
      INSERT INTO trades (member_id, instrument_type_id, symbol, trade_number, buy_date, buy_price, sell_date, sell_price, quantity, brokerage, net_profit, notes, exchange)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      member.id,
      instrumentType.id,
      normalizedSymbol,
      trade_number,
      buy_date,
      buy_price,
      sell_date || null,
      sell_price || null,
      quantity,
      brokerage,
      net_profit,
      notes,
      exchangeType
    );

    const newTrade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);
    res.json(newTrade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to calculate split allocations
function calculateSplitAllocations(quantity, members) {
  let totalScore = 0;
  const memberScores = members.map(m => {
    const cap = getMemberCapital(m.id);
    const currentCapital = Math.max(0, cap.currentCapital);
    const division = m.capital_division && m.capital_division > 0 ? m.capital_division : 1;

    const score = currentCapital / division;
    totalScore += score;

    return {
      ...m,
      currentCapital,
      score,
      division
    };
  });

  if (totalScore === 0) {
    // Fallback to equal split if scores are 0 (e.g. no capital)
    const equalWeight = 1 / members.length;
    return members.map(m => ({ ...m, allocatedQty: quantity * equalWeight, weight: equalWeight, division: m.capital_division }));
  }

  return memberScores.map(m => {
    const weight = m.score / totalScore;
    const allocatedQty = quantity * weight;
    return { ...m, allocatedQty, weight };
  });
}


// Update trade WITH OPTIONAL EXIT SUPPORT
app.put('/api/trades/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, buy_date, buy_price, sell_date, sell_price, quantity, notes, exchange } = req.body;

    // Ensure symbol exists in database (auto-add if new)
    const normalizedSymbol = ensureSymbolExists(symbol);

    // Recalculate brokerage and net profit ONLY if sell data exists
    const exchangeType = exchange || 'NSE';
    let brokerage = 0;
    let net_profit = 0;

    if (sell_price && sell_date) {
      const brokerageCalc = calculateBrokerage(buy_price, sell_price, quantity, exchangeType);
      brokerage = brokerageCalc.total;
      net_profit = ((sell_price - buy_price) * quantity) - brokerage;
    }

    const stmt = db.prepare(`
      UPDATE trades
      SET symbol = ?, buy_date = ?, buy_price = ?, sell_date = ?, sell_price = ?, quantity = ?, 
          brokerage = ?, net_profit = ?, notes = ?, exchange = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(normalizedSymbol, buy_date, buy_price, sell_date || null, sell_price || null, quantity, brokerage, net_profit, notes, exchangeType, id);

    const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Split Trade (Allocated across members based on capital)
app.post('/api/trades/split', (req, res) => {
  try {
    const { symbol, buy_date, buy_price, sell_date, sell_price, quantity, notes, exchange } = req.body;

    // 1. Get all active members
    const members = db.prepare('SELECT id, member_name FROM members WHERE is_active = 1').all();

    if (members.length === 0) {
      return res.status(400).json({ error: 'No active members found to split trade.' });
    }

    // 2. Calculate Allocations
    let allocations;
    try {
      allocations = calculateSplitAllocations(quantity, members);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // 5. Calculate TOTAL Brokerage & Net Profit on the full quantity first
    let totalBrokerage = 0;

    // We only calculate brokerage if there is a sell price (exit)
    if (sell_price) {
      const calc = calculateNetProfit(buy_price, sell_price, quantity, exchange || 'NSE');
      totalBrokerage = calc.brokerage;
    }

    // 6. Create trades in transaction
    const createdTrades = [];
    const instrumentType = db.prepare("SELECT id FROM instrument_types WHERE type_code = 'DELIVERY_EQUITY'").get();
    const normalizedSymbol = ensureSymbolExists(symbol);

    // Get max trade number once
    const maxTradeNumRow = db.prepare('SELECT MAX(trade_number) as max_num FROM trades').get();
    let nextTradeNum = (maxTradeNumRow.max_num || 0) + 1;

    const insertTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO trades (
          member_id, instrument_type_id, symbol, trade_number, 
          buy_date, buy_price, sell_date, sell_price, 
          quantity, brokerage, net_profit, notes, exchange
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const alloc of allocations) {
        if (alloc.allocatedQty <= 0) continue;

        // Proportional Brokerage Allocation (MemberQty / TotalQty)
        let allocatedBrokerage = 0;
        let allocatedNetProfit = 0;

        if (sell_price) {
          // Precise float calculation
          allocatedBrokerage = totalBrokerage * (alloc.allocatedQty / quantity);
          const grossProfit = (sell_price - buy_price) * alloc.allocatedQty;
          allocatedNetProfit = grossProfit - allocatedBrokerage;
        }

        const info = stmt.run(
          alloc.id,
          instrumentType.id,
          normalizedSymbol,
          nextTradeNum,
          buy_date,
          buy_price,
          sell_date || null,
          sell_price || null,
          alloc.allocatedQty, // Insert float directly
          allocatedBrokerage,
          allocatedNetProfit,
          notes ? `${notes} [Split Div:${alloc.division}]` : `[Split Div:${alloc.division}]`,
          exchange || 'NSE'
        );

        createdTrades.push({
          id: info.lastInsertRowid,
          member_name: alloc.member_name,
          quantity: alloc.allocatedQty,
          weight: alloc.weight.toFixed(4),
          trade_number: nextTradeNum,
          brokerage: allocatedBrokerage
        });

        // Don't simplify nextTradeNum increment for splits if they share same tradeNum logically?
        // User asked for "10 each... 30 autosplit". Usually split implies separate trades.
        // Keeping unique trade number per split part for now.
        nextTradeNum++;
      }
    });

    insertTx();

    res.json({
      message: `Successfully created ${createdTrades.length} trades.`,
      trades: createdTrades
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete trades - MUST come before /:id route to prevent routing conflicts
app.delete('/api/trades/bulk', (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid trade IDs array' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM trades WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);

    res.json({
      success: true,
      deleted: result.changes,
      message: `${result.changes} trade(s) deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete trade
app.delete('/api/trades/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM trades WHERE id = ?');
    stmt.run(id);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CALCULATION ROUTES =====

// Calculate brokerage (standalone calculator) WITH EXCHANGE SUPPORT
app.post('/api/calculate-brokerage', (req, res) => {
  try {
    const { buy_price, sell_price, quantity, exchange } = req.body;
    const exchangeType = exchange || 'NSE';
    const result = calculateBrokerage(buy_price, sell_price, quantity, exchangeType);
    const profitResult = calculateNetProfit(buy_price, sell_price, quantity, exchangeType);

    res.json({
      ...result,
      ...profitResult
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get profit summary
app.get('/api/profit-summary', (req, res) => {
  try {
    const { member_id } = req.query;

    // Build WHERE clauses
    const capitalWhere = member_id ? 'WHERE member_id = ?' : 'WHERE 1=1';
    const tradesWhere = member_id ? 'WHERE member_id = ?' : 'WHERE 1=1';
    const params = member_id ? [member_id] : [];

    // Total capital (Net Deposits: Deposits - Withdrawals)
    const capitalResult = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END), 0) as total_capital
      FROM capital_transactions
      ${capitalWhere}
    `).get(...params);

    // Total trades stats
    const tradesResult = db.prepare(`
      SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(net_profit), 0) as total_profit,
        COALESCE(SUM(brokerage), 0) as total_brokerage,
        COALESCE(SUM(CASE WHEN net_profit > 0 THEN net_profit ELSE 0 END), 0) as total_gains,
        COALESCE(SUM(CASE WHEN net_profit < 0 THEN net_profit ELSE 0 END), 0) as total_losses,
        COUNT(CASE WHEN net_profit > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN net_profit < 0 THEN 1 END) as losing_trades
      FROM trades
      ${tradesWhere}
    `).get(...params);

    // Available for withdrawal = Net Deposits + Realized Profits
    const available_withdrawal = capitalResult.total_capital + tradesResult.total_profit;

    res.json({
      total_capital: capitalResult.total_capital,
      total_profit: tradesResult.total_profit,
      total_brokerage: tradesResult.total_brokerage,
      available_withdrawal,
      total_trades: tradesResult.total_trades,
      winning_trades: tradesResult.winning_trades,
      losing_trades: tradesResult.losing_trades,
      total_gains: tradesResult.total_gains,
      total_losses: tradesResult.total_losses,
      win_rate: tradesResult.total_trades > 0
        ? ((tradesResult.winning_trades / tradesResult.total_trades) * 100).toFixed(2)
        : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats WITH COMPREHENSIVE CALCULATIONS
app.get('/api/dashboard-stats', (req, res) => {
  try {
    const { member_id } = req.query;

    // Build WHERE clauses
    const capitalWhere = member_id ? 'WHERE member_id = ?' : '';
    const tradesWhere = member_id ? 'WHERE member_id = ?' : '';
    const recentTradesWhere = member_id ? 'WHERE t.member_id = ?' : '';
    const params = member_id ? [member_id] : [];

    // Get total capital from capital transactions
    // Note: Use 'DEPOSIT' (uppercase) checking if that's how it's stored, or case-insensitive logic
    // Based on previous tool output, it is 'DEPOSIT'
    const capitalResult = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'DEPOSIT' THEN amount ELSE -amount END), 0) as total_capital
      FROM capital_transactions
      ${capitalWhere}
    `).get(...params);

    // Get comprehensive trade statistics
    const tradesStats = db.prepare(`
      SELECT
        COUNT(*) as total_trades,
        COUNT(CASE WHEN sell_price IS NOT NULL THEN 1 END) as exited_trades,
        COUNT(CASE WHEN sell_price IS NULL THEN 1 END) as live_trades,
        COALESCE(SUM(CASE WHEN sell_price IS NOT NULL THEN brokerage ELSE 0 END), 0) as total_brokerage,
        COALESCE(SUM(CASE WHEN sell_price IS NOT NULL THEN net_profit ELSE 0 END), 0) as total_net_profit,
        COALESCE(SUM(CASE WHEN sell_price IS NOT NULL AND net_profit > 0 THEN net_profit ELSE 0 END), 0) as total_gains,
        COALESCE(SUM(CASE WHEN sell_price IS NOT NULL AND net_profit < 0 THEN net_profit ELSE 0 END), 0) as total_losses,
        COUNT(CASE WHEN sell_price IS NOT NULL AND net_profit > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN sell_price IS NOT NULL AND net_profit < 0 THEN 1 END) as losing_trades
      FROM trades
      ${tradesWhere}
    `).get(...params);

    // Calculate total gain %
    const totalNetProfit = tradesStats.total_net_profit || 0;
    const totalCapital = capitalResult.total_capital;
    const total_gain_percent = totalCapital !== 0
      ? ((totalNetProfit / Math.abs(totalCapital)) * 100).toFixed(2)
      : '0.00';

    // Recent trades (last 10)
    const recentTrades = db.prepare(`
      SELECT t.*, it.type_name, m.member_name
      FROM trades t
      JOIN instrument_types it ON t.instrument_type_id = it.id
      JOIN members m ON t.member_id = m.id
      ${recentTradesWhere}
      ORDER BY t.buy_date DESC, t.id DESC
      LIMIT 10
    `).all(...params);

    // Top performing symbols
    const topSymbols = db.prepare(`
      SELECT 
        symbol,
        COUNT(*) as trade_count,
        SUM(CASE WHEN sell_price IS NOT NULL THEN net_profit ELSE 0 END) as total_profit,
        AVG(CASE WHEN sell_price IS NOT NULL THEN net_profit ELSE 0 END) as avg_profit
      FROM trades
      GROUP BY symbol
      HAVING total_profit IS NOT NULL
      ORDER BY total_profit DESC
      LIMIT 5
    `).all();

    res.json({
      total_capital: capitalResult.total_capital,
      total_net_profit: tradesStats.total_net_profit,
      total_brokerage: tradesStats.total_brokerage,
      total_gain_percent,
      total_trades: tradesStats.total_trades,
      exited_trades: tradesStats.exited_trades,
      live_trades: tradesStats.live_trades,
      winning_trades: tradesStats.winning_trades,
      losing_trades: tradesStats.losing_trades,
      total_gains: tradesStats.total_gains,
      total_losses: tradesStats.total_losses,
      win_rate: tradesStats.exited_trades > 0
        ? ((tradesStats.winning_trades / tradesStats.exited_trades) * 100).toFixed(2)
        : 0,
      recent_trades: recentTrades,
      top_symbols: topSymbols
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




// ===== ANALYTICS ROUTES =====

// Get monthly performance stats
app.get('/api/analytics/monthly-performance', (req, res) => {
  try {
    const { member_id, start_date, end_date } = req.query;

    let query = `
      SELECT 
        strftime('%Y-%m', sell_date) as month,
        COUNT(*) as total_trades,
        SUM(CASE WHEN net_profit > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN net_profit < 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(brokerage) as total_brokerage,
        SUM(net_profit) as net_profit,
        SUM(buy_price * quantity) as total_investment,
        SUM((sell_price - buy_price) * quantity) as gross_profit
      FROM trades 
      WHERE sell_price IS NOT NULL
    `;

    const params = [];
    if (member_id) {
      query += ' AND member_id = ?';
      params.push(member_id);
    }

    if (start_date) {
      query += ' AND sell_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND sell_date <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY month ORDER BY month DESC';

    const monthlyStats = db.prepare(query).all(...params);
    res.json(monthlyStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get capital growth over time
app.get('/api/analytics/capital-growth', (req, res) => {
  try {
    const { member_id, start_date, end_date } = req.query;

    // 1. Get all capital transactions
    let capQuery = `
      SELECT transaction_date as date, amount, transaction_type 
      FROM capital_transactions 
      WHERE 1=1
    `;
    const capParams = [];
    if (member_id) {
      capQuery += ' AND member_id = ?';
      capParams.push(member_id);
    }
    capQuery += ' ORDER BY transaction_date ASC';
    const capitalTxns = db.prepare(capQuery).all(...capParams);

    // 2. Get all realized P&L from trades
    let tradeQuery = `
      SELECT sell_date as date, net_profit 
      FROM trades 
      WHERE sell_price IS NOT NULL
    `;
    const tradeParams = [];
    if (member_id) {
      tradeQuery += ' AND member_id = ?';
      tradeParams.push(member_id);
    }
    tradeQuery += ' ORDER BY sell_date ASC';
    const tradeTxns = db.prepare(tradeQuery).all(...tradeParams);

    // Combine and sort all events
    const events = [
      ...capitalTxns.map(t => ({
        date: t.date,
        amount: t.transaction_type === 'DEPOSIT' ? t.amount : -t.amount,
        type: 'CAPITAL'
      })),
      ...tradeTxns.map(t => ({
        date: t.date,
        amount: t.net_profit,
        type: 'PROFIT'
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let timeSeries = [];
    let currentCapital = 0;
    let netDeposits = 0;

    events.forEach(event => {
      if (event.type === 'CAPITAL') {
        netDeposits += event.amount;
      }
      currentCapital += event.amount;

      // Update or add entry for this date
      if (timeSeries.length > 0 && timeSeries[timeSeries.length - 1].date === event.date) {
        timeSeries[timeSeries.length - 1].value = currentCapital;
        timeSeries[timeSeries.length - 1].netDeposits = netDeposits;
      } else {
        timeSeries.push({
          date: event.date,
          value: currentCapital,
          netDeposits: netDeposits
        });
      }
    });

    // 3. Filter based on date range (post-calculation to maintain accurate running balance)
    if (start_date) {
      const startDateObj = new Date(start_date);
      // Find the last known capital BEFORE the start date to serve as "opening balance" point?
      // Or just slice. Charts usually auto-connect.
      // Better: Include one point immediately before start_date if possible, so the line doesn't start from 0 if zoomed in.
      // But for simplicity, just filter.
      timeSeries = timeSeries.filter(t => new Date(t.date) >= startDateObj);
    }

    if (end_date) {
      const endDateObj = new Date(end_date);
      timeSeries = timeSeries.filter(t => new Date(t.date) <= endDateObj);
    }

    res.json(timeSeries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DATABASE MANAGEMENT ROUTES =====


// Export Database (Download)
app.get('/api/database/export', (req, res) => {
  try {
    // Flush WAL to disk to ensure backup is current
    if (db) {
      try {
        db.pragma('wal_checkpoint(RESTART)');
        console.log('✅ WAL flushed for export');
      } catch (e) {
        console.warn('⚠️ FAL checkpoint warning:', e.message);
      }
    }

    const file = path.join(process.cwd(), 'db', 'trading.db');
    if (fs.existsSync(file)) {
      res.download(file, `trading-backup-${new Date().toISOString().split('T')[0]}.db`);
    } else {
      res.status(404).json({ error: 'Database file not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import Database (Restore)
// Import Database (Restore)
app.post('/api/database/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const dbDir = path.join(process.cwd(), 'db');
    const dbPath = path.join(dbDir, 'trading.db');
    const walPath = path.join(dbDir, 'trading.db-wal');
    const shmPath = path.join(dbDir, 'trading.db-shm');
    const backupPath = path.join(dbDir, `trading.db.bak-${Date.now()}`);

    // 1. Close existing connection (to release file lock)
    try {
      closeDatabase();
      console.log('Database connection closed for restore.');
    } catch (e) {
      console.warn('Warning: Failed to close DB connection:', e.message);
    }

    // 2. Backup existing
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // 3. Clean up WAL files (CRITICAL: prevents old state resurrection)
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // 4. Write new file (Overwrite)
    fs.writeFileSync(dbPath, req.file.buffer);

    // 5. Re-initialize database connection
    try {
      db = initDatabase();
      console.log('Database connection re-initialized.');
    } catch (e) {
      console.error('Failed to re-init DB:', e);
      throw new Error('Failed to initialize restored database. File might be corrupt.');
    }

    res.json({ success: true, message: 'Database restored successfully. The application will reload.' });

  } catch (error) {
    console.error('Restore failed:', error);
    // Attempt re-init if failed, so server isn't dead
    try { if (!db) db = initDatabase(); } catch (e) { }
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ETF Trading Ledger API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ETF Trading Ledger API running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${db.name}`);
  console.log(`✅ NSE & BSE exchange support enabled`);
  console.log(`\n✨ Ready for local trading ledger management!\n`);
});

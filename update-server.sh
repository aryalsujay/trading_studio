#!/bin/bash

# Script to completely update server.js with exchange support
# This script updates the server in place

cat > /Users/sujay/etf/server/server-new.js << 'SERVEREOF'
import express from 'express';
import cors from 'cors';
import { getDatabase } from './database.js';
import { calculateBrokerage, calculateNetProfit } from './utils/brokerageCalculator.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = getDatabase();

// ===== MEMBER ROUTES =====

// Get all members
app.get('/api/members', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members WHERE member_code != "PRIMARY" ORDER BY id').all();
    res.json(members);
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

// ===== TRADE ROUTES =====

// Get all trades
app.get('/api/trades', (req, res) => {
  try {
    const { symbol, start_date, end_date, profit_only, member_id } = req.query;

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
      query += ' AND t.trade_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND t.trade_date <= ?';
      params.push(end_date);
    }

    if (profit_only === 'true') {
      query += ' AND t.net_profit > 0';
    } else if (profit_only === 'false') {
      query += ' AND t.net_profit < 0';
    }

    query += ' ORDER BY t.trade_date DESC, t.id DESC';

    const trades = db.prepare(query).all(...params);
    res.json(trades);
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

// Add new trade WITH EXCHANGE SUPPORT
app.post('/api/trades', (req, res) => {
  try {
    const { symbol, trade_date, buy_price, sell_price, quantity, notes, exchange, member_id } = req.body;

    // Get member - use provided member_id or default to first active member
    let member;
    if (member_id) {
      member = db.prepare('SELECT id FROM members WHERE id = ?').get(member_id);
    } else {
      member = db.prepare('SELECT id FROM members WHERE is_active = 1 LIMIT 1').get();
    }
    
    const instrumentType = db.prepare("SELECT id FROM instrument_types WHERE type_code = 'DELIVERY_EQUITY'").get();

    // Calculate brokerage and net profit with exchange (default NSE)
    const exchangeType = exchange || 'NSE';
    const { total: brokerage } = calculateBrokerage(buy_price, sell_price, quantity, exchangeType);
    const net_profit = ((sell_price - buy_price) * quantity) - brokerage;

    const stmt = db.prepare(`
      INSERT INTO trades (member_id, instrument_type_id, symbol, trade_date, buy_price, sell_price, quantity, brokerage, net_profit, notes, exchange)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      member.id,
      instrumentType.id,
      symbol.toUpperCase(),
      trade_date,
      buy_price,
      sell_price,
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

// Update trade WITH EXCHANGE SUPPORT
app.put('/api/trades/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, trade_date, buy_price, sell_price, quantity, notes, exchange } = req.body;

    // Recalculate brokerage and net profit with exchange
    const exchangeType = exchange || 'NSE';
    const { total: brokerage } = calculateBrokerage(buy_price, sell_price, quantity, exchangeType);
    const net_profit = ((sell_price - buy_price) * quantity) - brokerage;

    const stmt = db.prepare(`
      UPDATE trades
      SET symbol = ?, trade_date = ?, buy_price = ?, sell_price = ?, quantity = ?, 
          brokerage = ?, net_profit = ?, notes = ?, exchange = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(symbol.toUpperCase(), trade_date, buy_price, sell_price, quantity, brokerage, net_profit, notes, exchangeType, id);

    const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
    res.json(updated);
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
    
    // Total capital
    const capitalResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_capital
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

    // Available for withdrawal = capital + profit
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

// Get dashboard stats
app.get('/api/dashboard-stats', (req, res) => {
  try {
    // Recent trades (last 5)
    const recentTrades = db.prepare(`
      SELECT t.*, it.type_name
      FROM trades t
      JOIN instrument_types it ON t.instrument_type_id = it.id
      ORDER BY t.trade_date DESC, t.id DESC
      LIMIT 5
    `).all();

    // Top performing symbols
    const topSymbols = db.prepare(`
      SELECT 
        symbol,
        COUNT(*) as trade_count,
        SUM(net_profit) as total_profit,
        AVG(net_profit) as avg_profit
      FROM trades
      GROUP BY symbol
      ORDER BY total_profit DESC
      LIMIT 5
    `).all();

    // Monthly P&L
    const monthlyPL = db.prepare(`
      SELECT 
        strftime('%Y-%m', trade_date) as month,
        SUM(net_profit) as profit,
        COUNT(*) as trades
      FROM trades
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `).all();

    res.json({
      recent_trades: recentTrades,
      top_symbols: topSymbols,
      monthly_pl: monthlyPL
    });
  } catch (error) {
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
SERVEREOF

# Backup old server and replace with new one
mv /Users/sujay/etf/server/server.js /Users/sujay/etf/server/server.js.old
mv /Users/sujay/etf/server/server-new.js /Users/sujay/etf/server/server.js

echo "✅ Server updated with full exchange support!"

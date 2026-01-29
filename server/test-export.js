import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { getDatabase } from './database.js';
import { calculateBrokerage, calculateNetProfit } from './utils/brokerageCalculator.js';

const app = express();
const PORT = 3000;

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = getDatabase();

// Test route
app.get('/test-export', (req, res) => {
    const trades = db.prepare('SELECT COUNT(*) as count FROM trades').get();
    res.json({ message: 'Test works', tradeCount: trades.count });
});

// CSV Export - MUST come before :id route
app.get('/api/trades/export', (req, res) => {
    try {
        console.log('CSV Export endpoint hit!');
        const trades = db.prepare(`
      SELECT 
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
      ORDER BY t.trade_number DESC
    `).all();

        console.log('Found', trades.length, 'trades');

        // Create CSV header
        const headers = [
            'Trade #', 'Symbol', 'Entry Date', 'Entry Price', 'Quantity', 'Investment',
            'Exit Date', 'Exit Price', 'Turnover', 'Gross P/L', 'Profit %',
            'Brokerage', 'Net P/L', 'Status', 'Notes'
        ];

        // Create CSV rows
        const rows = trades.map(trade => {
            const isLive = !trade.sell_price;
            const status = isLive ? 'LIVE' : (trade.net_profit >= 0 ? 'Profit' : 'Loss');

            return [
                trade.trade_number || '',
                trade.symbol || '',
                trade.buy_date || '',
                trade.buy_price || '',
                trade.quantity || '',
                trade.investment ? trade.investment.toFixed(2) : '',
                trade.sell_date || '',
                trade.sell_price || '',
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
        console.error('CSV Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

console.log('✅ CSV Export route registered at /api/trades/export');

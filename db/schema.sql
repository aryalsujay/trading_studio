-- ETF Trading Ledger Database Schema
-- Scalable design: MVP uses single member, ready for multi-member expansion

-- Members table (MVP: one member, extensible for future)
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_code TEXT UNIQUE NOT NULL,  -- e.g., 'SA', 'SG', 'DS'
    member_name TEXT NOT NULL,
    profit_share_ratio REAL DEFAULT 1.0,  -- For future multi-member profit sharing
    capital_division INTEGER,  -- Number of divisions for capital allocation
    is_active INTEGER DEFAULT 1,  -- 1 = active, 0 = inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Instrument types lookup (MVP: DELIVERY_EQUITY only)
CREATE TABLE IF NOT EXISTS instrument_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_code TEXT UNIQUE NOT NULL,  -- 'DELIVERY_EQUITY', 'FUTURES', 'OPTIONS', 'COMMODITY'
    type_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Capital transactions (deposits and withdrawals)
CREATE TABLE IF NOT EXISTS capital_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    transaction_date DATE NOT NULL,
    amount REAL NOT NULL,  -- Positive for deposit, negative for withdrawal
    transaction_type TEXT NOT NULL,  -- 'DEPOSIT' or 'WITHDRAWAL'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Trades table (all buy/sell transactions)
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    instrument_type_id INTEGER NOT NULL,
    trade_number INTEGER,
    symbol TEXT NOT NULL,  -- e.g., 'NIFTYBEES', 'BANKBEES'
    buy_date DATE NOT NULL,
    buy_price REAL NOT NULL,
    sell_date DATE,
    sell_price REAL,
    quantity REAL NOT NULL,
    brokerage REAL NOT NULL,  -- Auto-calculated using Zerodha formula
    net_profit REAL NOT NULL,  -- (sell_price - buy_price) * qty - brokerage
    exchange TEXT DEFAULT 'NSE',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (instrument_type_id) REFERENCES instrument_types(id)
);

-- Profit distributions (for future multi-member sharing)
CREATE TABLE IF NOT EXISTS profit_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distribution_date DATE NOT NULL,
    total_profit REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Member profit shares (junction table for flexible profit sharing)
CREATE TABLE IF NOT EXISTS member_profit_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distribution_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    share_amount REAL NOT NULL,
    share_ratio REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (distribution_id) REFERENCES profit_distributions(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_member ON trades(member_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(buy_date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_capital_member ON capital_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_capital_date ON capital_transactions(transaction_date);

-- Insert default instrument types
INSERT OR IGNORE INTO instrument_types (type_code, type_name, is_active) VALUES
    ('DELIVERY_EQUITY', 'Delivery Equity (ETF)', 1),
    ('FUTURES', 'Futures & Options', 0),
    ('OPTIONS', 'Options', 0),
    ('COMMODITY', 'Commodity', 0);

-- Insert default member (MVP: single member)
INSERT OR IGNORE INTO members (member_code, member_name, profit_share_ratio, capital_division, is_active) VALUES
    ('PRIMARY', 'Primary Trader', 1.0, 30, 1);

-- Migration to fix trades table schema
-- Allow NULL values for sell_date and sell_price to support LIVE trades

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Step 1: Create new trades table with correct schema
CREATE TABLE IF NOT EXISTS trades_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    instrument_type_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    trade_number INTEGER,
    buy_date DATE,
    buy_price REAL NOT NULL,
    sell_date DATE,  -- NULLABLE for LIVE trades
    sell_price REAL,  -- NULLABLE for LIVE trades
    quantity INTEGER NOT NULL,
    brokerage REAL DEFAULT 0,  -- Default 0 for LIVE trades
    net_profit REAL DEFAULT 0,  -- Default 0 for LIVE trades
    notes TEXT,
    exchange TEXT DEFAULT 'NSE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (instrument_type_id) REFERENCES instrument_types(id)
);

-- Step 2: Copy data from old table to new table
INSERT INTO trades_new (
    id, member_id, instrument_type_id, symbol, trade_number, buy_date, buy_price,
    sell_date, sell_price, quantity, brokerage, net_profit, notes, exchange,
    created_at, updated_at
)
SELECT 
    id, member_id, instrument_type_id, symbol, trade_number, buy_date, buy_price,
    CASE WHEN sell_date = '' OR sell_date IS NULL THEN NULL ELSE sell_date END,
    CASE WHEN sell_price = 0 OR sell_price IS NULL THEN NULL ELSE sell_price END,
    quantity, brokerage, net_profit, notes, exchange, created_at, updated_at
FROM trades;

-- Step 3: Drop old table
DROP TABLE trades;

-- Step 4: Rename new table to trades
ALTER TABLE trades_new RENAME TO trades;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_trades_member ON trades(member_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(buy_date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

-- Verify the changes
SELECT 'Migration completed successfully. sell_date and sell_price are now nullable.' as status;

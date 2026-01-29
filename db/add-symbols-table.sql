-- Migration: Add symbols table for dynamic symbol management
-- This allows symbols to be stored in the database instead of hardcoded
-- Supports auto-adding new symbols from CSV imports and UI

-- Create symbols table
CREATE TABLE IF NOT EXISTS symbols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for case-insensitive symbol uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_upper ON symbols(UPPER(symbol));

-- Populate with existing 75 ETF symbols
INSERT OR IGNORE INTO symbols (symbol, category) VALUES
('ABSLPSE', 'Index'),
('ALPL30IETF', 'Factor'),
('ALPHA', 'Factor'),
('ALPHAETF', 'Factor'),
('AUTOBEES', 'Sectoral'),
('AUTOIETF', 'Sectoral'),
('BANKBEES', 'Sectoral'),
('BFSI', 'Sectoral'),
('BSE500IETF', 'Index'),
('COMMOIETF', 'Sectoral'),
('CONSUMBEES', 'Sectoral'),
('CPSEETF', 'Index'),
('DIVOPPBEES', 'Factor'),
('EMULTIMQ', 'Factor'),
('ESG', 'Thematic'),
('EVINDIA', 'Thematic'),
('FINIETF', 'Sectoral'),
('FMCGIETF', 'Sectoral'),
('GOLD360', 'Commodity'),
('GOLDBEES', 'Commodity'),
('HDFCGROWTH', 'Factor'),
('HDFCQUAL', 'Factor'),
('HDFCSML250', 'Size'),
('HEALTHY', 'Thematic'),
('HNGSNGBEES', 'International'),
('ICICIB22', 'Index'),
('INFRABEES', 'Sectoral'),
('INFRAIETF', 'Sectoral'),
('ITBEES', 'Sectoral'),
('JUNIORBEES', 'Index'),
('LOWVOLIETF', 'Factor'),
('MAFANG', 'International'),
('MAHKTECH', 'Thematic'),
('MAKEINDIA', 'Thematic'),
('MASPTOP50', 'International'),
('METALIETF', 'Sectoral'),
('MID150BEES', 'Size'),
('MIDCAP', 'Size'),
('MIDCAPETF', 'Size'),
('MIDQ50ADD', 'Factor'),
('MIDSELIETF', 'Factor'),
('MIDSMALL', 'Size'),
('MNC', 'Thematic'),
('MODEFENCE', 'Sectoral'),
('MOHEALTH', 'Sectoral'),
('MOM100', 'Factor'),
('MOM30IETF', 'Factor'),
('MOMENTUM50', 'Factor'),
('MON100', 'Index'),
('MONIFTY500', 'Index'),
('MONQ50', 'Index'),
('MOREALTY', 'Sectoral'),
('MOSMALL250', 'Size'),
('MOVALUE', 'Factor'),
('MULTICAP', 'Size'),
('NEXT50IETF', 'Index'),
('NIFTYBEES', 'Index'),
('NIFTYQLITY', 'Factor'),
('NV20IETF', 'Factor'),
('OILIETF', 'Sectoral'),
('PHARMABEES', 'Sectoral'),
('PSUBNKBEES', 'Sectoral'),
('PVTBANIETF', 'Sectoral'),
('SENSEXIETF', 'Index'),
('SHARIABEES', 'Thematic'),
('SILVERBEES', 'Commodity'),
('SMALLCAP', 'Size'),
('TNIDETF', 'Sectoral'),
('TOP100CASE', 'Index'),
('TOP10ADD', 'Factor'),
('UTISXN50', 'Index'),
('VAL30IETF', 'Factor');

-- Verify count
SELECT COUNT(*) as total_symbols FROM symbols;

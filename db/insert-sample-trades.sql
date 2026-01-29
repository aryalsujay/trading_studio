-- Insert 30 sample trades for pagination testing
-- Mix of LIVE and CLOSED trades with various symbols

-- First, get IDs we need
-- member_id = 1 (PRIMARY member)
-- instrument_type_id = 1 (DELIVERY_EQUITY)

-- CLOSED trades (20)
INSERT INTO trades (member_id, instrument_type_id, symbol, trade_number, buy_date, buy_price, sell_date, sell_price, quantity, brokerage, net_profit, notes, exchange)
VALUES 
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 1 FROM trades), '2026-01-15', 246.50, '2026-01-20', 252.30, 100, 49.88, 530.12, 'Profitable trade', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 2 FROM trades), '2026-01-14', 520.00, '2026-01-22', 518.40, 50, 51.92, -131.92, 'Small loss', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 3 FROM trades), '2026-01-13', 64.20, '2026-01-21', 65.80, 200, 26.00, 294.00, 'Gold rally', 'NSE'),
(1, 1, 'LIQUIDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 4 FROM trades), '2026-01-12', 1000.00, '2026-01-19', 1000.50, 10, 20.01, -15.01, 'Liquid fund', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 5 FROM trades), '2026-01-11', 48.30, '2026-01-23', 51.20, 150, 14.93, 419.57, 'IT sector gain', 'NSE'),
(1, 1, 'PHARMABEES', (SELECT COALESCE(MAX(trade_number), 0) + 6 FROM trades), '2026-01-10', 1350.00, '2026-01-24', 1420.00, 20, 55.40, 1344.60, 'Pharma bounce', 'NSE'),
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 7 FROM trades), '2026-01-09', 248.00, '2026-01-18', 245.50, 80, 39.48, -239.48, 'Stop loss hit', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 8 FROM trades), '2026-01-08', 515.50, '2026-01-25', 525.00, 40, 41.62, 337.38, 'Bank rally', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 9 FROM trades), '2026-01-07', 63.80, '2026-01-17', 64.50, 250, 32.08, 142.92, 'Safe haven', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 10 FROM trades), '2026-01-06', 49.00, '2026-01-16', 48.20, 120, 11.66, -107.66, 'Tech correction', 'NSE'),
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 11 FROM trades), '2026-01-05', 247.20, '2026-01-26', 250.80, 150, 74.70, 465.30, 'Index strength', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 12 FROM trades), '2026-01-04', 518.00, '2026-01-15', 522.50, 60, 62.43, 207.57, 'Banking up', 'NSE'),
(1, 1, 'PHARMABEES', (SELECT COALESCE(MAX(trade_number), 0) + 13 FROM trades), '2026-01-03', 1340.00, '2026-01-20', 1365.00, 15, 40.58, 334.42, 'Healthcare', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 14 FROM trades), '2026-01-02', 64.50, '2026-01-22', 63.90, 180, 23.11, -131.11, 'Gold dip', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 15 FROM trades), '2025-12-28', 47.80, '2026-01-14', 50.50, 200, 19.66, 520.34, 'Tech bounce', 'NSE'),
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 16 FROM trades), '2025-12-27', 246.00, '2026-01-12', 249.20, 90, 44.57, 243.43, 'Nifty up', 'NSE'),
(1, 1, 'LIQUIDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 17 FROM trades), '2025-12-26', 1000.00, '2026-01-13', 1000.30, 20, 40.01, -34.01, 'Parking funds', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 18 FROM trades), '2025-12-25', 516.50, '2026-01-11', 520.00, 70, 72.56, 172.44, 'Year end rally', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 19 FROM trades), '2025-12-24', 63.50, '2026-01-10', 64.80, 220, 28.23, 257.77, 'Festive season', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 20 FROM trades), '2025-12-23', 48.50, '2026-01-09', 49.80, 140, 13.76, 168.24, 'IT recovery', 'NSE');

-- LIVE trades (10) - NULL for sell_date and sell_price
INSERT INTO trades (member_id, instrument_type_id, symbol, trade_number, buy_date, buy_price, sell_date, sell_price, quantity, brokerage, net_profit, notes, exchange)
VALUES 
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 1 FROM trades), '2026-01-26', 251.00, NULL, NULL, 100, 0, 0, 'Current position', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 2 FROM trades), '2026-01-25', 523.00, NULL, NULL, 50, 0, 0, 'Banking sector', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 3 FROM trades), '2026-01-24', 65.00, NULL, NULL, 150, 0, 0, 'Long gold', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 4 FROM trades), '2026-01-23', 50.00, NULL, NULL, 180, 0, 0, 'IT accumulation', 'NSE'),
(1, 1, 'PHARMABEES', (SELECT COALESCE(MAX(trade_number), 0) + 5 FROM trades), '2026-01-22', 1380.00, NULL, NULL, 25, 0, 0, 'Healthcare hold', 'NSE'),
(1, 1, 'NIFTYBEES', (SELECT COALESCE(MAX(trade_number), 0) + 6 FROM trades), '2026-01-21', 249.50, NULL, NULL, 120, 0, 0, 'Averaging down', 'NSE'),
(1, 1, 'BANKBEES', (SELECT COALESCE(MAX(trade_number), 0) + 7 FROM trades), '2026-01-20', 521.00, NULL, NULL, 45, 0, 0, 'Bank position', 'NSE'),
(1, 1, 'LIQUIDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 8 FROM trades), '2026-01-19', 1000.00, NULL, NULL, 30, 0, 0, 'Cash parking', 'NSE'),
(1, 1, 'GOLDBEES', (SELECT COALESCE(MAX(trade_number), 0) + 9 FROM trades), '2026-01-18', 64.20, NULL, NULL, 200, 0, 0, 'Gold hedge', 'NSE'),
(1, 1, 'ITBEES', (SELECT COALESCE(MAX(trade_number), 0) + 10 FROM trades), '2026-01-17', 49.50, NULL, NULL, 160, 0, 0, 'Tech hold', 'NSE');

SELECT 'Successfully inserted 30 sample trades (20 closed, 10 live)' as status;

#!/usr/bin/env node
import Database from 'better-sqlite3';
import XLSX from 'xlsx';

const db = new Database('./db/trading.db');

console.log('📊 Importing trades from Excel JOURNAL sheet...\n');

// Get member IDs
const members = db.prepare('SELECT id, member_code FROM members WHERE member_code IN (?, ?, ?)').all('SA', 'SG', 'DS');
const memberMap = Object.fromEntries(members.map(m => [m.member_code, m.id]));

console.log('Member mapping:', memberMap);

try {
  const workbook = XLSX.readFile('./ETF_2026.xlsx');
  const journalSheet = workbook.Sheets['JOURNAL'];
  const journalData = XLSX.utils.sheet_to_json(journalSheet, { header: 1, defval: null });

  // Find header row (contains "Trade No.")
  let headerRowIndex = -1;
  for (let i = 0; i < 20; i++) {
    if (journalData[i] && journalData[i].some(cell => cell === 'Trade No.')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('❌ Could not find header row with "Trade No."');
    process.exit(1);
  }

  console.log(`Found header at row ${headerRowIndex}`);
  const headers = journalData[headerRowIndex];
  console.log('Headers:', headers);

  // Find column indices
  const colMap = {
    tradeNo: headers.indexOf('Trade No.'),
    script: headers.indexOf('Script'),
    entryDate: headers.indexOf('Entry Date'),
    entryPrice: headers.indexOf('Entry Price'),
    totalQty: headers.indexOf('Total Qty'),
    saQty: headers.findIndex(h => h && typeof h === 'string' && h.includes('SA') && h.includes('Qty')),
    sgQty: headers.findIndex(h => h && typeof h === 'string' && h.includes('SG') && h.includes('Qty')),
    dsQty: headers.findIndex(h => h && typeof h === 'string' && h.includes('DS') && h.includes('Qty')),
    exitPrice: headers.indexOf('Exit Price'),
    exitDate: headers.indexOf('Exit Date'),
    saNetProfit: headers.findIndex(h => h && typeof h === 'string' && h.includes('SA Net Profit')),
    sgNetProfit: headers.findIndex(h => h && typeof h === 'string' && h.includes('SG Net Profit')),
    dsNetProfit: headers.findIndex(h => h && typeof h === 'string' && h.includes('DS Net Profit')),
  };

  console.log('Column mapping:', colMap);
  console.log('\nProcessing trades...\n');

  const insertTrade = db.prepare(`
    INSERT INTO trades (
      member_id, symbol, buy_price, sell_price, quantity,
      buy_date, sell_date, exchange, brokerage, net_profit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  // Process data rows
  for (let i = headerRowIndex + 1; i < journalData.length; i++) {
    const row = journalData[i];
    if (!row || !row[colMap.tradeNo]) continue;

    const exitPrice = row[colMap.exitPrice];

    // Skip LIVE trades
    if (exitPrice === 'LIVE' || !exitPrice || exitPrice === '') {
      skipped++;
      continue;
    }

    const symbol = row[colMap.script];
    const entryPrice = parseFloat(row[colMap.entryPrice]);
    const sellPrice = parseFloat(exitPrice);
    const entryDate = excelDateToISO(row[colMap.entryDate]);
    const exitDate = excelDateToISO(row[colMap.exitDate]);
    const exchange = 'NSE'; // Default to NSE, can be updated later

    // Import for each member with their quantities
    const memberTrades = [
      { code: 'SA', qty: row[colMap.saQty], netProfit: row[colMap.saNetProfit] },
      { code: 'SG', qty: row[colMap.sgQty], netProfit: row[colMap.sgNetProfit] },
      { code: 'DS', qty: row[colMap.dsQty], netProfit: row[colMap.dsNetProfit] },
    ];

    for (const memberTrade of memberTrades) {
      const qty = parseInt(memberTrade.qty);
      if (!qty || qty === 0) continue;

      const netProfit = parseFloat(memberTrade.netProfit) || 0;

      // Calculate brokerage (approx) as: gross profit - net profit
      const grossProfit = (sellPrice - entryPrice) * qty;
      const brokerage = Math.max(0, grossProfit - netProfit);

      try {
        insertTrade.run(
          memberMap[memberTrade.code],
          symbol,
          entryPrice,
          sellPrice,
          qty,
          entryDate,
          exitDate,
          exchange,
          brokerage,
          netProfit
        );
        imported++;
        console.log(`✅ ${symbol} - ${memberTrade.code}: ${qty} @ ${entryPrice} → ${sellPrice} (P/L: ${netProfit.toFixed(2)})`);
      } catch (err) {
        console.error(`❌ Error importing ${symbol} for ${memberTrade.code}:`, err.message);
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`Imported: ${imported} trade records`);
  console.log(`Skipped: ${skipped} LIVE trades`);

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}

// Helper function to convert Excel date to ISO format
function excelDateToISO(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;

  // Excel date is days since 1900-01-01
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

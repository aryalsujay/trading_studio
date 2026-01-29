#!/usr/bin/env node
import XLSX from 'xlsx';

console.log('📊 Analyzing Excel structure...\n');

try {
    const workbook = XLSX.readFile('./ETF_2026.xlsx');

    // Analyze ENTRY sheet
    console.log('=== ENTRY SHEET ===');
    const entrySheet = workbook.Sheets['ENTRY'];
    const entryData = XLSX.utils.sheet_to_json(entrySheet, { header: 1, defval: '' });

    // Find the actual header row
    for (let i = 0; i < Math.min(10, entryData.length); i++) {
        if (entryData[i].some(cell => cell)) {
            console.log(`Row ${i}:`, entryData[i]);
        }
    }

    console.log('\n=== JOURNAL SHEET ===');
    const journalSheet = workbook.Sheets['JOURNAL'];
    const journalData = XLSX.utils.sheet_to_json(journalSheet, { header: 1, defval: '' });

    // Find actual header row in JOURNAL
    for (let i = 0; i < Math.min(15, journalData.length); i++) {
        if (journalData[i].some(cell => cell && String(cell).includes('Date') || String(cell).includes('Symbol'))) {
            console.log(`Row ${i} (potential header):`, journalData[i]);
        }
    }

    console.log('\n✅ Done. Please review the structure above.');

} catch (error) {
    console.error('❌ Error:', error.message);
}

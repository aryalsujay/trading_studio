import csv from 'csv-parser';
import { Readable } from 'stream';

const csvContent = `Trade #,Symbol,Entry Date,Entry Price,Quantity,Exit Date,Exit Price,Notes,Member,Div DS,Div SA,Div SG
1,RELIANCE,2025-01-01,2500,10,2025-01-10,2600,Sample Trade,DS,36,35,30
2,INFY,2025-01-02,1500,20,,,Split Trade,DS,SA,36,35,30
3,HDFCBANK,2025-01-03,1600,100,,,Auto Split,ALL,36,35,30
4,TCS,2025-01-04,3800,5,,,Default Personal,,36,35,30`;

const results = [];
const stream = Readable.from(csvContent);

console.log("Starting parse...");

stream
    .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
    }))
    .on('data', (data) => {
        console.log("Row:", data);
        results.push(data);
    })
    .on('end', () => {
        console.log(`Parsed ${results.length} rows.`);
        if (results.length > 0) {
            const row = results[0];
            console.log("First Row Keys:", Object.keys(row));

            // Simulating validation logic
            const symbol = row.Symbol || row.symbol || row.SYMBOL;
            const rawQty = row.Quantity || row.quantity || row.qty;
            const rawPrice = row['Entry Price'] || row['Entry Price '] || row.price;

            console.log(`Validation Check: Symbol=${symbol}, Qty=${rawQty}, Price=${rawPrice}`);
            if (!symbol || !rawQty || !rawPrice) {
                console.log("❌ Validation FAILED for first row");
            } else {
                console.log("✅ Validation PASSED for first row");
            }
        }
    });

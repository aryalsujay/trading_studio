
// Mock calculateNetProfit
function calculateNetProfit(bp, sp, qty) {
    const gross = (sp - bp) * qty;
    const brokerage = sp ? (bp + sp) * qty * 0.001 : 0;
    return { brokerage, netProfit: gross - brokerage };
}

const members = [
    { id: 1, member_code: 'DS', currentCapital: 3000000, division: 36 },
    { id: 2, member_code: 'SA', currentCapital: 700000, division: 35 },
    { id: 3, member_code: 'SG', currentCapital: 300000, division: 30 }
];

const quantity = 100;

// 1. Calculate Scores
let totalScore = 0;
const memberScores = members.map(m => {
    const division = m.division;
    const score = m.currentCapital / division;
    totalScore += score;
    return { ...m, score };
});

console.log('Total Score:', totalScore);

// 2. Calculate Allocations
const allocations = memberScores.map(m => {
    const weight = m.score / totalScore;
    const allocatedQty = quantity * weight;
    return { ...m, weight, allocatedQty };
});

console.log('Allocations for 100 Qty:');
allocations.forEach(a => {
    console.log(`${a.member_code} (Div ${a.division}): Weight ${a.weight.toFixed(4)} => Qty: ${a.allocatedQty.toFixed(4)}`);
});

const sumQty = allocations.reduce((sum, a) => sum + a.allocatedQty, 0);
console.log('Sum Qty:', sumQty);

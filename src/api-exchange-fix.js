export async function calculateBrokerage(buyPrice, sellPrice, quantity, exchange = 'NSE') {
    const response = await fetch(`${API_BASE}/calculate-brokerage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buy_price: buyPrice, sell_price: sellPrice, quantity, exchange }),
    });
    if (!response.ok) throw new Error('Failed to calculate brokerage');
    return response.json();
}

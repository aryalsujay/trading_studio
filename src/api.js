const API_BASE = '/api';

export async function fetchMembers() {
    const response = await fetch(`${API_BASE}/members`);
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
}

export async function deleteMember(id) {
    const response = await fetch(`${API_BASE}/members/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete member');
    }
    return response.json();
}

export async function fetchProfitSummary(memberId = null) {
    const url = memberId ? `${API_BASE}/profit-summary?member_id=${memberId}` : `${API_BASE}/profit-summary`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch profit summary');
    return response.json();
}

export async function fetchDashboardStats(memberId = null) {
    const url = memberId ? `${API_BASE}/dashboard-stats?member_id=${memberId}` : `${API_BASE}/dashboard-stats`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch dashboard stats');
    return response.json();
}

export async function fetchTrades(filters = {}) {
    const params = new URLSearchParams();
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.profit_only !== undefined) params.append('profit_only', filters.profit_only);
    if (filters.member_id) params.append('member_id', filters.member_id);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(`${API_BASE}/trades?${params}`);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return response.json();
}

export async function createTrade(tradeData) {
    const response = await fetch(`${API_BASE}/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
    });
    if (!response.ok) throw new Error('Failed to create trade');
    return response.json();
}

export async function createSplitTrade(tradeData) {
    const response = await fetch(`${API_BASE}/trades/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
    });
    if (!response.ok) throw new Error('Failed to create split trade');
    return response.json();
}

export async function updateTrade(id, tradeData) {
    const response = await fetch(`${API_BASE}/trades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
    });
    if (!response.ok) throw new Error('Failed to update trade');
    return response.json();
}

export async function deleteTrade(id) {
    const response = await fetch(`${API_BASE}/trades/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete trade');
    return response.json();
}

export async function bulkDeleteTrades(ids) {
    const response = await fetch(`${API_BASE}/trades/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error('Failed to bulk delete trades');
    return response.json();
}

export async function fetchCapitalTransactions(memberId = null) {
    const url = memberId ? `${API_BASE}/capital-transactions?member_id=${memberId}` : `${API_BASE}/capital-transactions`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch capital transactions');
    return response.json();
}

export async function createCapitalTransaction(data) {
    const response = await fetch(`${API_BASE}/capital-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create capital transaction');
    return response.json();
}

export async function updateCapitalTransaction(id, data) {
    const response = await fetch(`${API_BASE}/capital-transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update capital transaction');
    return response.json();
}

export async function deleteCapitalTransaction(id) {
    const response = await fetch(`${API_BASE}/capital-transactions/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete capital transaction');
    return response.json();
}

export async function calculateBrokerage(buyPrice, sellPrice, quantity, exchange = 'NSE') {
    const response = await fetch(`${API_BASE}/calculate-brokerage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buy_price: buyPrice, sell_price: sellPrice, quantity, exchange }),
    });
    if (!response.ok) throw new Error('Failed to calculate brokerage');
    return response.json();
}

export async function fetchSymbols() {
    const response = await fetch(`${API_BASE}/symbols`);
    if (!response.ok) throw new Error('Failed to fetch symbols');
    return response.json();
}

export async function createSymbol(data) {
    const response = await fetch(`${API_BASE}/symbols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create symbol');
    return response.json();
}

// ===== MARKETS MODULE API =====

export async function fetchEtfData() {
    const response = await fetch(`${API_BASE}/etfs`);
    if (!response.ok) throw new Error('Failed to fetch ETFs');
    return response.json();
}

export async function refreshEtfData() {
    const response = await fetch(`${API_BASE}/etfs/refresh`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to refresh ETFs');
    return response.json();
}

export async function fetchFiiDiiData() {
    const response = await fetch(`${API_BASE}/fii-dii`);
    if (!response.ok) throw new Error('Failed to fetch FII/DII Data');
    return response.json();
}

export async function refreshFiiDiiData() {
    const response = await fetch(`${API_BASE}/fii-dii/refresh`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to refresh FII/DII Data');
    return response.json();
}

export async function getAppSetting(key) {
    const response = await fetch(`${API_BASE}/settings/${key}`);
    if (!response.ok) throw new Error(`Failed to fetch setting ${key}`);
    return response.json();
}

export async function updateAppSetting(key, value) {
    const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
    });
    if (!response.ok) throw new Error(`Failed to update setting ${key}`);
    return response.json();
}

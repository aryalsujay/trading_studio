import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchTrades, createTrade, createSplitTrade, updateTrade, deleteTrade, bulkDeleteTrades, fetchDashboardStats } from '../api';
import { formatCurrency, formatDate, formatNumber } from '../utils';

import TradeModal from './TradeModal';
import ConfirmationModal from './ConfirmationModal';
import { useMembers } from '../contexts/MemberContext';

// Helper functions
function getTradeMetrics(trade) {
    const investment = trade.buy_price * trade.quantity;
    const turnover = trade.sell_price ? trade.sell_price * trade.quantity : 0;
    const grossProfit = trade.sell_price ? (trade.sell_price - trade.buy_price) * trade.quantity : 0;
    const profitPercent = trade.sell_price ? (grossProfit / investment) * 100 : 0;
    return { investment, turnover, grossProfit, profitPercent };
}



// Extracted TradeRow Component
const TradeRow = ({
    trade,
    isChild = false,
    expandedGroups,
    selectedTradeIds,
    onToggleSelect,
    onToggleExpand,
    onEdit,
    onDelete,
    onDeleteGroup
}) => {
    const metrics = getTradeMetrics(trade);
    const isLive = !trade.sell_price;
    const isGroup = trade.isGroup;
    const isExpanded = expandedGroups.has(trade.key);

    const isSelected = isGroup
        ? trade.children.every(c => selectedTradeIds.has(c.id))
        : selectedTradeIds.has(trade.id);

    // Group rows have special styling
    const rowStyle = isGroup ? { backgroundColor: 'var(--color-bg-secondary)', fontWeight: '500' } :
        isChild ? { backgroundColor: 'var(--color-bg-card)', fontSize: '0.9em' } : {};

    return (
        <>
            <tr style={{ opacity: isLive ? 0.8 : 1, ...rowStyle }}>
                <td style={{ paddingLeft: isChild ? '2rem' : '1rem' }}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(trade)}
                    />
                </td>
                <td>
                    <div className="flex" style={{ gap: '0.5rem', alignItems: 'center' }}>
                        {isGroup && (
                            <button
                                className="btn-icon"
                                onClick={() => onToggleExpand(trade.key)}
                                style={{ padding: 0, width: '20px', height: '20px', fontSize: '12px' }}
                            >
                                {isExpanded ? '▼' : '▶'}
                            </button>
                        )}
                        {(trade.trade_number || trade.id)}
                    </div>
                </td>
                <td>
                    {isGroup ? (
                        <span className="badge badge-primary">Split ({trade.children.length})</span>
                    ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            {trade.member_name}
                        </span>
                    )}
                </td>
                <td>
                    <strong>{trade.symbol}</strong>
                    {isLive && <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.7em' }}>LIVE</span>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(trade.buy_date)}</td>
                <td>{formatCurrency(trade.buy_price)}</td>
                <td>{formatNumber(trade.quantity)}</td>
                <td>{formatCurrency(metrics.investment)}</td>
                <td>{isLive ? '—' : formatCurrency(trade.sell_price)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{isLive ? '—' : formatDate(trade.sell_date)}</td>
                <td>{isLive ? '—' : formatCurrency(metrics.turnover)}</td>
                <td style={{ color: metrics.grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {isLive ? '—' : formatCurrency(metrics.grossProfit)}
                </td>
                <td style={{ color: metrics.profitPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {isLive ? '—' : `${metrics.profitPercent.toFixed(2)}%`}
                </td>
                <td style={{ color: 'var(--color-warning)' }}>
                    {isLive ? '—' : formatCurrency(trade.brokerage)}
                </td>
                <td>
                    {isLive ? '—' : (
                        <span className={trade.net_profit >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                            {formatCurrency(trade.net_profit)}
                        </span>
                    )}
                </td>
                <td>
                    <span className={isLive ? 'badge badge-warning' : 'badge badge-secondary'}>
                        {isLive ? '🟢 LIVE' : 'CLOSED'}
                    </span>
                </td>
                <td>
                    <div className="flex" style={{ gap: '0.5rem' }}>
                        {isGroup ? (
                            <button
                                onClick={(e) => onDeleteGroup(e, trade)}
                                className="btn btn-danger btn-sm"
                            >
                                Delete Group
                            </button>
                        ) : (
                            <>
                                <button onClick={(e) => onEdit(e, trade)} className="btn btn-secondary btn-sm">
                                    {isLive ? 'Exit' : 'Edit'}
                                </button>
                                <button onClick={(e) => onDelete(e, trade.id)} className="btn btn-danger btn-sm">
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
            {isGroup && isExpanded && trade.children.map(child => (
                <TradeRow
                    key={child.id}
                    trade={child}
                    isChild={true}
                    expandedGroups={expandedGroups}
                    selectedTradeIds={selectedTradeIds}
                    onToggleSelect={onToggleSelect}
                    onToggleExpand={onToggleExpand}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDeleteGroup={onDeleteGroup}
                />
            ))}
        </>
    );
};

export default function TradesPage() {
    const [trades, setTrades] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTrade, setEditingTrade] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        isDangerous: false,
        onConfirm: () => { }
    });

    const initialFilters = {
        symbol: '',
        start_date: '',
        end_date: '',
        profit_only: undefined,
        status: 'all', // all, live, closed
    };

    // Filters that trigger API calls
    const [filters, setFilters] = useState(initialFilters);

    // Local filter state for immediate UI updates
    const [localFilters, setLocalFilters] = useState(filters);

    // Debounce filter updates to avoid excessive API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters(localFilters);
        }, 500); // Wait 500ms after last keystroke

        return () => clearTimeout(timer);
    }, [localFilters]);

    const clearFilters = () => {
        setLocalFilters(initialFilters);
        setFilters(initialFilters);
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const tradesPerPage = 30;

    // Bulk delete state
    const [selectedTradeIds, setSelectedTradeIds] = useState(new Set());

    // Sorting state
    const [sortBy, setSortBy] = useState('buy_date'); // 'trade_number' or 'buy_date'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

    const { members, selectedMember, setSelectedMember } = useMembers();
    const isMainView = !selectedMember; // True if "All Members" is selected

    useEffect(() => {
        loadData();
    }, [filters, selectedMember]); // Reload when filters or selectedMember changes

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const apiFilters = { ...filters, member_id: selectedMember };
            const [tradesData, statsData] = await Promise.all([
                fetchTrades(apiFilters),
                fetchDashboardStats(selectedMember)
            ]);
            setTrades(tradesData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }, [filters, selectedMember]);

    // Memoize callbacks
    const handleAddTrade = useCallback((e) => {
        if (e) e.stopPropagation();
        setEditingTrade(null);
        setShowModal(true);
    }, []);

    const handleEditTrade = useCallback((e, trade) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setEditingTrade(trade);
        setShowModal(true);
    }, []);

    const handleDeleteTrade = useCallback((e, id) => {
        e.stopPropagation();

        setConfirmation({
            isOpen: true,
            title: 'Delete Trade',
            message: 'Are you sure you want to delete this trade? This action cannot be undone.',
            confirmLabel: 'Delete',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    await deleteTrade(id);
                    await loadData();
                } catch (error) {
                    alert('Failed to delete trade: ' + error.message);
                }
            }
        });
    }, [loadData]);

    const handleDeleteGroup = useCallback((e, trade) => {
        e.stopPropagation();

        setConfirmation({
            isOpen: true,
            title: 'Delete Split Trade Group',
            message: `Are you sure you want to delete the entire split trade group #${trade.trade_number}? All ${trade.children.length} associated trades will be permanently deleted.`,
            confirmLabel: 'Delete Group',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    await bulkDeleteTrades(trade.children.map(c => c.id));
                    await loadData();
                } catch (error) {
                    alert('Failed to delete group: ' + error.message);
                }
            }
        });
    }, [loadData]);

    const handleSaveTrade = useCallback(async (tradeData) => {
        try {
            if (editingTrade) {
                await updateTrade(editingTrade.id, tradeData);
            } else if (tradeData.isSplit) {
                await createSplitTrade(tradeData);
            } else {
                await createTrade(tradeData);
            }
            setShowModal(false);
            await loadData();
        } catch (error) {
            alert('Failed to save trade: ' + error.message);
        }
    }, [editingTrade, loadData]);

    const handleToggleExpand = (tradeNum) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(tradeNum)) next.delete(tradeNum);
            else next.add(tradeNum);
            return next;
        });
    };

    // Sorting logic
    const sortedTrades = useMemo(() => {
        return [...trades].sort((a, b) => {
            let compareValue = 0;
            if (sortBy === 'trade_number') {
                compareValue = (a.trade_number || a.id) - (b.trade_number || b.id);
            } else if (sortBy === 'buy_date') {
                compareValue = new Date(a.buy_date) - new Date(b.buy_date);
            }
            return sortOrder === 'asc' ? compareValue : -compareValue;
        });
    }, [trades, sortBy, sortOrder]);

    // Grouping Logic for "All Members" View
    const displayItems = useMemo(() => {
        if (!isMainView) return sortedTrades;

        // Group by trade_number
        const groups = new Map();
        const singleTrades = [];

        // We process strict sorting order, merging adjacent items if grouping strategy allows,
        // BUT strict 'trade_number' grouping is safer for data integrity.
        // Let's use a two-pass approach: 
        // 1. Group key -> list.
        // 2. Determine order based on the FIRST appearance in sortedTrades (to maintain sort).

        sortedTrades.forEach(trade => {
            const num = trade.trade_number;
            if (num) {
                if (!groups.has(num)) groups.set(num, []);
                groups.get(num).push(trade);
            } else {
                // Trades without numbers treated as singles? (Legacy data?)
                // Just use ID as fallback group
                const key = `id-${trade.id}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(trade);
            }
        });

        // Reconstruct list preserving sort order
        // We only want to add a group ONCE, at the position of its first member
        const seenKeys = new Set();
        const items = [];

        sortedTrades.forEach(trade => {
            const key = trade.trade_number || `id-${trade.id}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            const group = groups.get(key);
            if (group.length > 1) {
                // Create Aggregate Parent
                const parent = {
                    isGroup: true,
                    key,
                    trade_number: trade.trade_number,
                    children: group,
                    // Aggregated metrics
                    symbol: group[0].symbol,
                    buy_date: group[0].buy_date,
                    sell_date: group.every(t => t.sell_date) ? group[0].sell_date : (group.some(t => t.sell_date) ? 'Mixed' : null),
                    buy_price: group[0].buy_price, // Assuming split trades share price
                    sell_price: group[0].sell_price, // Assuming split trades share price
                    quantity: group.reduce((sum, t) => sum + t.quantity, 0),
                    brokerage: group.reduce((sum, t) => sum + t.brokerage, 0),
                    net_profit: group.reduce((sum, t) => sum + t.net_profit, 0),
                    member_name: 'Split', // Special label
                    exchange: group[0].exchange
                };
                items.push(parent);
            } else {
                items.push(group[0]);
            }
        });

        return items;
    }, [sortedTrades, isMainView]);

    // Pagination
    const paginationData = useMemo(() => {
        const totalItems = displayItems.length;
        const totalPages = Math.ceil(totalItems / tradesPerPage);
        const startIndex = (currentPage - 1) * tradesPerPage;
        const endIndex = Math.min(startIndex + tradesPerPage, totalItems);
        const currentItems = displayItems.slice(startIndex, endIndex);

        return { totalItems, totalPages, startIndex, endIndex, currentItems };
    }, [displayItems, currentPage, tradesPerPage]);

    const { totalItems, totalPages, startIndex, endIndex, currentItems } = paginationData;

    // Selection Logic for Groups
    const handleToggleSelect = (item) => {
        if (item.isGroup) {
            // Select all children
            const childIds = item.children.map(c => c.id);
            const allSelected = childIds.every(id => selectedTradeIds.has(id));

            setSelectedTradeIds(prev => {
                const next = new Set(prev);
                childIds.forEach(id => {
                    if (allSelected) next.delete(id);
                    else next.add(id);
                });
                return next;
            });
        } else {
            setSelectedTradeIds(prev => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
            });
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = [];
            currentItems.forEach(item => {
                if (item.isGroup) allIds.push(...item.children.map(c => c.id));
                else allIds.push(item.id);
            });
            setSelectedTradeIds(new Set(allIds));
        } else {
            setSelectedTradeIds(new Set());
        }
    };

    const handleBulkDelete = () => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Selected Trades',
            message: `Are you sure you want to delete ${selectedTradeIds.size} selected trade(s)? This action cannot be undone.`,
            confirmLabel: `Delete ${selectedTradeIds.size} Trades`,
            isDangerous: true,
            onConfirm: async () => {
                try {
                    await bulkDeleteTrades(Array.from(selectedTradeIds));
                    setSelectedTradeIds(new Set());
                    // Clear select all header check indirectly via data reload if needed, or manual:
                    // But re-render handles it.
                    await loadData();
                } catch (error) {
                    alert('Failed: ' + error.message);
                }
            }
        });
    };

    // Export Helpers
    async function handleExportCSV() { /* ... existing code ... */
        try {
            const response = await fetch('http://localhost:3000/api/trades/export');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert('Failed to export CSV: ' + error.message);
        }
    }

    function handleImportCSV() { /* ... existing code ... */
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('http://localhost:3000/api/trades/import', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();

                if (response.ok) {
                    alert(`Import successful!\nAdded: ${result.success} trades\nFailed: ${result.failed} trades`);
                    await loadData();
                } else {
                    alert('Import failed: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Failed to import CSV: ' + error.message);
            }
        };
        input.click();
    }





    function PaginationControls() {
        if (totalItems === 0) return null;
        return (
            <div className="flex" style={{ gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Showing {startIndex + 1}-{endIndex} of {totalItems} items
                </div>
                {totalPages > 1 && (
                    <div className="flex" style={{ gap: '0.25rem' }}>
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn btn-secondary btn-sm">« First</button>
                        <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="btn btn-secondary btn-sm">‹ Prev</button>
                        <span style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center' }}>Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="btn btn-secondary btn-sm">Next ›</button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="btn btn-secondary btn-sm">Last »</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="page container fade-in">
            {/* Header */}
            <div className="flex-between mb-4">
                <h1>Trades Management</h1>
                <div className="flex" style={{ gap: '0.75rem' }}>
                    <a href="/import-template.csv" download className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                        📄 Download Template
                    </a>
                    <button onClick={handleImportCSV} className="btn btn-secondary">
                        📁 Import CSV
                    </button>
                    <button onClick={handleExportCSV} className="btn btn-secondary">
                        📥 Export CSV
                    </button>
                    <button onClick={handleAddTrade} className="btn btn-primary">
                        + Add Trade
                    </button>
                </div>
            </div>

            {/* Stats Cards ... (Keep existing simple for brevity or re-implement if needed, omitting for simple replacement flow to keep tokens low, assuming context has stats) */}
            {/* Enhanced Summary Stats */}
            {stats && (
                <div className="grid grid-4 mb-4">
                    <div className="summary-card" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}>
                        <div className="summary-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Capital & Gain</div>
                        <div className="summary-value" style={{ color: 'white', fontSize: '1.25rem' }}>
                            {formatCurrency(stats.total_capital || 0)}
                            <span style={{ fontSize: '0.8em', marginLeft: '10px', opacity: 0.9 }}>
                                ({stats.total_gain_percent}%)
                            </span>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Net Profit</div>
                        <div className="summary-value" style={{ color: stats.total_net_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {formatCurrency(stats.total_net_profit)}
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Win Rate</div>
                        <div className="summary-value" style={{ fontSize: '1.2rem' }}>
                            {stats.win_rate}%
                            <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                                (W: {stats.winning_trades} / L: {stats.losing_trades})
                            </span>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-label">Total Brokerage</div>
                        <div className="summary-value" style={{ color: 'var(--color-warning)' }}>
                            {formatCurrency(stats.total_brokerage || 0)}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card mb-4">
                <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-md)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Symbol</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search symbol..."
                            value={localFilters.symbol}
                            onChange={(e) => setLocalFilters({ ...localFilters, symbol: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Start Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={localFilters.start_date}
                            onChange={(e) => setLocalFilters({ ...localFilters, start_date: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">End Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={localFilters.end_date}
                            onChange={(e) => setLocalFilters({ ...localFilters, end_date: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Filter</label>
                        <select
                            className="form-select"
                            value={localFilters.profit_only === undefined ? '' : localFilters.profit_only}
                            onChange={(e) => setLocalFilters({
                                ...localFilters,
                                profit_only: e.target.value === '' ? undefined : e.target.value === 'true'
                            })}
                        >
                            <option value="">All Trades</option>
                            <option value="true">Profitable Only</option>
                            <option value="false">Losses Only</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Status</label>
                        <select
                            className="form-select"
                            value={localFilters.status}
                            onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                        >
                            <option value="all">All Trades</option>
                            <option value="live">🟢 Live</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
                <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select
                            className="form-select"
                            value={selectedMember || ''}
                            onChange={(e) => setSelectedMember(e.target.value ? parseInt(e.target.value) : null)}
                            style={{ width: 'auto', minWidth: '150px' }}
                        >
                            <option value="">👤 All Members</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>👤 {m.member_name}</option>
                            ))}
                        </select>
                        <button onClick={clearFilters} className="btn btn-secondary btn-sm">
                            Clear Filters
                        </button>
                    </div>
                    {selectedTradeIds.size > 0 && (
                        <>
                            <button
                                onClick={() => {
                                    // For bulk edit, open the first selected trade for editing
                                    const firstId = Array.from(selectedTradeIds)[0];
                                    const firstTrade = trades.find(t => t.id === firstId);
                                    if (firstTrade) {
                                        handleEditTrade(null, firstTrade);
                                    }
                                }}
                                className="btn btn-primary btn-sm"
                            >
                                ✏️ Edit Selected ({selectedTradeIds.size})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="btn btn-danger btn-sm"
                            >
                                🗑️ Delete Selected ({selectedTradeIds.size})
                            </button>
                        </>
                    )}
                </div>
            </div>


            <div className="card">
                <PaginationControls />
                {loading ? <p>Loading...</p> : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>
                                        <input type="checkbox" onChange={handleSelectAll} checked={currentItems.length > 0 && selectedTradeIds.size > 0} />
                                    </th>
                                    <th onClick={() => { setSortBy('trade_number'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                                        Trade # {sortBy === 'trade_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th>Member</th>
                                    <th>Symbol</th>
                                    <th onClick={() => { setSortBy('buy_date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                                        Date {sortBy === 'buy_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th>Price</th>
                                    <th>Qty</th>
                                    <th>Inv.</th>
                                    <th>Exit Price</th>
                                    <th>Exit Date</th>
                                    <th>Turnover</th>
                                    <th>Gross P/L</th>
                                    <th>%</th>
                                    <th>Brokerage</th>
                                    <th>Net P/L</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map(item => (
                                    <TradeRow
                                        key={item.key || item.id}
                                        trade={item}
                                        expandedGroups={expandedGroups}
                                        selectedTradeIds={selectedTradeIds}
                                        onToggleSelect={handleToggleSelect}
                                        onToggleExpand={handleToggleExpand}
                                        onEdit={handleEditTrade}
                                        onDelete={handleDeleteTrade}
                                        onDeleteGroup={handleDeleteGroup}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <PaginationControls />
            </div>

            {showModal && <TradeModal trade={editingTrade} onSave={handleSaveTrade} onClose={() => setShowModal(false)} />}

            <ConfirmationModal
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                confirmLabel={confirmation.confirmLabel}
                isDangerous={confirmation.isDangerous}
            />
        </div>
    );
}

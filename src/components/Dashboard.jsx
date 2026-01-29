import { useState, useEffect } from 'react';
import { fetchProfitSummary, fetchDashboardStats } from '../api';
import { formatCurrency, formatDate, formatPercent } from '../utils';
import { useMembers } from '../contexts/MemberContext';

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { members, selectedMember, setSelectedMember } = useMembers();

    useEffect(() => {
        loadData();
    }, [selectedMember]);

    async function loadData() {
        try {
            setLoading(true);
            const [summaryData, statsData] = await Promise.all([
                fetchProfitSummary(selectedMember),
                fetchDashboardStats(selectedMember),
            ]);
            setSummary(summaryData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="page container">
                <div className="text-center">
                    <h2>Loading dashboard...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="page container fade-in">
            <div className="flex-between mb-4">
                <h1>Trading Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Member:</label>
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
                </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-4 mb-4">
                <div className="stat-card">
                    <div className="stat-label">Total Capital</div>
                    <div className="stat-value">{formatCurrency(summary?.total_capital || 0)}</div>
                </div>
                <div className="stat-card">
                    <div className={`stat-value ${summary?.total_profit >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(summary?.total_profit || 0)}
                    </div>
                    <div className="stat-label">Total Profit/Loss</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{formatCurrency(summary?.available_withdrawal || 0)}</div>
                    <div className="stat-label">Available Withdrawal</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{summary?.total_trades || 0}</div>
                    <div className="stat-label">Total Trades</div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-3 mb-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Win Rate</h3>
                    </div>
                    <div className="text-center">
                        <div className={`stat-value ${summary?.win_rate >= 50 ? 'positive' : ''}`}>
                            {summary?.win_rate || 0}%
                        </div>
                        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {summary?.winning_trades || 0} wins / {summary?.losing_trades || 0} losses
                        </p>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Total Brokerage</h3>
                    </div>
                    <div className="text-center">
                        <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                            {formatCurrency(summary?.total_brokerage || 0)}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">P&L Breakdown</h3>
                    </div>
                    <div>
                        <div className="flex-between mb-2">
                            <span>Gains:</span>
                            <span className="positive">{formatCurrency(summary?.total_gains || 0)}</span>
                        </div>
                        <div className="flex-between">
                            <span>Losses:</span>
                            <span className="negative">{formatCurrency(summary?.total_losses || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Symbols */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Top Performing Symbols</h3>
                </div>
                {stats?.top_symbols?.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Trades</th>
                                    <th>Total Profit</th>
                                    <th>Avg Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.top_symbols.map((symbol, idx) => (
                                    <tr key={idx}>
                                        <td><strong>{symbol.symbol}</strong></td>
                                        <td>{symbol.trade_count}</td>
                                        <td className={symbol.total_profit >= 0 ? 'positive' : 'negative'}>
                                            {formatCurrency(symbol.total_profit)}
                                        </td>
                                        <td className={symbol.avg_profit >= 0 ? 'positive' : 'negative'}>
                                            {formatCurrency(symbol.avg_profit)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: 'var(--color-text-secondary)' }}>No data available</p>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useMembers } from '../contexts/MemberContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

const COLORS = {
    success: '#10b981',
    danger: '#ef4444',
    text: '#e4e7eb',
    textSecondary: '#9ca3b5',
    bgSecondary: '#13182E',
    border: '#2a3152',
    primary: '#6366f1'
};

function AnalyticsPage() {
    const { selectedMember, setSelectedMember, members } = useMembers();
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [growthData, setGrowthData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [timeRange, setTimeRange] = useState('ALL');

    useEffect(() => {
        fetchData();
    }, [selectedMember]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const memberQuery = selectedMember ? `?member_id=${selectedMember.id}` : '';

            const [monthlyRes, growthRes] = await Promise.all([
                fetch(`http://localhost:3000/api/analytics/monthly-performance${memberQuery}`),
                fetch(`http://localhost:3000/api/analytics/capital-growth${memberQuery}`)
            ]);

            if (!monthlyRes.ok || !growthRes.ok) throw new Error('Failed to fetch analytics data');

            const monthly = await monthlyRes.json();
            const growth = await growthRes.json();

            setMonthlyStats(monthly);
            setGrowthData(growth);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getMemberName = () => {
        if (!selectedMember) return 'All Members';
        return selectedMember.member_name;
    };

    const availableMonths = useMemo(() => {
        return monthlyStats.map(m => m.month);
    }, [monthlyStats]);

    const filteredData = useMemo(() => {
        let filteredExppenditure = [...monthlyStats];
        let filteredGrowth = [...growthData];

        if (timeRange !== 'ALL') {
            if (timeRange === '1Y' || timeRange === '6M' || timeRange === '3M') {
                const monthsHelper = { '3M': 3, '6M': 6, '1Y': 12 };
                const monthCount = monthsHelper[timeRange];
                filteredExppenditure = filteredExppenditure.slice(0, monthCount);

                const cutoffDate = new Date();
                cutoffDate.setMonth(cutoffDate.getMonth() - monthCount);
                filteredGrowth = filteredGrowth.filter(d => new Date(d.date) >= cutoffDate);
            } else {
                // Specific Month
                filteredExppenditure = filteredExppenditure.filter(m => m.month === timeRange);
                const [year, month] = timeRange.split('-');
                filteredGrowth = filteredGrowth.filter(d => {
                    const date = new Date(d.date);
                    return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
                });
            }
        }
        return { monthly: filteredExppenditure, growth: filteredGrowth };
    }, [monthlyStats, growthData, timeRange]);

    const totalStats = useMemo(() => {
        let wins = 0;
        let losses = 0;
        let totalPnl = 0;
        let totalTrades = 0;

        filteredData.monthly.forEach(m => {
            wins += m.winning_trades || 0;
            losses += m.losing_trades || 0;
            totalPnl += m.net_profit || 0;
            totalTrades += m.total_trades || 0;
        });

        return { wins, losses, totalPnl, totalTrades, winRate: totalTrades ? ((wins / totalTrades) * 100).toFixed(1) : 0 };
    }, [filteredData]);

    const pieData = [
        { name: 'Wins', value: totalStats.wins, color: COLORS.success },
        { name: 'Losses', value: totalStats.losses, color: COLORS.danger },
    ];

    if (loading && !growthData.length && !monthlyStats.length) return <div className="container" style={{ padding: '2rem' }}>Loading analytics...</div>;
    if (error) return <div className="container" style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>;

    const currentCapital = growthData.length > 0 ? growthData[growthData.length - 1].value : 0;

    return (
        <div className="container analytics-page fade-in">
            <header className="page-header flex-between mb-4">
                <div>
                    <h1 className="mb-2">Detailed Analytics</h1>
                    <p className="subtitle" style={{ color: 'var(--color-text-secondary)' }}>
                        Deep dive for <strong style={{ color: 'var(--color-primary)' }}>{getMemberName()}</strong>
                    </p>
                </div>
                <div className="header-actions flex" style={{ gap: '10px' }}>
                    <select
                        className="form-select"
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        style={{ width: 'auto', minWidth: '160px' }}
                    >
                        <option value="ALL">All Time</option>
                        <optgroup label="Ranges">
                            <option value="1Y">Last 1 Year</option>
                            <option value="6M">Last 6 Months</option>
                            <option value="3M">Last 3 Months</option>
                        </optgroup>
                        {availableMonths.length > 0 && (
                            <optgroup label="Monthly">
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>

                    <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: '150px' }}
                        value={selectedMember ? selectedMember.id : ''}
                        onChange={(e) => {
                            const id = e.target.value;
                            if (id === '') setSelectedMember(null);
                            else setSelectedMember(members.find(m => m.id == id));
                        }}
                    >
                        <option value="">👤 All Members</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>👤 {m.member_name}</option>
                        ))}
                    </select>
                    <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </header>

            {/* Stats Summary */}
            <section className="grid grid-3 mb-4">
                <div className="summary-card">
                    <div className="summary-label">Win Rate</div>
                    <div className="summary-value" style={{ color: totalStats.winRate >= 50 ? COLORS.success : COLORS.text }}>
                        {totalStats.winRate}%
                    </div>
                    <div className="summary-sublabel">{totalStats.wins} Wins / {totalStats.losses} Losses</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">Realized P&L</div>
                    <div className={`summary-value ${totalStats.totalPnl >= 0 ? 'positive' : 'negative'}`}
                        style={{ color: totalStats.totalPnl >= 0 ? COLORS.success : COLORS.danger }}>
                        ₹{totalStats.totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="summary-sublabel">{timeRange === 'ALL' ? 'Lifetime' : 'Selected Period'}</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">Total Trades</div>
                    <div className="summary-value" style={{ color: COLORS.text }}>
                        {totalStats.totalTrades}
                    </div>
                    <div className="summary-sublabel">Closed Positions</div>
                </div>
            </section>

            {/* Main Charts */}
            <section className="grid grid-2 mb-4">
                <div className="card" style={{ height: '420px', padding: '1.5rem 1rem 1rem 0' }}>
                    <h3 className="card-title mb-2" style={{ paddingLeft: '1.5rem', fontSize: '1.2rem' }}>Capital Scale</h3>
                    {growthData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData.growth} margin={{ top: 10, right: 15, left: 25, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke={COLORS.textSecondary} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short' })} tickMargin={10} />
                                <YAxis stroke={COLORS.textSecondary} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                                <Tooltip contentStyle={{ backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border, color: COLORS.text }} itemStyle={{ color: COLORS.text }} formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, '']} />
                                <Area type="monotone" dataKey="value" stroke={COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <div className="flex-center" style={{ height: '100%', color: COLORS.textSecondary }}>No data</div>}
                </div>

                <div className="card" style={{ height: '420px', padding: '1.5rem 1rem 1rem 0' }}>
                    <h3 className="card-title mb-2" style={{ paddingLeft: '1.5rem', fontSize: '1.2rem' }}>Monthly Performance</h3>
                    {filteredData.monthly.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...filteredData.monthly].reverse()} margin={{ top: 10, right: 15, left: 25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                                <XAxis dataKey="month" stroke={COLORS.textSecondary} tickMargin={10} />
                                <YAxis stroke={COLORS.textSecondary} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                                <Tooltip cursor={{ fill: COLORS.bgSecondary, opacity: 0.8 }} contentStyle={{ backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border, color: COLORS.text }} formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                                <Bar dataKey="net_profit" name="Net Profit">
                                    {[...filteredData.monthly].reverse().map((entry, index) => <Cell key={`cell-${index}`} fill={entry.net_profit >= 0 ? COLORS.success : COLORS.danger} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="flex-center" style={{ height: '100%', color: COLORS.textSecondary }}>No data</div>}
                </div>
            </section>

            {/* Win/Loss and Breakdown */}
            <section className="grid grid-3 mb-4">
                <div className="card" style={{ height: '400px', padding: '1rem' }}>
                    <h3 className="card-title text-center mb-2">Win / Loss Ratio</h3>
                    {totalStats.totalTrades > 0 ? (
                        <div style={{ height: '100%', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', marginTop: '-10px' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 'bold', lineHeight: 1 }}>{totalStats.winRate}%</div>
                                <div style={{ fontSize: '0.8rem', color: COLORS.textSecondary, marginTop: '4px' }}>Win Rate</div>
                            </div>
                        </div>
                    ) : <div className="flex-center" style={{ height: '100%', color: COLORS.textSecondary }}>No trades</div>}
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden', gridColumn: 'span 2' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                        <h3 className="card-title">Monthly Breakdown</h3>
                    </div>
                    <div className="table-container" style={{ border: 'none', borderRadius: 0, maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ background: COLORS.bgSecondary, position: 'sticky', top: 0 }}>Month</th>
                                    <th className="text-right" style={{ background: COLORS.bgSecondary, position: 'sticky', top: 0 }}>Trades</th>
                                    <th className="text-right" style={{ background: COLORS.bgSecondary, position: 'sticky', top: 0 }}>Win/Loss</th>
                                    <th className="text-right" style={{ background: COLORS.bgSecondary, position: 'sticky', top: 0 }}>Net P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.monthly.map((stat) => (
                                    <tr key={stat.month}>
                                        <td style={{ fontWeight: 600 }}>{stat.month}</td>
                                        <td className="text-right">{stat.total_trades}</td>
                                        <td className="text-right"><span style={{ color: COLORS.success }}>{stat.winning_trades}W</span> / <span style={{ color: COLORS.danger }}>{stat.losing_trades}L</span></td>
                                        <td className="text-right" style={{ fontWeight: 700, color: stat.net_profit >= 0 ? COLORS.success : COLORS.danger }}>₹{stat.net_profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default AnalyticsPage;

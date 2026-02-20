import React, { useState, useEffect } from 'react';
import { fetchFiiDiiData, refreshFiiDiiData } from '../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

export default function FiiDiiDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [view, setView] = useState('7D'); // '7D', '30D'

    useEffect(() => {
        loadData(true);
        const interval = setInterval(() => {
            loadData(false);
        }, 5 * 60000); // Poll every 5 minutes
        return () => clearInterval(interval);
    }, []);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const raw = await fetchFiiDiiData();
            setData(raw);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshFiiDiiData();
            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    };

    // Format data for Recharts
    const processChartData = () => {
        // Group by date
        const grouped = {};
        data.forEach(item => {
            if (!grouped[item.date]) {
                grouped[item.date] = { date: item.date, fiiNet: 0, diiNet: 0 };
            }
            if (item.category === 'FII') grouped[item.date].fiiNet = item.net;
            if (item.category === 'DII') grouped[item.date].diiNet = item.net;
        });

        // Convert to array and sort chronologically
        let chartData = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Filter by view
        if (view === '7D') {
            chartData = chartData.slice(-7);
        } else if (view === '30D') {
            chartData = chartData.slice(-30);
        }

        return chartData;
    };

    // Prepare table data (latest dates first)
    const processTableData = () => {
        const grouped = {};
        data.forEach(item => {
            if (!grouped[item.date]) {
                grouped[item.date] = { date: item.date };
            }
            if (item.category === 'FII') {
                grouped[item.date].fiiBuy = item.gross_buy;
                grouped[item.date].fiiSell = item.gross_sell;
                grouped[item.date].fiiNet = item.net;
            } else if (item.category === 'DII') {
                grouped[item.date].diiBuy = item.gross_buy;
                grouped[item.date].diiSell = item.gross_sell;
                grouped[item.date].diiNet = item.net;
            }
        });

        return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7); // Show last 7 days in table
    };

    const chartData = processChartData();
    const tableData = processTableData();

    if (loading) return <div>Loading Institutional Data...</div>;

    const formatCurrency = (val) => {
        if (!val) return '0.00';
        return val.toFixed(2);
    };

    return (
        <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>FII / DII Activity (₹ Cr)</h2>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className="tab-controls" style={{ display: 'flex', background: 'var(--color-bg-elevated)', borderRadius: '6px', padding: '4px' }}>
                        <button
                            className={`btn ${view === '7D' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setView('7D')}
                            style={{ padding: '4px 12px', boxSizing: 'border-box', border: 'none', background: view === '7D' ? 'var(--color-primary)' : 'transparent', color: view === '7D' ? '#fff' : 'var(--color-text-secondary)', boxShadow: view === '7D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            Last 7 Days
                        </button>
                        <button
                            className={`btn ${view === '30D' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setView('30D')}
                            style={{ padding: '4px 12px', boxSizing: 'border-box', border: 'none', background: view === '30D' ? 'var(--color-primary)' : 'transparent', color: view === '30D' ? '#fff' : 'var(--color-text-secondary)', boxShadow: view === '30D' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                            Last 30 Days
                        </button>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                    >
                        {refreshing ? 'Refreshing...' : '↻ Force Update'}
                    </button>
                </div>
            </div>

            {error && <div className="error-message" style={{ margin: '15px' }}>{error}</div>}

            <div style={{ padding: '20px', backgroundColor: 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--color-text-primary)' }}>Net Institutional Flow Trend</h3>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                            <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} domain={['dataMin - 1000', 'dataMax + 1000']} />
                            <Tooltip cursor={{ fill: 'var(--color-bg-elevated)' }} contentStyle={{ backgroundColor: 'var(--color-bg-tertiary)', borderRadius: '8px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px', color: 'var(--color-text-primary)' }} />
                            <ReferenceLine y={0} stroke="#94a3b8" />
                            <Bar dataKey="fiiNet" name="FII Net" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="diiNet" name="DII Net" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="table-responsive">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th style={{ textAlign: 'center', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }} colSpan="3">FII Activity (₹ Cr)</th>
                            <th style={{ textAlign: 'center', backgroundColor: 'var(--color-info)', color: '#fff' }} colSpan="3">DII Activity (₹ Cr)</th>
                        </tr>
                        <tr>
                            <th></th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Buy</th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Sell</th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Net</th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Buy</th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Sell</th>
                            <th style={{ textAlign: 'right', fontSize: '0.85rem' }}>Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                                    No data available.
                                </td>
                            </tr>
                        ) : (
                            tableData.map(row => (
                                <tr key={row.date}>
                                    <td style={{ fontWeight: '500' }}>{row.date}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatCurrency(row.fiiBuy)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatCurrency(row.fiiSell)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: row.fiiNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {row.fiiNet > 0 ? '+' : ''}{formatCurrency(row.fiiNet)}
                                    </td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatCurrency(row.diiBuy)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatCurrency(row.diiSell)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: row.diiNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {row.diiNet > 0 ? '+' : ''}{formatCurrency(row.diiNet)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

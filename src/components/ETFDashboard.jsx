import React, { useState, useEffect } from 'react';
import { fetchEtfData, refreshEtfData, getAppSetting, updateAppSetting } from '../api';

export default function ETFDashboard() {
    const [etfs, setEtfs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [provider, setProvider] = useState('google');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData(true);
        // Add polling for live updates
        const interval = setInterval(() => {
            loadData(false); // background refresh, no loading spinner
        }, 30000); // refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [data, setting] = await Promise.all([
                fetchEtfData(),
                getAppSetting('etf_data_provider')
            ]);
            setEtfs(data);
            if (setting.value) setProvider(setting.value);
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
            await refreshEtfData();
            await loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setRefreshing(false);
        }
    };

    const handleProviderChange = async (e) => {
        const newProvider = e.target.value;
        setProvider(newProvider);
        try {
            await updateAppSetting('etf_data_provider', newProvider);
            handleRefresh(); // Trigger refresh with new provider
        } catch (err) {
            setError("Failed to change provider: " + err.message);
        }
    };

    const formatChange = (value, percent) => {
        if (value === null || value === undefined) return '-';
        const isPositive = value >= 0;
        const colorStyle = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
        const sign = isPositive ? '+' : '';
        return (
            <span style={{ color: colorStyle, fontWeight: '600' }}>
                {sign}{value.toFixed(2)} ({sign}{percent.toFixed(2)}%)
            </span>
        );
    };

    if (loading && etfs.length === 0) return <div>Loading ETF Data...</div>;

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', overflow: 'hidden' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="live-indicator"></span>
                    Live ETF Tracker
                </h2>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                        <label style={{ marginRight: '8px', color: 'var(--color-text-secondary)' }}>Data Source:</label>
                        <select
                            value={provider}
                            onChange={handleProviderChange}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-elevated)',
                                color: 'var(--color-text-primary)'
                            }}
                        >
                            <option value="google">Google Finance (Web Scrape)</option>
                            <option value="yahoo">Yahoo Finance (API)</option>
                        </select>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                    >
                        {refreshing ? 'Refreshing...' : '↻ Refresh Data'}
                    </button>
                </div>
            </div>

            {error && <div className="error-message" style={{ margin: '15px', color: 'var(--color-danger)' }}>{error}</div>}

            <div className="table-responsive" style={{ flex: 1, overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--color-surface)' }}>
                        <tr>
                            <th>Symbol</th>
                            <th>Name</th>
                            <th style={{ textAlign: 'right' }}>Price (₹)</th>
                            <th style={{ textAlign: 'right' }}>1D Change</th>
                            <th style={{ textAlign: 'right' }}>1W Change</th>
                            <th style={{ textAlign: 'right' }}>1M Change</th>
                            <th style={{ textAlign: 'right' }}>Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        {etfs.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                                    No ETF data available. Ensure cron jobs are running or trigger a manual refresh.
                                </td>
                            </tr>
                        ) : (
                            etfs.map(etf => (
                                <tr key={etf.symbol}>
                                    <td style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{etf.symbol.replace('.NS', '')}</td>
                                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{etf.name}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{etf.price?.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatChange(etf.change_1d, etf.change_percent_1d)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatChange(etf.change_1w, etf.change_percent_1w)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatChange(etf.change_1m, etf.change_percent_1m)}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                                        {etf.volume ? etf.volume.toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '15px', fontSize: '0.8rem', color: 'var(--color-warning)', borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
                Note: 1W and 1M changes may only be available when using Yahoo Finance due to Google Finance scraping limitations.
            </div>
        </div>
    );
}

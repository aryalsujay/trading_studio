import React, { useState } from 'react';
import ETFDashboard from './ETFDashboard';
import FiiDiiDashboard from './FiiDiiDashboard';

export default function MarketsDashboard() {
    const [activeTab, setActiveTab] = useState('etfs');

    return (
        <div style={{ padding: '20px', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Markets Dashboard</h1>
            </div>

            <div className="tabs" style={{ marginBottom: '20px', borderBottom: '2px solid var(--color-border)', display: 'flex' }}>
                <button
                    className={`tab-btn ${activeTab === 'etfs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('etfs')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'etfs' ? '3px solid var(--color-primary)' : '3px solid transparent',
                        fontSize: '1.05rem',
                        fontWeight: activeTab === 'etfs' ? '600' : '400',
                        color: activeTab === 'etfs' ? '#ffffff' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginRight: '10px'
                    }}
                >
                    📈 ETF Tracker
                </button>
                <button
                    className={`tab-btn ${activeTab === 'fiidii' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fiidii')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'fiidii' ? '3px solid var(--color-primary)' : '3px solid transparent',
                        fontSize: '1.05rem',
                        fontWeight: activeTab === 'fiidii' ? '600' : '400',
                        color: activeTab === 'fiidii' ? '#ffffff' : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    🏦 FII / DII Activity
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'etfs' && <ETFDashboard />}
                {activeTab === 'fiidii' && <FiiDiiDashboard />}
            </div>
        </div>
    );
}

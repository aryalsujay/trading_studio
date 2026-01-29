import { useState, useEffect, Component } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import TradesPage from './components/TradesPage';
import CapitalPage from './components/CapitalPage';
import SettingsPage from './components/SettingsPage';

import { useMembers } from './contexts/MemberContext';

function Navigation() {
    const location = useLocation();
    const { members, selectedMember, setSelectedMember } = useMembers();

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="nav">
            <div className="container nav-container">
                <Link to="/" className="nav-brand">
                    <span>📊</span> ETF Trading Ledger
                </Link>



                <ul className="nav-links" style={{ marginLeft: 'auto' }}>
                    <li>
                        <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                            Dashboard
                        </Link>
                    </li>
                    <li>
                        <Link to="/trades" className={`nav-link ${isActive('/trades') ? 'active' : ''}`}>
                            Trades
                        </Link>
                    </li>
                    <li>
                        <Link to="/capital" className={`nav-link ${isActive('/capital') ? 'active' : ''}`}>
                            Capital
                        </Link>
                    </li>
                    <li>
                        <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
                            Settings
                        </Link>
                    </li>
                    <li>
                        <a
                            href="https://zerodha.com/brokerage-calculator/#tab-equities"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nav-link"
                        >
                            Zerodha Calculator ↗
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
    );
}

import { SymbolProvider } from './contexts/SymbolContext';
import { MemberProvider } from './contexts/MemberContext';

function App() {
    return (
        <SymbolProvider>
            <MemberProvider>
                <BrowserRouter>
                    <Navigation />
                    <ErrorBoundary>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/trades" element={<TradesPage />} />
                            <Route path="/capital" element={<CapitalPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </ErrorBoundary>
                </BrowserRouter>
            </MemberProvider>
        </SymbolProvider>
    );
}

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red' }}>
                    <h1>Something went wrong.</h1>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

export default App;


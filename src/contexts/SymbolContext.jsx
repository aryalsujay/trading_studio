import { createContext, useState, useEffect, useContext } from 'react';
import { fetchSymbols } from '../api';

const SymbolContext = createContext();

export function SymbolProvider({ children }) {
    const [symbols, setSymbols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadSymbols();
    }, []);

    async function loadSymbols() {
        try {
            setLoading(true);
            const data = await fetchSymbols();
            const symbolList = data.map(s => s.symbol).sort();
            setSymbols(symbolList);
            // Cache in localStorage for instant loading next time
            localStorage.setItem('etf_symbols_cache', JSON.stringify(symbolList));
        } catch (err) {
            console.error('Failed to load symbols:', err);
            setError(err);
            // Try to load from cache if API fails
            const cached = localStorage.getItem('etf_symbols_cache');
            if (cached) {
                setSymbols(JSON.parse(cached));
            }
        } finally {
            setLoading(false);
        }
    }

    function refreshSymbols() {
        loadSymbols();
    }

    const value = {
        symbols,
        loading,
        error,
        refreshSymbols
    };

    return (
        <SymbolContext.Provider value={value}>
            {children}
        </SymbolContext.Provider>
    );
}

export function useSymbols() {
    const context = useContext(SymbolContext);
    if (!context) {
        throw new Error('useSymbols must be used within a SymbolProvider');
    }
    return context;
}

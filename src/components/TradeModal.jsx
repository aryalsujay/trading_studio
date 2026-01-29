import { useState, useEffect } from 'react';
import { getTodayDate } from '../utils';
import { fetchSymbols } from '../api';
import { useMembers } from '../contexts/MemberContext';

export default function TradeModal({ trade, onSave, onClose }) {
    const { members, selectedMember } = useMembers();

    const [formData, setFormData] = useState({
        symbol: '',
        buy_date: getTodayDate(),
        buy_price: '',
        sell_date: '',
        sell_price: '',
        quantity: '',
        notes: '',
        member_id: '',
        isSplit: false
    });

    const [symbols, setSymbols] = useState([]);
    const [symbolsLoading, setSymbolsLoading] = useState(true);

    // Fetch symbols from database
    useEffect(() => {
        async function loadSymbols() {
            try {
                const data = await fetchSymbols();
                setSymbols(data.map(s => s.symbol).sort());
            } catch (error) {
                console.error('Failed to load symbols:', error);
                setSymbols([]);
            } finally {
                setSymbolsLoading(false);
            }
        }
        loadSymbols();
    }, []);

    useEffect(() => {
        if (trade) {
            setFormData({
                symbol: trade.symbol || '',
                buy_date: trade.buy_date?.split('T')[0] || getTodayDate(),
                buy_price: trade.buy_price || '',
                sell_date: trade.sell_date?.split('T')[0] || '',
                sell_price: trade.sell_price || '',
                quantity: trade.quantity || '',
                notes: trade.notes || '',
                member_id: trade.member_id || '',
                isSplit: false // Editing is always single trade
            });
        } else {
            // New Trade Defaults
            setFormData(prev => ({
                ...prev,
                member_id: selectedMember || members[0]?.id || '',
                isSplit: false
            }));
        }
    }, [trade, members, selectedMember]);

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    }

    function handleSubmit(e) {
        e.preventDefault();
        onSave({
            symbol: formData.symbol.toUpperCase(),
            buy_date: formData.buy_date,
            buy_price: parseFloat(formData.buy_price),
            sell_date: formData.sell_date || null,
            sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
            quantity: parseInt(formData.quantity),
            notes: formData.notes,
            exchange: 'NSE',
            member_id: formData.isSplit ? null : parseInt(formData.member_id),
            isSplit: formData.isSplit
        });
    }

    const isExited = formData.sell_price && formData.sell_date;
    const grossProfit = isExited ? ((formData.sell_price - formData.buy_price) * formData.quantity) : 0;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{trade ? 'Edit Trade' : 'Add New Trade'}</h2>
                    <button onClick={onClose} className="btn btn-secondary btn-sm">✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Allocation Strategy - Only show for new trades */}
                        {!trade && (
                            <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--color-bg-secondary)' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                                    Allocation Strategy
                                </h3>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="allocationMode"
                                                checked={!formData.isSplit}
                                                onChange={() => setFormData({ ...formData, isSplit: false })}
                                                style={{ marginRight: '8px' }}
                                            />
                                            Single Member
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="allocationMode"
                                                checked={formData.isSplit}
                                                onChange={() => setFormData({ ...formData, isSplit: true })}
                                                style={{ marginRight: '8px' }}
                                            />
                                            Auto-Split (Capital Based)
                                        </label>
                                    </div>

                                    {formData.isSplit ? (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                                            💡 Quantity will be divided among all {members.length} active members based on their current capital ratio.
                                        </p>
                                    ) : (
                                        <div style={{ marginTop: '10px' }}>
                                            <select
                                                name="member_id"
                                                className="form-input"
                                                value={formData.member_id}
                                                onChange={handleChange}
                                                required={!formData.isSplit}
                                            >
                                                <option value="" disabled>Select Member</option>
                                                {members.map(m => (
                                                    <option key={m.id} value={m.id}>{m.member_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Entry Fields Section */}
                        <div style={{ marginBottom: 'var(--space-xl)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-primary)' }}>
                                Entry Details (Required)
                            </h3>

                            <div className="form-group">
                                <label className="form-label">Symbol *</label>
                                <input
                                    type="text"
                                    name="symbol"
                                    className="form-input"
                                    value={formData.symbol}
                                    onChange={handleChange}
                                    placeholder={symbolsLoading ? "Loading symbols..." : "Type to search ETF symbols..."}
                                    list="etf-symbols-datalist"
                                    autoComplete="off"
                                    required
                                />
                                <datalist id="etf-symbols-datalist">
                                    {symbols.map(symbol => (
                                        <option key={symbol} value={symbol} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">Entry Date *</label>
                                    <input
                                        type="date"
                                        name="buy_date"
                                        className="form-input"
                                        value={formData.buy_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Entry Price (₹) *</label>
                                    <input
                                        type="number"
                                        name="buy_price"
                                        className="form-input"
                                        value={formData.buy_price}
                                        onChange={handleChange}
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Quantity *</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    className="form-input"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    min="1"
                                    required
                                />
                            </div>
                        </div>

                        {/* Exit Fields Section */}
                        <div style={{ marginBottom: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
                                Exit Details (Optional - can be added later)
                            </h3>

                            <div className="grid grid-2">
                                <div className="form-group">
                                    <label className="form-label">Exit Date</label>
                                    <input
                                        type="date"
                                        name="sell_date"
                                        className="form-input"
                                        value={formData.sell_date}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Exit Price (₹)</label>
                                    <input
                                        type="number"
                                        name="sell_price"
                                        className="form-input"
                                        value={formData.sell_price}
                                        onChange={handleChange}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea
                                name="notes"
                                className="form-textarea"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Optional notes about this trade..."
                            />
                        </div>

                        {/* Preview Card */}
                        {formData.buy_price && formData.quantity && (
                            <div className="card" style={{ background: 'var(--color-surface)' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                    <strong>Preview (NSE):</strong>
                                </p>
                                <p style={{ fontSize: '0.875rem' }}>
                                    Investment: ₹{(formData.buy_price * formData.quantity).toFixed(2)}
                                </p>
                                {isExited && (
                                    <>
                                        <p style={{ fontSize: '0.875rem', marginTop: 'var(--space-xs)' }}>
                                            Turnover: ₹{(formData.sell_price * formData.quantity).toFixed(2)}
                                        </p>
                                        <p style={{
                                            fontSize: '0.875rem',
                                            marginTop: 'var(--space-xs)',
                                            color: grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                                            fontWeight: 600
                                        }}>
                                            Gross P/L: ₹{grossProfit.toFixed(2)}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {trade ? 'Update Trade' : 'Add Trade'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

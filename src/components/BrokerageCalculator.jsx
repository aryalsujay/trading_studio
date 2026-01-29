import { useState, useEffect } from 'react';
import { calculateBrokerage } from '../api';
import { formatCurrency, formatNumber } from '../utils';

export default function BrokerageCalculator() {
    const [inputs, setInputs] = useState({
        buy_price: '1000',
        sell_price: '1100',
        quantity: '400',
        exchange: 'NSE'
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // Auto-calculate whenever inputs change
    useEffect(() => {
        const { buy_price, sell_price, quantity, exchange } = inputs;

        // Only calculate if all required fields have values
        if (buy_price && sell_price && quantity) {
            const buyNum = parseFloat(buy_price);
            const sellNum = parseFloat(sell_price);
            const qtyNum = parseInt(quantity);

            if (buyNum > 0 && sellNum > 0 && qtyNum > 0) {
                performCalculation(buyNum, sellNum, qtyNum, exchange);
            }
        }
    }, [inputs]); // Triggers when any input changes including exchange

    async function performCalculation(buy, sell, qty, exchange) {
        try {
            setLoading(true);
            const data = await calculateBrokerage(buy, sell, qty, exchange);
            setResult(data);
        } catch (error) {
            console.error('Calculation error:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleInputChange(field, value) {
        setInputs(prev => ({ ...prev, [field]: value }));
    }

    return (
        <div className="page container fade-in">
            <h1 className="mb-4">Brokerage Calculator</h1>

            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <div className="card">
                    {/* Title */}
                    <div style={{
                        padding: 'var(--space-lg)',
                        borderBottom: '1px solid var(--color-border)',
                        textAlign: 'center'
                    }}>
                        <h2 style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            margin: 0,
                            color: 'var(--color-text-secondary)'
                        }}>
                            Delivery equity
                        </h2>
                    </div>

                    {/* Main inputs */}
                    <div style={{ padding: 'var(--space-xl)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 'var(--space-md)',
                            marginBottom: 'var(--space-xl)'
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-sm)',
                                    color: 'var(--color-text-secondary)'
                                }}>
                                    BUY
                                </label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={inputs.buy_price}
                                    onChange={(e) => handleInputChange('buy_price', e.target.value)}
                                    style={{ textAlign: 'center', fontSize: '1.125rem' }}
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-sm)',
                                    color: 'var(--color-text-secondary)'
                                }}>
                                    SELL
                                </label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={inputs.sell_price}
                                    onChange={(e) => handleInputChange('sell_price', e.target.value)}
                                    style={{ textAlign: 'center', fontSize: '1.125rem' }}
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-sm)',
                                    color: 'var(--color-text-secondary)'
                                }}>
                                    QUANTITY
                                </label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={inputs.quantity}
                                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                                    style={{ textAlign: 'center', fontSize: '1.125rem' }}
                                    min="1"
                                />
                            </div>
                        </div>

                        {/* Exchange selector */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-xl)',
                            justifyContent: 'center',
                            marginBottom: 'var(--space-xl)'
                        }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 500
                            }}>
                                <input
                                    type="radio"
                                    name="exchange"
                                    value="NSE"
                                    checked={inputs.exchange === 'NSE'}
                                    onChange={(e) => handleInputChange('exchange', e.target.value)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                NSE
                            </label>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 500
                            }}>
                                <input
                                    type="radio"
                                    name="exchange"
                                    value="BSE"
                                    checked={inputs.exchange === 'BSE'}
                                    onChange={(e) => handleInputChange('exchange', e.target.value)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                BSE
                            </label>
                        </div>

                        {/* Turnover */}
                        {result && (
                            <>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-md) 0',
                                    borderBottom: '1px solid var(--color-border)',
                                    marginBottom: 'var(--space-lg)'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        Turnover
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.totalTurnover)}
                                    </span>
                                </div>

                                {/* Zerodha charges header */}
                                <div style={{
                                    textAlign: 'center',
                                    fontSize: '0.875rem',
                                    color: 'var(--color-text-secondary)',
                                    marginBottom: 'var(--space-md)',
                                    fontWeight: 500
                                }}>
                                    Zerodha charges
                                </div>

                                {/* Brokerage */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        Brokerage
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {result.breakdown.brokerage}
                                    </span>
                                </div>

                                {/* Statutory charges header */}
                                <div style={{
                                    textAlign: 'center',
                                    fontSize: '0.875rem',
                                    color: 'var(--color-text-secondary)',
                                    margin: 'var(--space-md) 0',
                                    fontWeight: 500
                                }}>
                                    Statutory charges *
                                </div>

                                {/* STT */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        STT total
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.stt)}
                                    </span>
                                </div>

                                {/* Exchange txn */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        Exchange txn charge
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.exchangeTxn)}
                                    </span>
                                </div>

                                {/* GST */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        GST
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.gst)}
                                    </span>
                                </div>

                                {/* SEBI */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        SEBI charges
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.sebi)}
                                    </span>
                                </div>

                                {/* Stamp duty */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0',
                                    marginBottom: 'var(--space-md)'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        Stamp duty
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {formatNumber(result.breakdown.stampDuty)}
                                    </span>
                                </div>

                                {/* Total tax */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-md) 0',
                                    borderTop: '1px solid var(--color-border)',
                                    borderBottom: '1px solid var(--color-border)',
                                    marginBottom: 'var(--space-md)'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        Total tax and charges
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                                        {formatNumber(result.total)}
                                    </span>
                                </div>

                                {/* Breakeven */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-sm) 0',
                                    marginBottom: 'var(--space-lg)'
                                }}>
                                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>
                                        Points to breakeven
                                    </span>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                                        {(result.total / inputs.quantity).toFixed(2)}
                                    </span>
                                </div>

                                {/* Net P&L */}
                                <div style={{
                                    textAlign: 'center',
                                    padding: 'var(--space-lg) 0',
                                    borderTop: '1px solid var(--color-border)'
                                }}>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        color: 'var(--color-text-secondary)',
                                        marginBottom: 'var(--space-sm)'
                                    }}>
                                        Net P&L
                                    </div>
                                    <div style={{
                                        fontSize: '2rem',
                                        fontWeight: 700,
                                        color: result.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                                    }}>
                                        {formatNumber(result.netProfit)}
                                    </div>
                                </div>
                            </>
                        )}

                        {loading && !result && (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-xl)',
                                color: 'var(--color-text-secondary)'
                            }}>
                                Calculating...
                            </div>
                        )}
                    </div>
                </div>

                {/* Info note */}
                <div style={{
                    marginTop: 'var(--space-lg)',
                    padding: 'var(--space-md)',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6
                }}>
                    <strong>Note:</strong> Calculations update automatically as you type. This calculator uses the exact Zerodha formula with proper rounding for delivery equity trades on {inputs.exchange}.
                </div>
            </div>
        </div>
    );
}

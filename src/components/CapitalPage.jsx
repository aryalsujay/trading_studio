import { useState, useEffect } from 'react';
import { fetchCapitalTransactions, createCapitalTransaction, updateCapitalTransaction, deleteCapitalTransaction } from '../api';
import { formatCurrency, formatDate, getTodayDate } from '../utils';
import { useMembers } from '../contexts/MemberContext';

export default function CapitalPage() {
    const { members, selectedMember, setSelectedMember } = useMembers(); // Get global member state
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTxn, setEditingTxn] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'deposits', 'withdrawals'

    useEffect(() => {
        loadTransactions();
    }, [selectedMember]); // Reload when selected member changes

    async function loadTransactions() {
        try {
            setLoading(true);
            // Pass selectedMember to API (null = all)
            const data = await fetchCapitalTransactions(selectedMember);
            setTransactions(data);
        } catch (error) {
            console.error('Failed to load transactions:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        try {
            await deleteCapitalTransaction(id);
            await loadTransactions();
        } catch (error) {
            alert('Failed to delete transaction: ' + error.message);
        }
    }

    const deposits = transactions.filter(t => t.transaction_type === 'DEPOSIT').reduce((sum, t) => sum + t.amount, 0);
    const withdrawals = Math.abs(transactions.filter(t => t.transaction_type === 'WITHDRAWAL').reduce((sum, t) => sum + t.amount, 0));
    const totalCapital = transactions.reduce((sum, txn) => sum + txn.amount, 0);

    // Filter transactions
    const filteredTransactions = transactions.filter(txn => {
        if (filter === 'deposits') return txn.transaction_type === 'DEPOSIT';
        if (filter === 'withdrawals') return txn.transaction_type === 'WITHDRAWAL';
        return true; // 'all'
    });

    return (
        <div className="page container fade-in">
            <div className="flex-between mb-4">
                <h1>Capital Transactions</h1>
                <div className="flex" style={{ gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select
                            className="form-select"
                            value={selectedMember || ''}
                            onChange={(e) => setSelectedMember(e.target.value ? parseInt(e.target.value) : null)}
                            style={{ width: 'auto', minWidth: '130px' }}
                        >
                            <option value="">👤 All Members</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>👤 {m.member_name}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={() => { setEditingTxn(null); setShowModal(true); }} className="btn btn-primary">
                        + Add Transaction
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-3 mb-4">
                <div className="stat-card">
                    <div className="stat-label">Total Capital</div>
                    <div className="stat-value">{formatCurrency(totalCapital)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Deposits</div>
                    <div className="stat-value positive">{formatCurrency(deposits)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Withdrawals</div>
                    <div className="stat-value negative">{formatCurrency(withdrawals)}</div>
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="card mb-4">
                <div className="flex" style={{ gap: '0.5rem' }}>
                    <button
                        onClick={() => setFilter('all')}
                        className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    >
                        All ({transactions.length})
                    </button>
                    <button
                        onClick={() => setFilter('deposits')}
                        className={`btn ${filter === 'deposits' ? 'btn-success' : 'btn-secondary'} btn-sm`}
                    >
                        Deposits ({transactions.filter(t => t.transaction_type === 'DEPOSIT').length})
                    </button>
                    <button
                        onClick={() => setFilter('withdrawals')}
                        className={`btn ${filter === 'withdrawals' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                    >
                        Withdrawals ({transactions.filter(t => t.transaction_type === 'WITHDRAWAL').length})
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="card">
                {loading ? (
                    <p>Loading transactions...</p>
                ) : filteredTransactions.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Member</th> {/* New Column */}
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((txn) => (
                                    <tr key={txn.id}>
                                        <td>{formatDate(txn.transaction_date)}</td>
                                        <td>
                                            <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                                                {txn.member_name || txn.member_code || 'Main'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={txn.transaction_type === 'DEPOSIT' ? 'badge badge-success' : 'badge badge-danger'}>
                                                {txn.transaction_type}
                                            </span>
                                        </td>
                                        <td>
                                            <strong className={txn.amount >= 0 ? 'positive' : 'negative'}>
                                                {formatCurrency(Math.abs(txn.amount))}
                                            </strong>
                                        </td>
                                        <td>{txn.notes || '-'}</td>
                                        <td>
                                            <div className="flex" style={{ gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => { setEditingTxn(txn); setShowModal(true); }}
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(txn.id)}
                                                    className="btn btn-danger btn-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center" style={{ padding: '3rem', color: 'var(--color-text-secondary)' }}>
                        <p>No {filter !== 'all' ? filter : 'capital transactions'} found.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <CapitalModal
                    transaction={editingTxn}
                    members={members}
                    currentMemberId={selectedMember}
                    onSave={async (data) => {
                        try {
                            if (editingTxn) {
                                await updateCapitalTransaction(editingTxn.id, data);
                            } else {
                                await createCapitalTransaction(data);
                            }
                            setShowModal(false);
                            await loadTransactions();
                        } catch (error) {
                            alert('Failed to save transaction: ' + error.message);
                        }
                    }}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}

function CapitalModal({ transaction, members, currentMemberId, onSave, onClose }) {
    const [formData, setFormData] = useState({
        transaction_date: getTodayDate(),
        amount: '',
        transaction_type: 'DEPOSIT',
        notes: '',
        member_id: currentMemberId || (members[0]?.id || '') // Default to current selection or first member
    });

    useEffect(() => {
        if (transaction) {
            setFormData({
                transaction_date: transaction.transaction_date?.split('T')[0] || getTodayDate(),
                amount: Math.abs(transaction.amount) || '',
                transaction_type: transaction.transaction_type || 'DEPOSIT',
                notes: transaction.notes || '',
                member_id: transaction.member_id || ''
            });
        }
    }, [transaction]);

    function handleSubmit(e) {
        e.preventDefault();
        const amount = parseFloat(formData.amount);
        onSave({
            transaction_date: formData.transaction_date,
            amount: formData.transaction_type === 'WITHDRAWAL' ? -amount : amount,
            transaction_type: formData.transaction_type,
            notes: formData.notes,
            member_id: formData.member_id
        });
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{transaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
                    <button onClick={onClose} className="btn btn-secondary btn-sm">✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Member *</label>
                            <select
                                className="form-select"
                                value={formData.member_id}
                                onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                                required
                                disabled={transaction} // Disable changing member on edit usually safer, but optional
                            >
                                <option value="" disabled>Select Member</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.member_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Date *</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.transaction_date}
                                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Type *</label>
                            <select
                                className="form-select"
                                value={formData.transaction_type}
                                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                                required
                            >
                                <option value="DEPOSIT">Deposit</option>
                                <option value="WITHDRAWAL">Withdrawal</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Amount (₹) *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea
                                className="form-textarea"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Optional notes..."
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {transaction ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

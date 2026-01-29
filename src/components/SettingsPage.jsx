import { useState, useEffect } from 'react';
import { useMembers } from '../contexts/MemberContext';
import { deleteMember } from '../api';
import ConfirmationModal from './ConfirmationModal';

export default function SettingsPage() {
    const { members, refreshMembers } = useMembers();
    const [newMember, setNewMember] = useState({ code: '', name: '', capital: '', division: 30 });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        isDangerous: false,
        onConfirm: () => { }
    });

    async function handleAddMember(e) {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch('http://localhost:3000/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    member_code: newMember.code,
                    member_name: newMember.name,
                    capital: newMember.capital ? parseFloat(newMember.capital) : 0,
                    capital_division: parseInt(newMember.division) || 30
                })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: `Member ${data.member_name} added successfully!` });
                setNewMember({ code: '', name: '', capital: '', division: 30 });
                refreshMembers();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to add member' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error: ' + error.message });
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteMember = (member) => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Member',
            message: `Are you sure you want to delete member ${member.member_name}? This will archive the member but keep historical data.`,
            confirmLabel: 'Delete Member',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteMember(member.id);
                    setMessage({ type: 'success', text: `Member ${member.member_name} deleted successfully` });
                    refreshMembers();
                } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to delete member: ' + error.message });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div className="page container fade-in">
            <h1>Settings</h1>

            <div className="grid grid-2">
                {/* Add Member Card */}
                <div className="card">
                    <h2>Add New Member</h2>
                    <form onSubmit={handleAddMember}>
                        <div className="form-group">
                            <label className="form-label">Member Code (Short)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. JD"
                                maxLength="5"
                                value={newMember.code}
                                onChange={e => setNewMember({ ...newMember, code: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. John Doe"
                                value={newMember.name}
                                onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Initial Capital (Optional)</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="e.g. 500000"
                                value={newMember.capital}
                                onChange={e => setNewMember({ ...newMember, capital: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Capital Division (Split Logic)</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="e.g. 30"
                                value={newMember.division}
                                onChange={e => setNewMember({ ...newMember, division: e.target.value })}
                            />
                        </div>

                        {message.text && (
                            <div className={`alert alert-${message.type} mb-4`}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Adding...' : 'Add Member'}
                        </button>
                    </form>
                </div>

                {/* Existing Members Card */}
                <div className="card">
                    <h2>Existing Members</h2>
                    {members.length === 0 ? (
                        <p>No members found.</p>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Division</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map(member => (
                                        <tr key={member.id}>
                                            <td><strong>{member.member_code}</strong></td>
                                            <td>{member.member_name}</td>
                                            <td>{member.capital_division}</td>
                                            <td>
                                                <span className="badge badge-success">Active</span>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleDeleteMember(member)}
                                                    className="btn btn-danger btn-sm"
                                                    disabled={loading}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                confirmLabel={confirmation.confirmLabel}
                isDangerous={confirmation.isDangerous}
            />
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function Balances() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [debts, setDebts] = useState([]);
  const [members, setMembers] = useState([]);
  
  // Drill-down state
  const [selectedMember, setSelectedMember] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  
  // Payment Form state
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchBalancesAndData = async () => {
    try {
      const groupsRes = await api.get('/groups');
      const g = groupsRes.data.find(item => item.id === parseInt(id));
      setGroup(g);

      const balancesRes = await api.get(`/groups/${id}/balances`);
      setBalances(balancesRes.data.balances);
      setDebts(balancesRes.data.debts);

      const membersRes = await api.get(`/groups/${id}/members`);
      const activeMembers = membersRes.data.filter(m => !m.leftAt);
      setMembers(activeMembers);

      if (activeMembers.length > 0) {
        if (!fromUserId) setFromUserId(activeMembers[0].userId);
        if (!toUserId) setToUserId(activeMembers[1]?.userId || activeMembers[0].userId);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch balances');
    }
  };

  useEffect(() => {
    fetchBalancesAndData();
  }, [id]);

  useEffect(() => {
    if (selectedMember) {
      fetchDrillDown(selectedMember.userId);
    } else {
      setDrillDownData(null);
    }
  }, [selectedMember]);

  const fetchDrillDown = async (userId) => {
    try {
      const res = await api.get(`/groups/${id}/balances/${userId}`);
      setDrillDownData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch itemized drill-down');
    }
  };

  const handleSettleUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (fromUserId === toUserId) {
      setError('Sender and recipient must be different.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/groups/${id}/payments`, {
        fromUserId: parseInt(fromUserId),
        toUserId: parseInt(toUserId),
        amount: parseFloat(amount),
        date: date || undefined,
        note: note || undefined
      });
      setSuccess('Settlement logged successfully!');
      setAmount('');
      setNote('');
      setDate('');
      fetchBalancesAndData();
      if (selectedMember) {
        fetchDrillDown(selectedMember.userId);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to log payment');
    } finally {
      setLoading(false);
    }
  };

  if (!group) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading balances...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ background: 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Balances & Simplified Debts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Net balance summary, repayments, and itemized transaction sheets for {group.name}
          </p>
        </div>
        <Link to={`/groups/${id}`} className="btn btn-secondary">Back to Expenses</Link>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'hsla(345, 80%, 60%, 0.15)', border: '1px solid var(--color-debit)', color: 'var(--color-debit)', borderRadius: 'var(--border-radius-sm)', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px', background: 'hsla(145, 80%, 45%, 0.15)', border: '1px solid var(--color-credit)', color: 'var(--color-credit)', borderRadius: 'var(--border-radius-sm)', marginBottom: '20px' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: drillDownData ? '1.2fr 1.8fr' : '1fr 1fr', gap: '30px', transition: 'grid-template-columns 0.3s ease' }}>
        {/* Left Column: Balances list & Settle up form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Net Balances list */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Group Balance Summary</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Click any member to inspect their itemized expense sheet
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {balances.map(b => (
                <div 
                  key={b.userId}
                  className="glass-panel"
                  onClick={() => setSelectedMember(b)}
                  style={{
                    padding: '14px',
                    cursor: 'pointer',
                    border: selectedMember?.userId === b.userId ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                    background: selectedMember?.userId === b.userId ? 'var(--accent-glow)' : 'hsla(222, 47%, 4%, 0.2)',
                    transition: 'var(--transition-smooth)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMember?.userId !== b.userId) {
                      e.currentTarget.style.borderColor = 'var(--text-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMember?.userId !== b.userId) {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{b.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.email}</div>
                  </div>
                  <div style={{
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    color: b.netBalance > 0.01 ? 'var(--color-credit)' : b.netBalance < -0.01 ? 'var(--color-debit)' : 'var(--text-primary)'
                  }}>
                    {b.netBalance > 0.01 ? `+₹${b.netBalance.toFixed(2)}` : b.netBalance < -0.01 ? `-₹${Math.abs(b.netBalance).toFixed(2)}` : '₹0.00'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settle Up Repayment form */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Record a Repayment</h3>
            <form onSubmit={handleSettleUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">From (Debtor)</label>
                <select className="form-select" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} required>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">To (Creditor)</label>
                <select className="form-select" value={toUserId} onChange={(e) => setToUserId(e.target.value)} required>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label">Note</label>
                <input
                  type="text"
                  className="form-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Settle Goa flight cost"
                />
              </div>
              <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Logging payment...' : 'Log Settlement Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Simplified debts or Drill-down details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Itemized Drill Down Details */}
          {drillDownData ? (
            <div className="glass-panel glass-panel-glow animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ background: 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Itemized Sheet: {selectedMember?.name}
                </h3>
                <button className="btn btn-secondary" onClick={() => setSelectedMember(null)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                  Close Sheet
                </button>
              </div>

              {drillDownData.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  No active transactions recorded for this member.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '6px' }}>
                  {drillDownData.items.map((item, idx) => (
                    <div key={idx} className="glass-panel" style={{ padding: '12px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsla(222, 47%, 4%, 0.15)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            color: '#fff',
                            background: item.type === 'expense_paid' ? 'hsl(263, 60%, 50%)' :
                                        item.type === 'expense_share' ? 'hsl(200, 60%, 45%)' :
                                        item.type === 'payment_sent' ? 'hsl(145, 60%, 40%)' :
                                        'hsl(345, 60%, 50%)'
                          }}>
                            {item.type === 'expense_paid' ? 'Paid' :
                             item.type === 'expense_share' ? 'Owed Share' :
                             item.type === 'payment_sent' ? 'Sent Pay' : 'Recv Pay'}
                          </span>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{item.description}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <div style={{
                        fontWeight: '600',
                        color: item.direction === 'credit' ? 'var(--color-credit)' : 'var(--color-debit)'
                      }}>
                        {item.direction === 'credit' ? `+₹${parseFloat(item.amount).toFixed(2)}` : `-₹${parseFloat(item.amount).toFixed(2)}`}
                      </div>
                    </div>
                  ))}
                  
                  {/* Totals Summary */}
                  <div style={{ borderTop: '2px solid var(--glass-border)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Net Balance Tally:</span>
                    <span style={{
                      fontWeight: '700',
                      fontSize: '1.25rem',
                      color: drillDownData.netBalance > 0.01 ? 'var(--color-credit)' : drillDownData.netBalance < -0.01 ? 'var(--color-debit)' : 'var(--text-primary)'
                    }}>
                      {drillDownData.netBalance > 0.01 ? `+₹${drillDownData.netBalance.toFixed(2)}` : drillDownData.netBalance < -0.01 ? `-₹${Math.abs(drillDownData.netBalance).toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Simplified Debts List */
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px' }}>Simplified Debts</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Optimal transactions calculated to settle all balances with minimal transfers
              </p>
              {debts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-credit)', fontWeight: '500' }}>
                  ✓ All balances settled! No transfers needed.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {debts.map((debt, idx) => (
                    <div key={idx} className="glass-panel" style={{ padding: '16px', border: '1px solid var(--glass-border)', display: 'flex', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between', background: 'hsla(222, 47%, 4%, 0.15)' }}>
                      <div style={{ fontSize: '0.95rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{debt.fromUserName}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}> owes </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{debt.toUserName}</strong>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '1.15rem', color: 'var(--color-debit)' }}>
                        ₹{debt.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

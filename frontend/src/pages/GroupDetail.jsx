import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Member form state
  const [email, setEmail] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [leftAtDates, setLeftAtDates] = useState({});
  
  // Expense form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [expenseDate, setExpenseDate] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [paidById, setPaidById] = useState('');
  const [splitWithUserIds, setSplitWithUserIds] = useState({}); // userId -> bool
  const [splitDetails, setSplitDetails] = useState({}); // userId -> val (string)

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchGroupDetails = async () => {
    try {
      const groupRes = await api.get('/groups');
      const g = groupRes.data.find(item => item.id === parseInt(id));
      setGroup(g);

      const membersRes = await api.get(`/groups/${id}/members`);
      setMembers(membersRes.data);

      const expensesRes = await api.get(`/groups/${id}/expenses`);
      setExpenses(expensesRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch group details');
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  // Set default values when members are loaded
  useEffect(() => {
    if (members.length > 0) {
      const activeMembers = members.filter(m => !m.leftAt);
      if (activeMembers.length > 0 && !paidById) {
        setPaidById(activeMembers[0].userId);
      }
      
      const defaults = {};
      activeMembers.forEach(m => {
        defaults[m.userId] = true;
      });
      setSplitWithUserIds(prev => ({ ...defaults, ...prev }));
    }
  }, [members]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post(`/groups/${id}/members`, {
        email: email.trim(),
        joinedAt: joinedAt || undefined
      });
      setSuccess(`Member added successfully!`);
      setEmail('');
      setJoinedAt('');
      fetchGroupDetails();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkLeft = async (userId) => {
    const userLeftAt = leftAtDates[userId];
    if (!userLeftAt) {
      setError('Please specify a leave date');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await api.patch(`/groups/${id}/members/${userId}`, {
        leftAt: userLeftAt
      });
      setSuccess('Member marked as left successfully!');
      fetchGroupDetails();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update member status');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const activeSplitUserIds = Object.keys(splitWithUserIds)
      .filter(k => splitWithUserIds[k])
      .map(k => parseInt(k));

    if (activeSplitUserIds.length === 0) {
      setError('Please select at least one member to split the expense with.');
      return;
    }

    const payload = {
      description,
      amount: parseFloat(amount),
      currency,
      exchangeRate: parseFloat(exchangeRate),
      date: expenseDate || undefined,
      splitType,
      paidById: parseInt(paidById),
      splitWithUserIds: activeSplitUserIds
    };

    if (currency === 'USD') {
      payload.amountINR = parseFloat((parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2));
    }

    // Build splitDetails based on split type
    if (splitType !== 'equal') {
      const details = {};
      let totalInput = 0;
      for (const uId of activeSplitUserIds) {
        const val = parseFloat(splitDetails[uId] || 0);
        details[uId] = val;
        totalInput += val;
      }
      payload.splitDetails = details;
    }

    setLoading(true);
    try {
      await api.post(`/groups/${id}/expenses`, payload);
      setSuccess('Expense added successfully!');
      setDescription('');
      setAmount('');
      setCurrency('INR');
      setExchangeRate('1');
      setExpenseDate('');
      setSplitType('equal');
      setSplitDetails({});
      fetchGroupDetails();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  const toggleSplitUser = (userId) => {
    setSplitWithUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleSplitDetailChange = (userId, value) => {
    setSplitDetails(prev => ({
      ...prev,
      [userId]: value
    }));
  };

  if (!group) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading group details...</div>;
  }

  const activeMembers = members.filter(m => !m.leftAt);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ background: 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {group.name}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Group ID: {group.id}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to={`/groups/${id}/balances`} className="btn btn-secondary">View Balances</Link>
          <Link to={`/groups/${id}/import`} className="btn btn-secondary">Import CSV</Link>
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        {/* Members Management Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Add Member Form */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Add Group Member</h3>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label className="form-label">User Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rohan@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Join Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={joinedAt}
                  onChange={(e) => setJoinedAt(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>

          {/* Members List Panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Members ({members.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {members.map(member => (
                <div key={member.id} className="glass-panel" style={{ padding: '14px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{member.name}</span>
                    {member.leftAt ? (
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(345, 80%, 60%, 0.15)', color: 'var(--color-debit)', borderRadius: '12px' }}>Inactive</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(145, 80%, 45%, 0.15)', color: 'var(--color-credit)', borderRadius: '12px' }}>Active</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email: {member.email}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Joined: {new Date(member.joinedAt).toLocaleDateString()}
                  </div>
                  {member.leftAt && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-debit)' }}>
                      Left: {new Date(member.leftAt).toLocaleDateString()}
                    </div>
                  )}

                  {!member.leftAt && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input
                        type="date"
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                        value={leftAtDates[member.userId] || ''}
                        onChange={(e) => setLeftAtDates({ ...leftAtDates, [member.userId]: e.target.value })}
                      />
                      <button className="btn btn-secondary" onClick={() => handleMarkLeft(member.userId)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                        Set Left
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expenses List & Form Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Add Expense Form */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px', background: 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Add New Expense
            </h3>
            <form onSubmit={handleCreateExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Swiggy Dinner"
                    required
                  />
                </div>
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
                <label className="form-label">Paid By</label>
                <select className="form-select" value={paidById} onChange={(e) => setPaidById(e.target.value)} required>
                  {activeMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)} required>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              {currency === 'USD' ? (
                <div className="form-group">
                  <label className="form-label">Exchange Rate (1 USD = ? INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Expense Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              )}

              {currency === 'USD' && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Expense Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Split Type</label>
                <select className="form-select" value={splitType} onChange={(e) => setSplitType(e.target.value)} required>
                  <option value="equal">Split Equally</option>
                  <option value="unequal">Split Unequally (Exact amounts)</option>
                  <option value="percentage">Split by Percentage (%)</option>
                  <option value="share">Split by Shares (Ratios)</option>
                </select>
              </div>

              {/* Dynamic split selections */}
              <div className="glass-panel" style={{ gridColumn: 'span 2', padding: '16px', background: 'hsla(222, 47%, 4%, 0.3)' }}>
                <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Split With</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeMembers.map(m => (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!splitWithUserIds[m.userId]}
                          onChange={() => toggleSplitUser(m.userId)}
                          style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                        />
                        <span>{m.name}</span>
                      </label>
                      
                      {/* Sub-inputs for custom split types */}
                      {splitWithUserIds[m.userId] && splitType !== 'equal' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={splitType === 'unequal' ? '₹0.00' : splitType === 'percentage' ? '0%' : '1 share'}
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100px', textAlign: 'right' }}
                            value={splitDetails[m.userId] || ''}
                            onChange={(e) => handleSplitDetailChange(m.userId, e.target.value)}
                            required
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {splitType === 'unequal' ? 'INR' : splitType === 'percentage' ? '%' : 'shares'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Adding Expense...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>

          {/* Expenses List Panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>Expense History</h3>
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                No expenses logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {expenses.map(exp => {
                  const payer = members.find(m => m.userId === exp.paidById);
                  return (
                    <div key={exp.id} className="glass-panel" style={{ padding: '16px', border: '1px solid var(--glass-border)', background: 'hsla(222, 47%, 4%, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ color: 'var(--text-primary)' }}>{exp.description}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Paid by {payer ? payer.name : 'Unknown'} • {new Date(exp.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                            ₹{parseFloat(exp.amountINR).toFixed(2)}
                          </div>
                          {exp.currency !== 'INR' && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {parseFloat(exp.amount).toFixed(2)} {exp.currency} (1 USD = ₹{parseFloat(exp.exchangeRate).toFixed(2)})
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--accent-secondary)', fontWeight: '500' }}>
                          Split ({exp.splitType}):
                        </span>
                        {exp.shares && exp.shares.map(share => {
                          const user = members.find(m => m.userId === share.userId);
                          return (
                            <span key={share.id} style={{ color: 'var(--text-secondary)' }}>
                              {user ? user.name : 'Unknown'}: <strong style={{ color: 'var(--text-primary)' }}>₹{parseFloat(share.shareAmount).toFixed(2)}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [leftAtDates, setLeftAtDates] = useState({});
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
    } catch (err) {
      console.error(err);
      setError('Failed to fetch group details');
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

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

  if (!group) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading group details...</div>;
  }

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
            <h3 style={{ marginBottom: '16px' }}>Current Members ({members.length})</h3>
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

        {/* Expenses List Column Placeholder */}
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px' }}>Expenses & Splits</h3>
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <p>Expense list will be integrated in the next step!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

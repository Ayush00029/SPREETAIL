import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch groups');
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/groups', { name });
      setGroups([...groups, res.data]);
      setName('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
      {/* Create Group Card */}
      <div className="glass-panel" style={{ height: 'fit-content' }}>
        <h3 style={{ marginBottom: '20px', background: 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Create New Group
        </h3>
        {error && (
          <div style={{ padding: '10px', background: 'hsla(345, 80%, 60%, 0.15)', border: '1px solid var(--color-debit)', color: 'var(--color-debit)', borderRadius: 'var(--border-radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flatmates 2026"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>

      {/* Groups List */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '20px' }}>My Expense Groups</h3>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '16px' }}>You are not part of any groups yet.</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Create a new group on the left to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {groups.map(group => (
              <Link to={`/groups/${group.id}`} key={group.id} className="glass-panel" style={{ display: 'block', padding: '20px', textDecoration: 'none', border: '1px solid var(--glass-border)', transition: 'var(--transition-smooth)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{group.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Created on {new Date(group.createdAt).toLocaleDateString()}
                </p>
                <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>View Details</span>
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

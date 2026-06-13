import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ImportPage() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // States to handle user review inputs per log
  const [payerSelections, setPayerSelections] = useState({});
  const [dateOverrides, setDateOverrides] = useState({});

  const fetchGroupAndReport = async () => {
    try {
      const groupsRes = await api.get('/groups');
      const g = groupsRes.data.find(item => item.id === parseInt(id));
      setGroup(g);

      const membersRes = await api.get(`/groups/${id}/members`);
      setMembers(membersRes.data);

      const reportRes = await api.get(`/groups/${id}/import-report`);
      setReport(reportRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGroupAndReport();
  }, [id]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/groups/${id}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess('CSV file parsed and imported successfully! Clean rows have been applied immediately.');
      setFile(null);
      document.getElementById('csv-file-input').value = '';
      fetchGroupAndReport();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload and import CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveLog = async (logId, status) => {
    setError('');
    setSuccess('');
    
    const payload = { status };
    
    if (status === 'applied') {
      const payerName = payerSelections[logId];
      const dateOverride = dateOverrides[logId];
      if (payerName) payload.payerName = payerName;
      if (dateOverride) payload.dateOverride = dateOverride;
    }

    try {
      const res = await api.patch(`/import-logs/${logId}`, payload);
      setSuccess(res.data.message || 'Row status updated successfully!');
      fetchGroupAndReport();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to resolve import log entry');
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
            Import Expenses for {group.name}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Upload your spreadsheet export containing historical shared expenses
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

      {/* Upload Box */}
      <div className="glass-panel" style={{ marginBottom: '40px' }}>
        <h3 style={{ marginBottom: '16px' }}>Upload Expenses CSV</h3>
        <form onSubmit={handleUpload} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <input
              type="file"
              id="csv-file-input"
              accept=".csv"
              onChange={handleFileChange}
              className="form-input"
              style={{ width: '100%', padding: '10px' }}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 32px' }}>
            {loading ? 'Importing...' : 'Upload & Process'}
          </button>
        </form>
      </div>

      {/* Import Report Log Table */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '16px' }}>CSV Import Report Log</h3>
        {report.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
            No import logs available. Upload a CSV file to inspect row anomalies.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Description</th>
                  <th>Anomaly Type</th>
                  <th>Resolution / Action</th>
                  <th>Status</th>
                  <th>User Review Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.map(log => {
                  const raw = log.rawRow || {};
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: '500' }}>#{log.rowNumber}</td>
                      <td>{raw.description || 'Unknown'}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(215, 20%, 30%, 0.2)', color: 'var(--text-primary)', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          {log.anomalyType}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{log.action}</td>
                      <td>
                        {log.status === 'applied' && (
                          <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(145, 80%, 45%, 0.15)', color: 'var(--color-credit)', borderRadius: '12px' }}>Applied</span>
                        )}
                        {log.status === 'pending_review' && (
                          <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(40, 80%, 55%, 0.15)', color: 'var(--color-pending)', borderRadius: '12px' }}>Pending Review</span>
                        )}
                        {log.status === 'rejected' && (
                          <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'hsla(345, 80%, 60%, 0.15)', color: 'var(--color-debit)', borderRadius: '12px' }}>Rejected</span>
                        )}
                      </td>
                      <td>
                        {log.status === 'pending_review' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* 1. Missing paid_by input override */}
                            {log.anomalyType === 'MISSING_PAID_BY' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Who paid this?</span>
                                <select 
                                  className="form-select" 
                                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  value={payerSelections[log.id] || ''}
                                  onChange={(e) => setPayerSelections({ ...payerSelections, [log.id]: e.target.value })}
                                >
                                  <option value="">-- Select Member --</option>
                                  {members.map(m => (
                                    <option key={m.userId} value={m.name}>{m.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* 2. Ambiguous date input override */}
                            {log.anomalyType === 'AMBIGUOUS_DATE' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select correct date:</span>
                                <input 
                                  type="date"
                                  className="form-input"
                                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  value={dateOverrides[log.id] || ''}
                                  onChange={(e) => setDateOverrides({ ...dateOverrides, [log.id]: e.target.value })}
                                />
                              </div>
                            )}

                            {/* Approve/Reject Buttons */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1 }}
                                onClick={() => handleResolveLog(log.id, 'applied')}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1 }}
                                onClick={() => handleResolveLog(log.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resolved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import ImportPage from './pages/ImportPage';
import Balances from './pages/Balances';

// Persistent Navigation Header
function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!user) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Get active groupId from location path
  const groupMatch = location.pathname.match(/\/groups\/(\d+)/);
  const groupId = groupMatch ? groupMatch[1] : null;

  return (
    <header className="header-bar">
      <div className="header-nav">
        <Link to="/groups" className="logo">Spreetail Split</Link>
        <nav className="nav-links">
          {groupId && (
            <>
              <Link to={`/groups/${groupId}`} className={`nav-link ${location.pathname === `/groups/${groupId}` ? 'active' : ''}`}>Expenses</Link>
              <Link to={`/groups/${groupId}/balances`} className={`nav-link ${location.pathname.endsWith('/balances') ? 'active' : ''}`}>Balances</Link>
              <Link to={`/groups/${groupId}/import`} className={`nav-link ${location.pathname.endsWith('/import') ? 'active' : ''}`}>Import CSV</Link>
            </>
          )}
          <Link to="/groups" className={`nav-link ${location.pathname === '/groups' ? 'active' : ''}`}>My Groups</Link>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>|</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>Hi, {user.name}</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Logout</button>
        </nav>
      </div>
    </header>
  );
}

// Protected Route Guard
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/groups" element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            } />
            <Route path="/groups/:id" element={
              <ProtectedRoute>
                <GroupDetail />
              </ProtectedRoute>
            } />
            <Route path="/groups/:id/import" element={
              <ProtectedRoute>
                <ImportPage />
              </ProtectedRoute>
            } />
            <Route path="/groups/:id/balances" element={
              <ProtectedRoute>
                <Balances />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

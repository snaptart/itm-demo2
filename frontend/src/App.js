import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import authService from './services/authService';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        {user && (
          <header className="app-header">
            <div className="header-content">
              <h1>RinkFinder</h1>
              <nav className="nav-menu">
                <a href="/dashboard">Dashboard</a>
                <a href="/facilities">Facilities</a>
                <a href="/calendar">Calendar</a>
                <a href="/bookings">Bookings</a>
              </nav>
              <div className="user-info">
                <span className="welcome-text">
                  Welcome, {user.first_name || user.username}!
                </span>
                <span className="user-type">({user.user_type})</span>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>
          </header>
        )}
        
        <main className="app-main">
          <Routes>
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginForm onLoginSuccess={handleLoginSuccess} />
                )
              } 
            />
            
            <Route 
              path="/dashboard" 
              element={
                user ? (
                  <DashboardPage />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/" 
              element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
            />
            
            {/* Placeholder routes for future pages */}
            <Route 
              path="/facilities/*" 
              element={
                user ? (
                  <div style={{ padding: '40px' }}>
                    <h2>Facilities Management</h2>
                    <p>Facility management features coming soon...</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/calendar" 
              element={
                user ? (
                  <CalendarPage />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/bookings" 
              element={
                user ? (
                  <div style={{ padding: '40px' }}>
                    <h2>Bookings</h2>
                    <p>Booking management features coming soon...</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/programs" 
              element={
                user ? (
                  <div style={{ padding: '40px' }}>
                    <h2>Programs</h2>
                    <p>Program management features coming soon...</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/notifications" 
              element={
                user ? (
                  <div style={{ padding: '40px' }}>
                    <h2>Notifications</h2>
                    <p>Notification features coming soon...</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="/reports" 
              element={
                user && user.user_type === 'admin' ? (
                  <div style={{ padding: '40px' }}>
                    <h2>Reports</h2>
                    <p>Reporting features coming soon...</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            <Route 
              path="*" 
              element={
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <h2>404 - Page Not Found</h2>
                  <p>The page you're looking for doesn't exist.</p>
                  <a href="/">Go to Home</a>
                </div>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
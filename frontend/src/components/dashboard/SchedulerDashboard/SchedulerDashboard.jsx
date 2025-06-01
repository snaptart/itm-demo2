import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import authService from '../../../services/authService';
import './SchedulerDashboard.css';

function SchedulerDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const schedulerActions = [
    {
      title: 'Browse Available Ice Time',
      description: 'View and request available ice time slots',
      icon: '🔍',
      action: () => navigate('/calendar'),
      color: 'blue'
    },
    {
      title: 'My Bookings',
      description: 'View and manage your ice time bookings',
      icon: '📋',
      action: () => navigate('/bookings'),
      color: 'green'
    },
    {
      title: 'Programs',
      description: 'Manage your skating programs',
      icon: '⛸️',
      action: () => navigate('/programs'),
      color: 'purple'
    },
    {
      title: 'Notifications',
      description: 'View booking updates and messages',
      icon: '🔔',
      action: () => navigate('/notifications'),
      color: 'orange'
    }
  ];

  return (
    <div className="scheduler-dashboard">
      <div className="dashboard-header">
        <h1>Program Scheduler Dashboard</h1>
        <p className="welcome-message">
          Welcome back, {currentUser?.first_name || currentUser?.username}!
        </p>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      <div className="scheduler-actions">
        {schedulerActions.map((action, index) => (
          <div 
            key={index} 
            className={`scheduler-action-card ${action.color}`}
            onClick={action.action}
          >
            <div className="action-icon">{action.icon}</div>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Upcoming Bookings</h2>
          <div className="placeholder-content">
            <p>Your upcoming ice time bookings will appear here once the booking system is implemented.</p>
          </div>
        </div>

        <div className="dashboard-section">
          <h2>Recent Activity</h2>
          <div className="placeholder-content">
            <p>Recent booking requests and updates will be displayed here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchedulerDashboard;
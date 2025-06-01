import React from 'react';
import './DashboardStats.css';

function DashboardStats({ stats }) {
  const statCards = [
    {
      title: 'Total Facilities',
      value: stats.totalFacilities || 0,
      icon: '🏢',
      color: 'blue',
      description: 'Active facilities'
    },
    {
      title: 'Active Resources',
      value: stats.activeResources || 0,
      icon: '⛸️',
      color: 'green',
      description: 'Available rinks'
    },
    {
      title: 'Pending Bookings',
      value: stats.pendingBookings || 0,
      icon: '⏳',
      color: 'orange',
      description: 'Awaiting approval'
    },
    {
      title: "Today's Bookings",
      value: stats.todaysBookings || 0,
      icon: '📅',
      color: 'purple',
      description: 'Scheduled today'
    }
  ];

  return (
    <div className="dashboard-stats">
      {statCards.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.color}`}>
          <div className="stat-icon">{stat.icon}</div>
          <div className="stat-content">
            <h3 className="stat-value">{stat.value}</h3>
            <p className="stat-title">{stat.title}</p>
            <p className="stat-description">{stat.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DashboardStats;
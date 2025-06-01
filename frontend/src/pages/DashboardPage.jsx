import React from 'react';
import AdminDashboard from '../components/dashboard/AdminDashboard/AdminDashboard';
import SchedulerDashboard from '../components/dashboard/SchedulerDashboard/SchedulerDashboard';
import authService from '../services/authService';

function DashboardPage() {
  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Please log in to view the dashboard.</p>
      </div>
    );
  }

  // Render appropriate dashboard based on user type
  if (currentUser.user_type === 'admin') {
    return <AdminDashboard />;
  } else if (currentUser.user_type === 'scheduler') {
    return <SchedulerDashboard />;
  }

  // Fallback for unknown user types
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p>Unknown user type. Please contact support.</p>
    </div>
  );
}

export default DashboardPage;
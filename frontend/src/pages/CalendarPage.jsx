import React from 'react';
import CalendarView from '../components/calendar/CalendarView/CalendarView';
import authService from '../services/authService';

function CalendarPage() {
  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Please log in to view the calendar.</p>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <CalendarView />
    </div>
  );
}

export default CalendarPage;
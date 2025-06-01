import React from 'react';
import './CalendarHeader.css';

function CalendarHeader({ 
  currentDate, 
  viewType, 
  onViewChange, 
  onPrevious, 
  onNext, 
  onToday 
}) {
  const formatDateRange = () => {
    const options = { year: 'numeric', month: 'long' };
    
    if (viewType === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
      } else {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    } else {
      return currentDate.toLocaleDateString('en-US', options);
    }
  };

  return (
    <div className="calendar-header">
      <div className="calendar-navigation">
        <button 
          className="nav-button"
          onClick={onPrevious}
          aria-label="Previous period"
        >
          ◀
        </button>
        
        <button 
          className="nav-button today-button"
          onClick={onToday}
        >
          Today
        </button>
        
        <button 
          className="nav-button"
          onClick={onNext}
          aria-label="Next period"
        >
          ▶
        </button>
        
        <h2 className="current-period">{formatDateRange()}</h2>
      </div>

      <div className="view-selector">
        <button
          className={`view-button ${viewType === 'week' ? 'active' : ''}`}
          onClick={() => onViewChange('week')}
        >
          Week
        </button>
        <button
          className={`view-button ${viewType === 'month' ? 'active' : ''}`}
          onClick={() => onViewChange('month')}
        >
          Month
        </button>
      </div>
    </div>
  );
}

export default CalendarHeader;
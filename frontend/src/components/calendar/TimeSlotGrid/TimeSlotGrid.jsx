import React from 'react';
import EpisodeCard from '../EpisodeCard/EpisodeCard';
import './TimeSlotGrid.css';

function TimeSlotGrid({ 
  viewType, 
  currentDate, 
  resources, 
  episodes, 
  facility,
  onTimeSlotClick,
  onEpisodeClick,
  isAdmin
}) {
  // Generate time slots for the facility
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = parseInt(facility?.facility_daily_start_time?.split(':')[0] || 6);
    const endHour = parseInt(facility?.facility_daily_end_time?.split(':')[0] || 23);
    
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour}:00`);
    }
    
    return slots;
  };

  // Generate days for the view
  const generateDays = () => {
    const days = [];
    const startDate = new Date(currentDate);
    
    if (viewType === 'week') {
      // Start from Sunday
      startDate.setDate(currentDate.getDate() - currentDate.getDay());
      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
      }
    } else {
      // Month view - get all days in the month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
    }
    
    return days;
  };

  // Find episodes for a specific time slot
  const findEpisodesForSlot = (date, timeSlot, resourceId) => {
    return episodes.filter(episode => {
      const episodeDate = new Date(episode.episode_start_date_time);
      const episodeHour = episodeDate.getHours();
      const slotHour = parseInt(timeSlot.split(':')[0]);
      
      return (
        episode.resource_id === resourceId &&
        episodeDate.toDateString() === date.toDateString() &&
        episodeHour === slotHour
      );
    });
  };

  const timeSlots = generateTimeSlots();
  const days = generateDays();

  const formatDayHeader = (date) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (viewType === 'week') {
    return (
      <div className="time-slot-grid week-view">
        <div className="grid-header">
          <div className="time-column-header">Time</div>
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`day-header ${isToday(day) ? 'today' : ''}`}
            >
              {formatDayHeader(day)}
            </div>
          ))}
        </div>
        
        <div className="grid-body">
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeIndex} className="time-row">
              <div className="time-label">{timeSlot}</div>
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="day-column">
                  {resources.map((resource) => {
                    const slotEpisodes = findEpisodesForSlot(day, timeSlot, resource.resource_id);
                    
                    return (
                      <div 
                        key={resource.resource_id}
                        className={`resource-slot ${slotEpisodes.length > 0 ? 'has-episode' : ''}`}
                        onClick={() => !slotEpisodes.length && isAdmin && onTimeSlotClick(day, timeSlot, resource)}
                      >
                        {slotEpisodes.length > 0 ? (
                          slotEpisodes.map(episode => (
                            <EpisodeCard
                              key={episode.episode_id}
                              episode={episode}
                              resource={resource}
                              onClick={() => onEpisodeClick(episode)}
                              isCompact={true}
                            />
                          ))
                        ) : (
                          <div className="empty-slot">
                            <span className="resource-name">{resource.resource_name}</span>
                            {isAdmin && <span className="add-icon">+</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // Month view - simplified
    return (
      <div className="time-slot-grid month-view">
        <div className="month-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="month-day-header">{day}</div>
          ))}
          
          {/* Add empty cells for alignment */}
          {Array(days[0].getDay()).fill(null).map((_, index) => (
            <div key={`empty-${index}`} className="month-day empty"></div>
          ))}
          
          {days.map((day, index) => {
            const dayEpisodes = episodes.filter(episode => {
              const episodeDate = new Date(episode.episode_start_date_time);
              return episodeDate.toDateString() === day.toDateString();
            });
            
            return (
              <div 
                key={index} 
                className={`month-day ${isToday(day) ? 'today' : ''}`}
              >
                <div className="day-number">{day.getDate()}</div>
                <div className="day-episodes">
                  {dayEpisodes.slice(0, 3).map(episode => (
                    <div 
                      key={episode.episode_id}
                      className={`month-episode ${episode.episode_status}`}
                      onClick={() => onEpisodeClick(episode)}
                      title={`${episode.episode_title || 'Ice Time'} - ${episode.resource_name}`}
                    >
                      {new Date(episode.episode_start_date_time).toLocaleTimeString('en-US', { 
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  ))}
                  {dayEpisodes.length > 3 && (
                    <div className="more-episodes">+{dayEpisodes.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

export default TimeSlotGrid;
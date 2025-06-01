import React from 'react';
import './EpisodeCard.css';

function EpisodeCard({ episode, resource, onClick, isCompact = false }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusClass = () => {
    switch (episode.episode_status) {
      case 'available':
        return 'status-available';
      case 'pending':
        return 'status-pending';
      case 'booked':
        return 'status-booked';
      case 'maintenance':
        return 'status-maintenance';
      default:
        return '';
    }
  };

  const getStatusLabel = () => {
    switch (episode.episode_status) {
      case 'available':
        return 'Available';
      case 'pending':
        return 'Pending';
      case 'booked':
        return 'Booked';
      case 'maintenance':
        return 'Maintenance';
      default:
        return episode.episode_status;
    }
  };

  if (isCompact) {
    return (
      <div 
        className={`episode-card compact ${getStatusClass()}`}
        onClick={onClick}
      >
        <div className="episode-time">
          {formatTime(episode.episode_start_date_time)}
        </div>
        <div className="episode-title">
          {episode.episode_title || 'Ice Time'}
        </div>
        {episode.program_name && (
          <div className="episode-program">{episode.program_name}</div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`episode-card ${getStatusClass()}`}
      onClick={onClick}
    >
      <div className="episode-header">
        <h4 className="episode-title">
          {episode.episode_title || 'Ice Time'}
        </h4>
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusLabel()}
        </span>
      </div>
      
      <div className="episode-details">
        <div className="detail-item">
          <span className="detail-icon">⏰</span>
          <span>
            {formatTime(episode.episode_start_date_time)} - {formatTime(episode.episode_end_date_time)}
          </span>
        </div>
        
        <div className="detail-item">
          <span className="detail-icon">⛸️</span>
          <span>{resource?.resource_name || 'Rink'}</span>
        </div>
        
        {episode.program_name && (
          <div className="detail-item">
            <span className="detail-icon">👥</span>
            <span>{episode.program_name}</span>
          </div>
        )}
        
        {episode.episode_price && (
          <div className="detail-item">
            <span className="detail-icon">💵</span>
            <span>${episode.episode_price}/hour</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default EpisodeCard;
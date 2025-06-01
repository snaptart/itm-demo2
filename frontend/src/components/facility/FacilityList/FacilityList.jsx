import React from 'react';
import './FacilityList.css';

function FacilityList({ 
  facilities, 
  onViewDetails, 
  onManageResources, 
  onEdit,
  onDelete,
  isCompact = false 
}) {
  
  const handleViewDetails = (facility) => {
    if (onViewDetails) {
      onViewDetails(facility);
    }
  };

  const handleManageResources = (e, facility) => {
    e.stopPropagation();
    if (onManageResources) {
      onManageResources(facility);
    }
  };

  const handleEdit = (e, facility) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(facility);
    }
  };

  const handleDelete = (e, facility) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(facility);
    }
  };

  return (
    <div className={`facility-list ${isCompact ? 'compact' : ''}`}>
      {facilities.map((facility) => (
        <div 
          key={facility.facility_id} 
          className="facility-card"
          onClick={() => handleViewDetails(facility)}
        >
          <div className="facility-header">
            <h3 className="facility-name">{facility.facility_name}</h3>
            <span className="resource-count">
              {facility.resources?.length || 0} rinks
            </span>
          </div>
          
          <div className="facility-info">
            <p className="facility-address">
              {facility.facility_address_1}
              {facility.facility_address_2 && <><br />{facility.facility_address_2}</>}
              <br />
              {facility.facility_city}, {facility.facility_state} {facility.facility_postal_code}
            </p>
            
            {facility.adminUser && (
              <p className="facility-admin">
                <span className="label">Administrator:</span> {facility.adminUser.first_name} {facility.adminUser.last_name}
              </p>
            )}
          </div>

          <div className="facility-details">
            <div className="detail-item">
              <span className="label">Hours:</span>
              <span className="value">
                {facility.facility_daily_start_time || '6:00 AM'} - {facility.facility_daily_end_time || '11:00 PM'}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Time Zone:</span>
              <span className="value">{facility.facility_time_zone || 'America/Chicago'}</span>
            </div>
          </div>

          <div className="facility-actions">
            <button 
              className="action-btn primary"
              onClick={(e) => handleManageResources(e, facility)}
            >
              Manage Resources
            </button>
            {!isCompact && (
              <>
                <button 
                  className="action-btn"
                  onClick={(e) => handleEdit(e, facility)}
                >
                  Edit
                </button>
                <button 
                  className="action-btn danger"
                  onClick={(e) => handleDelete(e, facility)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FacilityList;
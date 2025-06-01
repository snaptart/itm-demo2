import React, { useState } from 'react';
import './CalendarSidebar.css';

function CalendarSidebar({ 
  facilities, 
  resources, 
  selectedFacility, 
  selectedResources,
  onFacilityChange,
  onResourceToggle,
  isAdmin 
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSelectAllResources = () => {
    const allResourceIds = resources.map(r => r.id);
    allResourceIds.forEach(id => {
      if (!selectedResources.includes(id)) {
        onResourceToggle(id);
      }
    });
  };

  const handleDeselectAllResources = () => {
    selectedResources.forEach(id => {
      onResourceToggle(id);
    });
  };

  const areAllResourcesSelected = resources.length > 0 && 
    resources.every(r => selectedResources.includes(r.id));

  return (
    <div className={`calendar-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      {!isCollapsed && (
        <>
          <div className="sidebar-section">
            <h3>Facility</h3>
            <select 
              className="facility-select"
              value={selectedFacility?.facility_id || ''}
              onChange={(e) => {
                const facility = facilities.find(f => f.facility_id === parseInt(e.target.value));
                onFacilityChange(facility);
              }}
            >
              <option value="">Select a facility...</option>
              {facilities.map(facility => (
                <option key={facility.facility_id} value={facility.facility_id}>
                  {facility.facility_name}
                </option>
              ))}
            </select>
          </div>

          {selectedFacility && resources.length > 0 && (
            <div className="sidebar-section">
              <div className="section-header">
                <h3>Rinks</h3>
                <div className="resource-actions">
                  {areAllResourcesSelected ? (
                    <button 
                      className="select-all-btn"
                      onClick={handleDeselectAllResources}
                    >
                      Deselect All
                    </button>
                  ) : (
                    <button 
                      className="select-all-btn"
                      onClick={handleSelectAllResources}
                    >
                      Select All
                    </button>
                  )}
                </div>
              </div>
              
              <div className="resource-list">
                {resources.map(resource => (
                  <label key={resource.id} className="resource-item">
                    <input
                      type="checkbox"
                      checked={selectedResources.includes(resource.id)}
                      onChange={() => onResourceToggle(resource.id)}
                    />
                    <span className="resource-name">{resource.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedFacility && (
            <div className="sidebar-section">
              <h3>Facility Info</h3>
              <div className="facility-info">
                <p>
                  <strong>Address:</strong><br />
                  {selectedFacility.facility_address_1}<br />
                  {selectedFacility.facility_city}, {selectedFacility.facility_state} {selectedFacility.facility_postal_code}
                </p>
                <p>
                  <strong>Hours:</strong><br />
                  {selectedFacility.facility_daily_start_time || '6:00 AM'} - {selectedFacility.facility_daily_end_time || '11:00 PM'}
                </p>
                <p>
                  <strong>Time Zone:</strong><br />
                  {selectedFacility.facility_time_zone || 'America/Chicago'}
                </p>
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <h3>Quick Filters</h3>
            <div className="quick-filters">
              <button className="filter-btn active">All Ice Time</button>
              <button className="filter-btn">Available Only</button>
              {isAdmin && (
                <>
                  <button className="filter-btn">Pending Approval</button>
                  <button className="filter-btn">Maintenance</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CalendarSidebar;
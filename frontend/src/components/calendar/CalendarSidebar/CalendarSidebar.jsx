// frontend/src/components/calendar/CalendarSidebar/CalendarSidebar.jsx - Enhanced for Schedulers
import React, { useState } from 'react';
import './CalendarSidebar.css';

function CalendarSidebar({ 
  facilities, 
  resources, 
  selectedFacility, 
  selectedResources,
  onFacilityChange,
  onResourceToggle,
  isAdmin,
  isScheduler,
  viewFilters,
  onFilterChange,
  userPrograms,
  selectedProgram,
  onProgramChange
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
          {/* Program Selection for Schedulers */}
          {isScheduler && userPrograms && userPrograms.length > 0 && (
            <div className="sidebar-section">
              <h3>Program</h3>
              <select 
                className="program-select"
                value={selectedProgram?.program_id || ''}
                onChange={(e) => {
                  const program = userPrograms.find(p => p.program_id === parseInt(e.target.value));
                  onProgramChange(program);
                }}
              >
                <option value="">Select a program...</option>
                {userPrograms.map(program => (
                  <option key={program.program_id} value={program.program_id}>
                    {program.program_name}
                  </option>
                ))}
              </select>
              {selectedProgram && (
                <div className="program-info">
                  <p><strong>Type:</strong> {selectedProgram.programType?.program_type_name || 'N/A'}</p>
                  <p><strong>Admin:</strong> {selectedProgram.adminUser?.first_name} {selectedProgram.adminUser?.last_name}</p>
                </div>
              )}
            </div>
          )}

          {/* Facility Selection */}
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

          {/* Resource Selection */}
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

          {/* Facility Info */}
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

          {/* View Filters */}
          <div className="sidebar-section">
            <h3>View Filters</h3>
            <div className="view-filters">
              {isScheduler ? (
                <>
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={viewFilters?.showPublicAvailable || false}
                      onChange={(e) => onFilterChange('showPublicAvailable', e.target.checked)}
                    />
                    <span className="filter-label">
                      <span className="filter-color available"></span>
                      Public Available Ice
                    </span>
                  </label>
                  
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={viewFilters?.showAssignedToMe || false}
                      onChange={(e) => onFilterChange('showAssignedToMe', e.target.checked)}
                    />
                    <span className="filter-label">
                      <span className="filter-color assigned"></span>
                      Assigned to Me
                    </span>
                  </label>
                  
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={viewFilters?.showMyBookings || false}
                      onChange={(e) => onFilterChange('showMyBookings', e.target.checked)}
                    />
                    <span className="filter-label">
                      <span className="filter-color booked"></span>
                      My Confirmed Bookings
                    </span>
                  </label>
                  
                  <label className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={viewFilters?.showOtherBookings || false}
                      onChange={(e) => onFilterChange('showOtherBookings', e.target.checked)}
                    />
                    <span className="filter-label">
                      <span className="filter-color other-bookings"></span>
                      Other Program Bookings
                    </span>
                  </label>
                </>
              ) : (
                <>
                  <button className="filter-btn active">All Ice Time</button>
                  <button className="filter-btn">Available Only</button>
                  {isAdmin && (
                    <>
                      <button className="filter-btn">Pending Approval</button>
                      <button className="filter-btn">Maintenance</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="sidebar-section">
            <h3>Legend</h3>
            <div className="legend-items">
              {isScheduler ? (
                <>
                  <div className="legend-item">
                    <span className="legend-color available"></span>
                    <span>Available to Request</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color assigned"></span>
                    <span>Assigned to My Program</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color pending"></span>
                    <span>Request Pending</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color booked"></span>
                    <span>Confirmed Booking</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color in-cart"></span>
                    <span>In Shopping Cart</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="legend-item">
                    <span className="legend-color available"></span>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color assigned"></span>
                    <span>Assigned</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color booked"></span>
                    <span>Booked</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color maintenance"></span>
                    <span>Maintenance</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shopping Cart Help for Schedulers */}
          {isScheduler && (
            <div className="sidebar-section">
              <h3>How to Request Ice</h3>
              <div className="help-content">
                <ol>
                  <li>Click available ice slots to add to cart</li>
                  <li>Review items in shopping cart</li>
                  <li>Submit all requests at once</li>
                  <li>Wait for arena admin approval</li>
                </ol>
                <p className="help-note">
                  💡 Green slots are available to all programs. Yellow slots are assigned specifically to your program.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CalendarSidebar;
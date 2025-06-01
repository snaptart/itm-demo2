import React from 'react';
import './FacilitySelector.css';

function FacilitySelector({ facilities, selectedFacility, onFacilityChange }) {
  return (
    <div className="facility-selector">
      <h3>Select Facility</h3>
      <select 
        value={selectedFacility?.facility_id || ''} 
        onChange={(e) => {
          const facility = facilities.find(f => f.facility_id === parseInt(e.target.value));
          onFacilityChange(facility);
        }}
        className="facility-dropdown"
      >
        <option value="">Select a facility...</option>
        {facilities.map(facility => (
          <option key={facility.facility_id} value={facility.facility_id}>
            {facility.facility_name}
          </option>
        ))}
      </select>
      
      {selectedFacility && (
        <div className="facility-info">
          <p className="facility-address">
            {selectedFacility.facility_city}, {selectedFacility.facility_state}
          </p>
          <p className="facility-hours">
            Hours: {selectedFacility.facility_daily_start_time || '6:00 AM'} - {selectedFacility.facility_daily_end_time || '11:00 PM'}
          </p>
        </div>
      )}
    </div>
  );
}

export default FacilitySelector;
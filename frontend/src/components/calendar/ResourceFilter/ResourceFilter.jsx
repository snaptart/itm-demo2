import React from 'react';
import './ResourceFilter.css';

function ResourceFilter({ resources, selectedResources, onResourceToggle }) {
  const handleSelectAll = () => {
    const allResourceIds = resources.map(r => r.resource_id);
    allResourceIds.forEach(id => {
      if (!selectedResources.includes(id)) {
        onResourceToggle(id);
      }
    });
  };

  const handleClearAll = () => {
    selectedResources.forEach(id => {
      onResourceToggle(id);
    });
  };

  return (
    <div className="resource-filter">
      <div className="filter-header">
        <h3>Rinks</h3>
        <div className="filter-actions">
          <button 
            className="filter-action-btn"
            onClick={handleSelectAll}
          >
            All
          </button>
          <button 
            className="filter-action-btn"
            onClick={handleClearAll}
          >
            None
          </button>
        </div>
      </div>
      
      <div className="resource-list">
        {resources.map(resource => (
          <label key={resource.resource_id} className="resource-item">
            <input
              type="checkbox"
              checked={selectedResources.includes(resource.resource_id)}
              onChange={() => onResourceToggle(resource.resource_id)}
              className="resource-checkbox"
            />
            <span className="resource-label">
              {resource.resource_name}
              {resource.resource_status !== 'active' && (
                <span className="status-badge">{resource.resource_status}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default ResourceFilter;
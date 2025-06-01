import React, { useState, useEffect } from 'react';
import TimeSlotGrid from '../TimeSlotGrid/TimeSlotGrid';
import CalendarHeader from '../CalendarHeader/CalendarHeader';
import FacilitySelector from '../FacilitySelector/FacilitySelector';
import ResourceFilter from '../ResourceFilter/ResourceFilter';
import EpisodeModal from '../EpisodeModal/EpisodeModal';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import facilityService from '../../../services/facilityService';
import resourceService from '../../../services/resourceService';
import episodeService from '../../../services/episodeService';
import authService from '../../../services/authService';
import { 
  startOfWeek, 
  endOfWeek, 
  format, 
  addWeeks, 
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths
} from '../../../utils/dateHelpers';
import './CalendarView.css';

function CalendarView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState('week'); // 'week' or 'month'
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [resources, setResources] = useState([]);
  const [selectedResources, setSelectedResources] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.user_type === 'admin';

  useEffect(() => {
    loadFacilities();
  }, []);

  useEffect(() => {
    if (selectedFacility) {
      loadResources(selectedFacility.facility_id);
    }
  }, [selectedFacility]);

  useEffect(() => {
    if (selectedFacility && selectedResources.length > 0) {
      loadEpisodes();
    }
  }, [currentDate, viewType, selectedFacility, selectedResources]);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const result = await facilityService.getFacilities();
      if (result.success) {
        setFacilities(result.data.facilities);
        // Auto-select first facility
        if (result.data.facilities.length > 0) {
          setSelectedFacility(result.data.facilities[0]);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async (facilityId) => {
    try {
      const result = await resourceService.getResourcesByFacility(facilityId);
      if (result.success) {
        setResources(result.data);
        // Auto-select all active resources
        const activeResources = result.data.filter(r => r.resource_status === 'active');
        setSelectedResources(activeResources.map(r => r.resource_id));
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load resources');
    }
  };

  const loadEpisodes = async () => {
    try {
      const dateRange = getDateRange();
      const result = await episodeService.getEpisodes({
        facility_id: selectedFacility.facility_id,
        resource_ids: selectedResources,
        start_date: format(dateRange.start, 'YYYY-MM-DD'),
        end_date: format(dateRange.end, 'YYYY-MM-DD')
      });
      
      if (result.success) {
        setEpisodes(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load ice time slots');
    }
  };

  const getDateRange = () => {
    if (viewType === 'week') {
      return {
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate)
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  };

  const handlePreviousPeriod = () => {
    if (viewType === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNextPeriod = () => {
    if (viewType === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleResourceToggle = (resourceId) => {
    setSelectedResources(prev => {
      if (prev.includes(resourceId)) {
        return prev.filter(id => id !== resourceId);
      } else {
        return [...prev, resourceId];
      }
    });
  };

  const handleTimeSlotClick = (date, time, resource) => {
    if (!isAdmin) return;

    // Create new episode
    const newEpisode = {
      date,
      time,
      resource_id: resource.resource_id,
      resource_name: resource.resource_name,
      facility_id: selectedFacility.facility_id
    };
    
    setSelectedEpisode(newEpisode);
    setShowEpisodeModal(true);
  };

  const handleEpisodeClick = (episode) => {
    setSelectedEpisode(episode);
    setShowEpisodeModal(true);
  };

  const handleEpisodeSave = async (episodeData) => {
    try {
      if (selectedEpisode.episode_id) {
        // Update existing episode
        const result = await episodeService.updateEpisode(
          selectedEpisode.episode_id, 
          episodeData
        );
        if (result.success) {
          loadEpisodes();
          setShowEpisodeModal(false);
        } else {
          setError(result.error);
        }
      } else {
        // Create new episode
        const result = await episodeService.createEpisode(episodeData);
        if (result.success) {
          loadEpisodes();
          setShowEpisodeModal(false);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('Failed to save ice time slot');
    }
  };

  const handleEpisodeDelete = async () => {
    if (!selectedEpisode?.episode_id) return;
    
    if (window.confirm('Are you sure you want to delete this ice time slot?')) {
      try {
        const result = await episodeService.deleteEpisode(selectedEpisode.episode_id);
        if (result.success) {
          loadEpisodes();
          setShowEpisodeModal(false);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError('Failed to delete ice time slot');
      }
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" message="Loading calendar..." />;
  }

  return (
    <div className="calendar-view">
      <div className="calendar-sidebar">
        <FacilitySelector
          facilities={facilities}
          selectedFacility={selectedFacility}
          onFacilityChange={setSelectedFacility}
        />
        
        <ResourceFilter
          resources={resources}
          selectedResources={selectedResources}
          onResourceToggle={handleResourceToggle}
        />
        
        <div className="calendar-legend">
          <h3>Legend</h3>
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-color pending"></div>
            <span>Pending Approval</span>
          </div>
          <div className="legend-item">
            <div className="legend-color booked"></div>
            <span>Booked</span>
          </div>
          <div className="legend-item">
            <div className="legend-color maintenance"></div>
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      <div className="calendar-main">
        <CalendarHeader
          currentDate={currentDate}
          viewType={viewType}
          onViewChange={setViewType}
          onPrevious={handlePreviousPeriod}
          onNext={handleNextPeriod}
          onToday={handleToday}
        />

        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={() => setError('')}
          />
        )}

        {selectedResources.length === 0 ? (
          <div className="no-resources-message">
            <p>Please select at least one rink to view the calendar.</p>
          </div>
        ) : (
          <TimeSlotGrid
            viewType={viewType}
            currentDate={currentDate}
            resources={resources.filter(r => selectedResources.includes(r.resource_id))}
            episodes={episodes}
            facility={selectedFacility}
            onTimeSlotClick={handleTimeSlotClick}
            onEpisodeClick={handleEpisodeClick}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {showEpisodeModal && (
        <EpisodeModal
          episode={selectedEpisode}
          facility={selectedFacility}
          resources={resources}
          isAdmin={isAdmin}
          onSave={handleEpisodeSave}
          onDelete={handleEpisodeDelete}
          onClose={() => {
            setShowEpisodeModal(false);
            setSelectedEpisode(null);
          }}
        />
      )}
    </div>
  );
}

export default CalendarView;
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CalendarView from '../components/calendar/CalendarView/CalendarView';
import CalendarSidebar from '../components/calendar/CalendarSidebar/CalendarSidebar';
import EventModal from '../components/calendar/EventModal/EventModal';
import CreateEventModal from '../components/calendar/CreateEventModal/CreateEventModal';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage/ErrorMessage';
import { ToastContainer, useToast } from '../components/common/Toast/Toast';
import calendarService from '../services/calendarService';
import facilityService from '../services/facilityService';
import resourceService from '../services/resourceService';
import authService from '../services/authService';
import './CalendarPage.css';

function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedResources, setSelectedResources] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDateForCreate, setSelectedDateForCreate] = useState(null);
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  
  // Toast notifications
  const { toasts, addToast, removeToast, success, error: errorToast, info } = useToast();
  
  // Ref to store the latest events for optimistic updates
  const eventsRef = useRef(events);
  eventsRef.current = events;
  
  // Request cancellation
  const loadEventsAbortController = useRef(null);
  
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.user_type === 'admin';

  useEffect(() => {
    loadInitialData();
    
    // Cleanup on unmount
    return () => {
      if (loadEventsAbortController.current) {
        loadEventsAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedFacility && selectedResources.length > 0 && !isLoadingEvents) {
      const timeoutId = setTimeout(() => {
        loadCalendarEvents();
      }, 300); // Debounce by 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedFacility, selectedResources, calendarDate, calendarView]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load facilities
      const facilitiesResult = await facilityService.getFacilities({ limit: 100 });
      if (facilitiesResult.success) {
        setFacilities(facilitiesResult.data.facilities);
        
        // Auto-select first facility if available
        if (facilitiesResult.data.facilities.length > 0) {
          const firstFacility = facilitiesResult.data.facilities[0];
          setSelectedFacility(firstFacility);
          await loadResourcesForFacility(firstFacility.facility_id);
        }
      } else {
        setError(facilitiesResult.error);
        errorToast('Failed to load facilities');
      }
    } catch (err) {
      setError('Failed to load initial data');
      errorToast('Failed to load initial data');
      console.error('Calendar initial data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadResourcesForFacility = async (facilityId) => {
    try {
      const resourcesResult = await calendarService.getCalendarResources({ facility_id: facilityId });
      if (resourcesResult.success) {
        setResources(resourcesResult.data.resources);
        // Auto-select all resources
        setSelectedResources(resourcesResult.data.resources.map(r => r.id));
      } else {
        errorToast('Failed to load resources');
      }
    } catch (err) {
      console.error('Load resources error:', err);
      errorToast('Failed to load resources');
    }
  };

  const loadCalendarEvents = async () => {
    // Cancel previous request if still pending
    if (loadEventsAbortController.current) {
      loadEventsAbortController.current.abort();
    }
    
    // Create new abort controller for this request
    loadEventsAbortController.current = new AbortController();
    
    try {
      setIsLoadingEvents(true);
      setError('');
      
      const dateRange = calendarService.getCalendarDateRange(calendarView, calendarDate);
      const params = {
        ...dateRange,
        facility_id: selectedFacility?.facility_id
      };

      const eventsResult = await calendarService.getEpisodes(params);
      
      if (eventsResult.success) {
        // Filter events by selected resources
        const filteredEvents = eventsResult.data.events.filter(event => 
          selectedResources.includes(event.resourceId?.toString())
        );
        
        // Apply admin color adjustments if needed
        const processedEvents = filteredEvents.map(event => ({
          ...event,
          backgroundColor: isAdmin ? calendarService.getAdminStatusColor(event) : event.backgroundColor,
          borderColor: isAdmin ? calendarService.getAdminStatusColor(event) : event.borderColor
        }));
        
        setEvents(processedEvents);
      } else {
        setError(eventsResult.error);
        if (!eventsResult.cancelled) {
          errorToast('Failed to load calendar events');
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Failed to load calendar events');
        errorToast('Failed to load calendar events');
        console.error('Calendar events error:', err);
      }
    } finally {
      setIsLoadingEvents(false);
      loadEventsAbortController.current = null;
    }
  };

  const handleFacilityChange = async (facility) => {
    setSelectedFacility(facility);
    setSelectedResources([]);
    setEvents([]);
    
    if (facility) {
      await loadResourcesForFacility(facility.facility_id);
      info(`Switched to ${facility.facility_name}`);
    }
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

  const handleEventClick = async (info) => {
    const episodeId = info.event.extendedProps.episodeId;
    setSelectedEvent({ episode_id: episodeId });
    setShowEventModal(true);
  };

  const handleEventModalClose = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const handleEventUpdate = async () => {
    // Reload calendar events after update
    await loadCalendarEvents();
  };

  const handleCreateEvent = () => {
    if (!selectedFacility) {
      errorToast('Please select a facility first');
      return;
    }
    
    if (selectedResources.length === 0) {
      errorToast('Please select at least one rink');
      return;
    }
    
    setSelectedDateForCreate(calendarDate);
    setShowCreateModal(true);
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    setSelectedDateForCreate(null);
  };

  const handleCreateSuccess = async () => {
    success('Ice time created successfully');
    await loadCalendarEvents();
    setShowCreateModal(false);
    setSelectedDateForCreate(null);
  };

  const handleDateClick = (arg) => {
    if (isAdmin) {
      setSelectedDateForCreate(arg.date);
      setShowCreateModal(true);
    }
  };

  const handleDateSelect = (selectInfo) => {
    if (isAdmin) {
      setSelectedDateForCreate(selectInfo.start);
      setShowCreateModal(true);
    }
  };

  const handleViewChange = useCallback((view) => {
    setCalendarView(view);
  }, []);

  const handleDateChange = useCallback((date) => {
    setCalendarDate(date);
  }, []);

  // Optimistic update handlers
  const handleEventSuccess = (message) => {
    success(message);
  };

  const handleEventError = (message) => {
    errorToast(message);
  };

  // Optimistic delete with rollback
  const optimisticDelete = async (episodeId) => {
    // Store current events for rollback
    const previousEvents = [...eventsRef.current];
    
    // Optimistically remove the event
    setEvents(prev => prev.filter(e => e.extendedProps.episodeId !== episodeId));
    
    try {
      const result = await calendarService.deleteEpisode(episodeId);
      if (!result.success) {
        // Rollback on failure
        setEvents(previousEvents);
        throw new Error(result.error || 'Failed to delete episode');
      }
      success('Ice time deleted successfully');
    } catch (err) {
      // Rollback on error
      setEvents(previousEvents);
      errorToast(err.message || 'Failed to delete ice time');
      throw err;
    }
  };

  // Optimistic update with rollback
  const optimisticUpdate = async (episodeId, updateData) => {
    // Store current events for rollback
    const previousEvents = [...eventsRef.current];
    
    // Optimistically update the event
    setEvents(prev => prev.map(event => {
      if (event.extendedProps.episodeId === episodeId) {
        return {
          ...event,
          title: updateData.episode_title || event.title,
          extendedProps: {
            ...event.extendedProps,
            status: updateData.episode_status || event.extendedProps.status,
            price: updateData.episode_price ? `$${updateData.episode_price}` : event.extendedProps.price
          },
          backgroundColor: calendarService.getStatusColorMap()[updateData.episode_status] || event.backgroundColor,
          borderColor: calendarService.getStatusColorMap()[updateData.episode_status] || event.borderColor
        };
      }
      return event;
    }));
    
    try {
      const result = await calendarService.updateEpisode(episodeId, updateData);
      if (!result.success) {
        // Rollback on failure
        setEvents(previousEvents);
        throw new Error(result.error || 'Failed to update episode');
      }
      success('Ice time updated successfully');
      // Reload to get fresh data
      await loadCalendarEvents();
    } catch (err) {
      // Rollback on error
      setEvents(previousEvents);
      errorToast(err.message || 'Failed to update ice time');
      throw err;
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" message="Loading calendar..." />;
  }

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Ice Time Calendar</h1>
        {isAdmin && (
          <button 
            className="create-event-btn"
            onClick={handleCreateEvent}
            disabled={!selectedFacility || selectedResources.length === 0}
          >
            + Create Ice Time
          </button>
        )}
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

      <div className="calendar-layout">
        <CalendarSidebar
          facilities={facilities}
          resources={resources}
          selectedFacility={selectedFacility}
          selectedResources={selectedResources}
          onFacilityChange={handleFacilityChange}
          onResourceToggle={handleResourceToggle}
          isAdmin={isAdmin}
        />

        <div className="calendar-main">
          {selectedFacility && selectedResources.length > 0 ? (
            <>
              {isLoadingEvents && (
                <div className="calendar-loading-overlay">
                  <LoadingSpinner size="small" message="Loading events..." />
                </div>
              )}
              <CalendarView
                events={events}
                resources={resources.filter(r => selectedResources.includes(r.id))}
                view={calendarView}
                date={calendarDate}
                onViewChange={handleViewChange}
                onDateChange={handleDateChange}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                onDateSelect={handleDateSelect}
                isAdmin={isAdmin}
              />
            </>
          ) : (
            <div className="calendar-empty-state">
              <p>Please select a facility and at least one rink to view the calendar.</p>
            </div>
          )}
        </div>
      </div>

      {showEventModal && selectedEvent && (
        <EventModal
          event={selectedEvent}
          isAdmin={isAdmin}
          onClose={handleEventModalClose}
          onUpdate={handleEventUpdate}
          onSuccess={handleEventSuccess}
          onError={handleEventError}
          calendarService={calendarService}
          onOptimisticUpdate={optimisticUpdate}
          onOptimisticDelete={optimisticDelete}
        />
      )}

      {showCreateModal && selectedFacility && (
        <CreateEventModal
          isOpen={showCreateModal}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          selectedDate={selectedDateForCreate}
          selectedResource={selectedResources[0]}
          facility={selectedFacility}
          calendarService={calendarService}
          resourceService={resourceService}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default CalendarPage;
// frontend/src/pages/CalendarPage.jsx (Enhanced with Drag-Drop)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CalendarView from '../components/calendar/CalendarView/CalendarView';
import CalendarSidebar from '../components/calendar/CalendarSidebar/CalendarSidebar';
import EventModal from '../components/calendar/EventModal/EventModal';
import CreateEventModal from '../components/calendar/CreateEventModal/CreateEventModal';
import DragDropConfirmModal from '../components/calendar/DragDropConfirmModal/DragDropConfirmModal';
import ConflictModal from '../components/common/ConflictModal/ConflictModal';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage/ErrorMessage';
import { ToastContainer, useToast } from '../components/common/Toast/Toast';
import calendarService from '../services/calendarService';
import dragDropService from '../services/dragDropService';
import facilityService from '../services/facilityService';
import resourceService from '../services/resourceService';
import authService from '../services/authService';
import { dateUtils } from '../utils/dateUtils';
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
  const [showDragDropModal, setShowDragDropModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedDateForCreate, setSelectedDateForCreate] = useState(null);
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Drag and drop state
  const [pendingMove, setPendingMove] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  
  // Toast notifications
  const { toasts, addToast, removeToast, success, error: errorToast, info, warning } = useToast();
  
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
      dragDropService.cleanup();
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

  // Drag and drop handlers
  const handleDragStart = (info) => {
    if (!isAdmin) return;
    
    setIsDragging(true);
    const editCheck = calendarService.canEditEpisode(info.event);
    
    if (!editCheck.allowed) {
      info.jsEvent.preventDefault();
      errorToast(editCheck.reason);
      setIsDragging(false);
      return;
    }
  };

  const handleDragStop = (info) => {
    setIsDragging(false);
  };

  const handleEventDrop = async (moveData) => {
    if (!isAdmin) {
      moveData.revert();
      return;
    }

    try {
      // Validate the move first
      const validation = await calendarService.validateEpisodeMove(
        moveData.episodeId,
        moveData.newStartTime,
        moveData.newEndTime,
        selectedFacility?.facility_id
      );

      if (!validation.success) {
        moveData.revert();
        errorToast('Failed to validate move');
        return;
      }

      const { isValid, conflicts, warnings } = validation.data;

      // If there are conflicts, show conflict modal and revert
      if (!isValid || conflicts.length > 0) {
        moveData.revert();
        setConflictData({
          conflicts,
          warnings,
          title: 'Cannot Move Ice Time',
          moveData
        });
        setShowConflictModal(true);
        return;
      }

      // If only warnings, show confirmation modal
      if (warnings.length > 0) {
        const currentEvent = events.find(e => e.extendedProps.episodeId === moveData.episodeId);
        const resourceName = resources.find(r => r.id === currentEvent?.resourceId)?.title;
        
        setPendingMove({
          ...moveData,
          episodeTitle: currentEvent?.title,
          originalStart: moveData.originalEvent.start,
          originalEnd: moveData.originalEvent.end,
          newStart: moveData.newStartTime,
          newEnd: moveData.newEndTime,
          resourceName,
          facilityName: selectedFacility?.facility_name,
          moveType: 'move',
          warnings
        });
        
        setShowDragDropModal(true);
        return;
      }

      // No conflicts or warnings, proceed directly
      await executeMoveEpisode(moveData);
      
    } catch (error) {
      moveData.revert();
      errorToast('Failed to validate move');
      console.error('Drop validation error:', error);
    }
  };

  const handleEventResize = async (resizeData) => {
    if (!isAdmin) {
      resizeData.revert();
      return;
    }

    try {
      // Get current episode data
      const currentEvent = events.find(e => e.extendedProps.episodeId === resizeData.episodeId);
      
      // Validate the resize
      const validation = await calendarService.validateEpisodeMove(
        resizeData.episodeId,
        currentEvent.start,
        resizeData.newEndTime,
        selectedFacility?.facility_id
      );

      if (!validation.success) {
        resizeData.revert();
        errorToast('Failed to validate resize');
        return;
      }

      const { isValid, conflicts, warnings } = validation.data;

      // If there are conflicts, show conflict modal and revert
      if (!isValid || conflicts.length > 0) {
        resizeData.revert();
        setConflictData({
          conflicts,
          warnings,
          title: 'Cannot Resize Ice Time',
          resizeData
        });
        setShowConflictModal(true);
        return;
      }

      // If only warnings, show confirmation modal
      if (warnings.length > 0) {
        const resourceName = resources.find(r => r.id === currentEvent?.resourceId)?.title;
        
        setPendingMove({
          ...resizeData,
          episodeTitle: currentEvent?.title,
          originalStart: currentEvent.start,
          originalEnd: resizeData.originalEnd,
          newStart: currentEvent.start,
          newEnd: resizeData.newEndTime,
          resourceName,
          facilityName: selectedFacility?.facility_name,
          moveType: 'resize',
          warnings
        });
        
        setShowDragDropModal(true);
        return;
      }

      // No conflicts or warnings, proceed directly
      await executeResizeEpisode(resizeData);
      
    } catch (error) {
      resizeData.revert();
      errorToast('Failed to validate resize');
      console.error('Resize validation error:', error);
    }
  };

  const executeMoveEpisode = async (moveData) => {
    try {
      const result = await calendarService.moveEpisode(
        moveData.episodeId,
        moveData.newStartTime,
        moveData.newEndTime
      );

      if (result.success) {
        success('Ice time moved successfully');
        // Reload events to ensure consistency
        await loadCalendarEvents();
      } else {
        moveData.revert();
        errorToast(result.error);
      }
    } catch (error) {
      moveData.revert();
      errorToast('Failed to move ice time');
      console.error('Move episode error:', error);
    }
  };

  const executeResizeEpisode = async (resizeData) => {
    try {
      const result = await calendarService.resizeEpisode(
        resizeData.episodeId,
        resizeData.newEndTime
      );

      if (result.success) {
        success(`Ice time duration updated to ${resizeData.newDuration} minutes`);
        // Reload events to ensure consistency
        await loadCalendarEvents();
      } else {
        resizeData.revert();
        errorToast(result.error);
      }
    } catch (error) {
      resizeData.revert();
      errorToast('Failed to resize ice time');
      console.error('Resize episode error:', error);
    }
  };

  const handleDragDropConfirm = async () => {
    if (!pendingMove) return;

    setShowDragDropModal(false);
    
    if (pendingMove.moveType === 'resize') {
      await executeResizeEpisode(pendingMove);
    } else {
      await executeMoveEpisode(pendingMove);
    }
    
    setPendingMove(null);
  };

  const handleDragDropCancel = () => {
    if (pendingMove && pendingMove.revert) {
      pendingMove.revert();
    }
    setShowDragDropModal(false);
    setPendingMove(null);
  };

  const handleConflictModalClose = () => {
    setShowConflictModal(false);
    setConflictData(null);
  };

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
            price: updateData.episode_price ? `${updateData.episode_price}` : event.extendedProps.price
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
        <div className="calendar-header-actions">
          {isDragging && (
            <div className="drag-indicator">
              <span className="drag-icon">🔄</span>
              <span>Drag to reschedule</span>
            </div>
          )}
          {isAdmin && (
            <button 
              className="create-event-btn"
              onClick={handleCreateEvent}
              disabled={!selectedFacility || selectedResources.length === 0 || isDragging}
            >
              + Create Ice Time
            </button>
          )}
        </div>
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
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onDragStart={handleDragStart}
                onDragStop={handleDragStop}
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

      {showDragDropModal && pendingMove && (
        <DragDropConfirmModal
          isOpen={showDragDropModal}
          onClose={handleDragDropCancel}
          onConfirm={handleDragDropConfirm}
          moveData={pendingMove}
          loading={false}
        />
      )}

      {showConflictModal && conflictData && (
        <ConflictModal
          isOpen={showConflictModal}
          onClose={handleConflictModalClose}
          onConfirm={() => {}}
          conflicts={conflictData.conflicts}
          warnings={conflictData.warnings}
          title={conflictData.title}
          confirmText="OK"
          loading={false}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default CalendarPage;
// frontend/src/pages/CalendarPage.jsx - Enhanced with Optimistic Updates
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CalendarView from '../components/calendar/CalendarView/CalendarView';
import CalendarSidebar from '../components/calendar/CalendarSidebar/CalendarSidebar';
import EventModal from '../components/calendar/EventModal/EventModal';
import CreateEventModal from '../components/calendar/CreateEventModal/CreateEventModal';
import RequestIceTimeModal from '../components/calendar/RequestIceTimeModal/RequestIceTimeModal';
import ShoppingCartPanel from '../components/calendar/ShoppingCartPanel/ShoppingCartPanel';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage/ErrorMessage';
import { ToastContainer, useToast } from '../components/common/Toast/Toast';
import calendarService from '../services/calendarService';
import facilityService from '../services/facilityService';
import resourceService from '../services/resourceService';
import schedulerService from '../services/schedulerService';
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
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDateForCreate, setSelectedDateForCreate] = useState(null);
  const [calendarView, setCalendarView] = useState('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Program Scheduler specific state
  const [shoppingCart, setShoppingCart] = useState([]);
  const [showShoppingCart, setShowShoppingCart] = useState(false);
  const [viewFilters, setViewFilters] = useState({
    showPublicAvailable: true,
    showAssignedToMe: true,
    showMyBookings: true,
    showOtherBookings: false
  });
  const [userPrograms, setUserPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  
  // Toast notifications
  const { toasts, addToast, removeToast, success, error: errorToast, info, warning } = useToast();
  
  // Request cancellation
  const loadEventsAbortController = useRef(null);
  
  // Track optimistic updates to prevent conflicts
  const optimisticOperations = useRef(new Set());
  
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.user_type === 'admin';
  const isScheduler = currentUser?.user_type === 'scheduler';

  useEffect(() => {
    loadInitialData();
    
    if (isScheduler) {
      loadShoppingCartFromStorage();
      loadUserPrograms();
    }
    
    // Subscribe to calendar service state changes
    const unsubscribe = calendarService.eventStateManager.addListener(handleEventStateChange);
    
    // Cleanup on unmount
    return () => {
      if (loadEventsAbortController.current) {
        loadEventsAbortController.current.abort();
      }
      unsubscribe();
      setIsLoadingEvents(false);
      setIsDragging(false);
    };
  }, []);

  useEffect(() => {
    if (selectedFacility && selectedResources.length > 0 && !isLoadingEvents) {
      const timeoutId = setTimeout(() => {
        loadCalendarEvents();
      }, 300); // Debounce by 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedFacility, selectedResources, calendarDate, calendarView, viewFilters, selectedProgram]);

  // Handle real-time event state changes
  const handleEventStateChange = useCallback((update) => {
    if (update.type === 'stateChange') {
      setEvents(prevEvents => 
        prevEvents.map(event => {
          if (event.extendedProps?.episodeId === update.eventId) {
            return {
              ...event,
              extendedProps: {
                ...event.extendedProps,
                ...update.state
              }
            };
          }
          return event;
        })
      );
    }
  }, []);

  // OPTIMISTIC UPDATE HANDLER - Core function that updates calendar without full reload
  const handleOptimisticUpdate = useCallback((updateData) => {
    const { type, episodeId, eventId, tempId } = updateData;
    
    setEvents(prevEvents => {
      switch (type) {
        case 'add':
          // Add new optimistic event
          return [...prevEvents, updateData.event];
          
        case 'replace':
          // Replace temporary event with real server data
          return prevEvents
            .filter(event => event.id !== updateData.tempId)
            .concat(updateData.events);
            
        case 'remove':
          if (updateData.optimistic) {
            // Store removed event for potential rollback
            const removedEvent = prevEvents.find(event => 
              event.extendedProps?.episodeId === episodeId
            );
            updateData.removedEvent = removedEvent;
            return prevEvents.filter(event => 
              event.extendedProps?.episodeId !== episodeId
            );
          } else if (tempId) {
            // Remove temporary event on error
            return prevEvents.filter(event => event.id !== tempId);
          }
          return prevEvents;
          
        case 'restore':
          // Restore event after failed delete
          return [...prevEvents, updateData.event];
          
        case 'update':
          // Apply optimistic updates to existing event
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                title: updateData.updates.episode_title || event.title,
                backgroundColor: updateData.updates.extendedProps?.loading ? '#e6f3ff' : event.backgroundColor,
                extendedProps: {
                  ...event.extendedProps,
                  ...updateData.updates.extendedProps,
                  status: updateData.updates.episode_status || event.extendedProps.status,
                  price: updateData.updates.episode_price || event.extendedProps.price
                }
              };
            }
            return event;
          });
          
        case 'updateComplete':
          // Finalize successful update
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                backgroundColor: calendarService.getStatusColorMap()[updateData.data.episode_status]?.backgroundColor || event.backgroundColor,
                extendedProps: {
                  ...event.extendedProps,
                  ...updateData.updates.extendedProps,
                  status: updateData.data.episode_status,
                  loading: false,
                  syncing: false
                }
              };
            }
            return event;
          });
          
        case 'rollback':
          // Rollback failed optimistic update
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                extendedProps: {
                  ...event.extendedProps,
                  loading: false,
                  syncing: false,
                  error: updateData.error
                }
              };
            }
            return event;
          });
          
        case 'move':
          if (updateData.optimistic) {
            // Store original position for potential rollback
            return prevEvents.map(event => {
              if (event.extendedProps?.episodeId === episodeId) {
                updateData.originalStart = event.start;
                updateData.originalEnd = event.end;
                return {
                  ...event,
                  start: updateData.newStart,
                  end: updateData.newEnd,
                  backgroundColor: '#e6f3ff', // Loading color
                  extendedProps: {
                    ...event.extendedProps,
                    loading: true,
                    syncing: true
                  }
                };
              }
              return event;
            });
          }
          return prevEvents;
          
        case 'moveComplete':
          // Confirm successful move
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                backgroundColor: calendarService.getStatusColorMap()[event.extendedProps.status]?.backgroundColor || event.backgroundColor,
                extendedProps: {
                  ...event.extendedProps,
                  loading: false,
                  syncing: false
                }
              };
            }
            return event;
          });
          
        case 'revert':
          // Revert failed move
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                start: updateData.originalStart,
                end: updateData.originalEnd,
                backgroundColor: calendarService.getStatusColorMap()[event.extendedProps.status]?.backgroundColor || event.backgroundColor,
                extendedProps: {
                  ...event.extendedProps,
                  loading: false,
                  syncing: false,
                  error: 'Move failed'
                }
              };
            }
            return event;
          });
          
        case 'resize':
          if (updateData.optimistic) {
            return prevEvents.map(event => {
              if (event.extendedProps?.episodeId === episodeId) {
                updateData.originalEnd = event.end;
                return {
                  ...event,
                  end: updateData.newEnd,
                  backgroundColor: '#e6f3ff', // Loading color
                  extendedProps: {
                    ...event.extendedProps,
                    loading: true,
                    syncing: true
                  }
                };
              }
              return event;
            });
          }
          return prevEvents;
          
        case 'resizeComplete':
          // Confirm successful resize
          return prevEvents.map(event => {
            if (event.extendedProps?.episodeId === episodeId) {
              return {
                ...event,
                backgroundColor: calendarService.getStatusColorMap()[event.extendedProps.status]?.backgroundColor || event.backgroundColor,
                extendedProps: {
                  ...event.extendedProps,
                  loading: false,
                  syncing: false
                }
              };
            }
            return event;
          });
          
        case 'removeEvent':
          // Remove all episodes from an event
          if (updateData.optimistic) {
            const removedEvents = prevEvents.filter(event => 
              event.extendedProps?.eventId === eventId
            );
            updateData.removedEvents = removedEvents;
            return prevEvents.filter(event => 
              event.extendedProps?.eventId !== eventId
            );
          }
          return prevEvents;
          
        case 'restoreEvents':
          // Restore events after failed delete
          return [...prevEvents, ...updateData.events];
          
        default:
          return prevEvents;
      }
    });
    
    return updateData.removedEvent || updateData.originalStart || updateData.originalEnd;
  }, []);

  // Load user's programs if scheduler
  const loadUserPrograms = async () => {
    if (!isScheduler) return;
    
    try {
      const result = await schedulerService.getUserPrograms();
      if (result.success) {
        setUserPrograms(result.data.programs);
        // Auto-select first program if available
        if (result.data.programs.length > 0) {
          setSelectedProgram(result.data.programs[0]);
        }
      } else {
        errorToast('Failed to load your programs');
      }
    } catch (err) {
      console.error('Load user programs error:', err);
      errorToast('Failed to load your programs');
    }
  };

  // Load shopping cart from localStorage
  const loadShoppingCartFromStorage = () => {
    try {
      const saved = localStorage.getItem(`shoppingCart_${currentUser?.user_id}`);
      if (saved) {
        setShoppingCart(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Error loading shopping cart:', err);
    }
  };

  // Save shopping cart to localStorage
  const saveShoppingCartToStorage = (cart) => {
    try {
      localStorage.setItem(`shoppingCart_${currentUser?.user_id}`, JSON.stringify(cart));
    } catch (err) {
      console.error('Error saving shopping cart:', err);
    }
  };

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
        facility_id: selectedFacility?.facility_id,
        // Scheduler-specific filters
        ...(isScheduler && {
          program_id: selectedProgram?.program_id,
          show_public_available: viewFilters.showPublicAvailable,
          show_assigned_to_me: viewFilters.showAssignedToMe,
          show_my_bookings: viewFilters.showMyBookings,
          show_other_bookings: viewFilters.showOtherBookings
        })
      };

      const eventsResult = isScheduler 
        ? await schedulerService.getFilteredEpisodes(params)
        : await calendarService.getEpisodes(params);
      
      if (eventsResult.success) {
        // Filter events by selected resources
        const filteredEvents = eventsResult.data.events.filter(event => 
          selectedResources.includes(event.resourceId?.toString())
        );
        
        // Mark events that are in shopping cart
        const eventsWithCartStatus = filteredEvents.map(event => ({
          ...event,
          extendedProps: {
            ...event.extendedProps,
            inShoppingCart: shoppingCart.some(item => item.episodeId === event.extendedProps?.episodeId)
          }
        }));
        
        console.log('Loaded events:', eventsWithCartStatus.length);
        setEvents(eventsWithCartStatus);
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
    const status = info.event.extendedProps.status;
    
    // For schedulers, handle different click behaviors based on status
    if (isScheduler) {
      if (status === 'available' && !info.event.extendedProps.inShoppingCart) {
        // Add to shopping cart
        handleAddToCart(info.event);
        return;
      } else if (info.event.extendedProps.inShoppingCart) {
        // Remove from shopping cart
        handleRemoveFromCart(episodeId);
        return;
      }
    }
    
    // Default behavior - show details modal
    setSelectedEvent({ episode_id: episodeId });
    setShowEventModal(true);
  };

  const handleEventModalClose = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  // ENHANCED: Use optimistic updates instead of full reload
  const handleEventUpdate = async () => {
    // Event details are updated optimistically by the modal
    // No need to reload entire calendar
    success('Ice time updated successfully');
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
    
    // For button click, just pass the current date without specific time
    setSelectedDateForCreate({
      date: calendarDate,
      allDay: true,
      clickedTime: null // No specific time clicked
    });
    
    if (isScheduler) {
      setShowRequestModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    setShowRequestModal(false);
    setSelectedDateForCreate(null);
  };

  // ENHANCED: Use optimistic updates instead of full reload
  const handleCreateSuccess = async () => {
    success('Ice time created successfully');
    // Events are added optimistically by the create modal
    // No need to reload entire calendar
    setShowCreateModal(false);
    setShowRequestModal(false);
    setSelectedDateForCreate(null);
  };

  const handleDateClick = (arg) => {
    if (isAdmin) {
      // Pass the full date/time from the click
      setSelectedDateForCreate({
        date: arg.date,
        allDay: arg.allDay,
        clickedTime: arg.date // This contains the time if clicked on a time slot
      });
      setShowCreateModal(true);
    } else if (isScheduler) {
      // For schedulers, clicking on empty time could request ice time
      setSelectedDateForCreate({
        date: arg.date,
        allDay: arg.allDay,
        clickedTime: arg.date
      });
      setShowRequestModal(true);
    }
  };

  const handleDateSelect = (selectInfo) => {
    if (isAdmin) {
      // Pass the selected time range
      setSelectedDateForCreate({
        date: selectInfo.start,
        allDay: selectInfo.allDay,
        clickedTime: selectInfo.start, // Use the start of the selection
        endTime: selectInfo.end // Also pass end time for potential future use
      });
      setShowCreateModal(true);
    } else if (isScheduler) {
      setSelectedDateForCreate({
        date: selectInfo.start,
        allDay: selectInfo.allDay,
        clickedTime: selectInfo.start,
        endTime: selectInfo.end
      });
      setShowRequestModal(true);
    }
  };

  // Shopping Cart Functions
  const handleAddToCart = (event) => {
    const cartItem = {
      episodeId: event.extendedProps.episodeId,
      facilityId: selectedFacility.facility_id,
      facilityName: selectedFacility.facility_name,
      resourceName: event.extendedProps.resource,
      startTime: event.start.toISOString(),
      endTime: event.end.toISOString(),
      price: event.extendedProps.price || 0,
      title: event.title,
      addedAt: new Date().toISOString()
    };
    
    const newCart = [...shoppingCart, cartItem];
    setShoppingCart(newCart);
    saveShoppingCartToStorage(newCart);
    
    // Update events to reflect cart status
    setEvents(prev => prev.map(e => 
      e.extendedProps?.episodeId === cartItem.episodeId 
        ? { ...e, extendedProps: { ...e.extendedProps, inShoppingCart: true } }
        : e
    ));
    
    success(`Added ${event.title} to shopping cart`);
  };

  const handleRemoveFromCart = (episodeId) => {
    const newCart = shoppingCart.filter(item => item.episodeId !== episodeId);
    setShoppingCart(newCart);
    saveShoppingCartToStorage(newCart);
    
    // Update events to reflect cart status
    setEvents(prev => prev.map(e => 
      e.extendedProps?.episodeId === episodeId 
        ? { ...e, extendedProps: { ...e.extendedProps, inShoppingCart: false } }
        : e
    ));
    
    info('Removed from shopping cart');
  };

  const handleClearCart = () => {
    // Update all events to remove cart status
    setEvents(prev => prev.map(e => ({
      ...e,
      extendedProps: { ...e.extendedProps, inShoppingCart: false }
    })));
    
    setShoppingCart([]);
    saveShoppingCartToStorage([]);
    info('Shopping cart cleared');
  };

  const handleSubmitRequests = async () => {
    if (shoppingCart.length === 0) {
      warning('Your shopping cart is empty');
      return;
    }
    
    if (!selectedProgram) {
      errorToast('Please select a program first');
      return;
    }
    
    try {
      const result = await schedulerService.submitIceTimeRequests({
        program_id: selectedProgram.program_id,
        requests: shoppingCart
      });
      
      if (result.success) {
        success(`Submitted ${shoppingCart.length} ice time requests`);
        handleClearCart();
        // Optimistically update affected events to 'pending' status
        const cartEpisodeIds = shoppingCart.map(item => item.episodeId);
        setEvents(prev => prev.map(event => 
          cartEpisodeIds.includes(event.extendedProps?.episodeId)
            ? {
                ...event,
                extendedProps: {
                  ...event.extendedProps,
                  status: 'pending',
                  inShoppingCart: false
                },
                backgroundColor: calendarService.getStatusColorMap()['pending']?.backgroundColor
              }
            : event
        ));
      } else {
        errorToast(result.error || 'Failed to submit requests');
      }
    } catch (err) {
      console.error('Submit requests error:', err);
      errorToast('Failed to submit requests');
    }
  };

  const handleViewChange = useCallback((view) => {
    setCalendarView(view);
  }, []);

  const handleDateChange = useCallback((date) => {
    setCalendarDate(date);
  }, []);

  const handleFilterChange = (filterKey, value) => {
    setViewFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  // ENHANCED: Drag and drop handlers with optimistic updates
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

  // ENHANCED: Use optimistic move instead of full reload
  const handleEventDrop = async (moveData) => {
    if (!isAdmin) {
      moveData.revert();
      return;
    }

    const episodeId = moveData.episodeId;
    const operationId = `move_${episodeId}_${Date.now()}`;
    
    // Prevent duplicate operations
    if (optimisticOperations.current.has(operationId)) {
      moveData.revert();
      return;
    }
    
    optimisticOperations.current.add(operationId);

    try {
      const result = await calendarService.moveEpisodeOptimistic(
        episodeId,
        moveData.newStartTime,
        moveData.newEndTime,
        handleOptimisticUpdate
      );

      if (result.success) {
        success('Ice time moved successfully');
      } else {
        errorToast(result.error || 'Failed to move ice time');
      }
      
    } catch (error) {
      errorToast('Failed to move ice time');
      console.error('Drop handling error:', error);
    } finally {
      optimisticOperations.current.delete(operationId);
    }
  };

  // ENHANCED: Use optimistic resize instead of full reload
  const handleEventResize = async (resizeData) => {
    if (!isAdmin) {
      resizeData.revert();
      return;
    }

    const episodeId = resizeData.episodeId;
    const operationId = `resize_${episodeId}_${Date.now()}`;
    
    // Prevent duplicate operations
    if (optimisticOperations.current.has(operationId)) {
      resizeData.revert();
      return;
    }
    
    optimisticOperations.current.add(operationId);

    try {
      const result = await calendarService.resizeEpisodeOptimistic(
        episodeId,
        resizeData.newEndTime,
        handleOptimisticUpdate
      );

      if (result.success) {
        success('Ice time duration updated successfully');
      } else {
        errorToast(result.error || 'Failed to resize ice time');
      }
      
    } catch (error) {
      errorToast('Failed to resize ice time');
      console.error('Resize handling error:', error);
    } finally {
      optimisticOperations.current.delete(operationId);
    }
  };

  // Event success and error handlers
  const handleEventSuccess = (message) => {
    success(message);
  };

  const handleEventError = (message) => {
    errorToast(message);
  };

  if (loading) {
    return <LoadingSpinner size="large" message="Loading calendar..." />;
  }

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div className="calendar-header-left">
          <h1>Ice Time Calendar</h1>
          {isScheduler && selectedProgram && (
            <div className="selected-program">
              <span className="program-label">Program:</span>
              <select 
                value={selectedProgram.program_id} 
                onChange={(e) => {
                  const program = userPrograms.find(p => p.program_id === parseInt(e.target.value));
                  setSelectedProgram(program);
                }}
                className="program-select"
              >
                {userPrograms.map(program => (
                  <option key={program.program_id} value={program.program_id}>
                    {program.program_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="calendar-header-actions">
          {isDragging && (
            <div className="drag-indicator">
              <span className="drag-icon">🔄</span>
              <span>Drag to reschedule</span>
            </div>
          )}
          
          {isScheduler && (
            <>
              <button 
                className={`shopping-cart-btn ${shoppingCart.length > 0 ? 'has-items' : ''}`}
                onClick={() => setShowShoppingCart(!showShoppingCart)}
              >
                🛒 Cart ({shoppingCart.length})
              </button>
              <button 
                className="request-ice-btn"
                onClick={handleCreateEvent}
                disabled={!selectedFacility || selectedResources.length === 0 || isDragging}
              >
                Request Ice Time
              </button>
            </>
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
          isScheduler={isScheduler}
          viewFilters={viewFilters}
          onFilterChange={handleFilterChange}
          userPrograms={userPrograms}
          selectedProgram={selectedProgram}
          onProgramChange={setSelectedProgram}
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
                isScheduler={isScheduler}
                shoppingCart={shoppingCart}
              />
            </>
          ) : (
            <div className="calendar-empty-state">
              <p>Please select a facility and at least one rink to view the calendar.</p>
            </div>
          )}
        </div>

        {/* Shopping Cart Panel */}
        {isScheduler && showShoppingCart && (
          <ShoppingCartPanel
            items={shoppingCart}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onSubmitRequests={handleSubmitRequests}
            onClose={() => setShowShoppingCart(false)}
            selectedProgram={selectedProgram}
            isSubmitting={false}
          />
        )}
      </div>

      {showEventModal && selectedEvent && (
        <EventModal
          event={selectedEvent}
          isAdmin={isAdmin}
          isScheduler={isScheduler}
          onClose={handleEventModalClose}
          onUpdate={handleEventUpdate}
          onSuccess={handleEventSuccess}
          onError={handleEventError}
          calendarService={calendarService}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      )}

      {showCreateModal && selectedFacility && isAdmin && (
        <CreateEventModal
          isOpen={showCreateModal}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          selectedDate={selectedDateForCreate}
          selectedResource={selectedResources[0]}
          facility={selectedFacility}
          calendarService={calendarService}
          resourceService={resourceService}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      )}

      {showRequestModal && selectedFacility && isScheduler && selectedProgram && (
        <RequestIceTimeModal
          isOpen={showRequestModal}
          onClose={handleCreateModalClose}
          onSuccess={handleCreateSuccess}
          selectedDate={selectedDateForCreate}
          selectedResource={selectedResources[0]}
          facility={selectedFacility}
          program={selectedProgram}
          schedulerService={schedulerService}
          resourceService={resourceService}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default CalendarPage;
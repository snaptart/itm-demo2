// frontend/src/components/calendar/CalendarView/CalendarView.jsx - Fixed event handling
import React, { useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import './CalendarView.css';

function CalendarView({ 
  events, 
  resources, 
  view, 
  date, 
  onViewChange, 
  onDateChange, 
  onEventClick,
  onDateClick,
  onDateSelect,
  onEventDrop,
  onEventResize,
  onDragStart,
  onDragStop,
  isAdmin 
}) {
  const calendarRef = useRef(null);

  // Map view names to FullCalendar view names
  const getFullCalendarView = (viewName) => {
    const viewMap = {
      'month': 'dayGridMonth',
      'week': 'timeGridWeek',
      'day': 'timeGridDay',
      'list': 'listWeek'
    };
    return viewMap[viewName] || 'dayGridMonth';
  };

  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(getFullCalendarView(view));
    }
  }, [view]);

  useEffect(() => {
    if (calendarRef.current && date) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(date);
    }
  }, [date]);

  const handleDatesSet = (dateInfo) => {
    // Only update if the date actually changed
    if (onDateChange && dateInfo.start && dateInfo.start.getTime() !== date.getTime()) {
      onDateChange(dateInfo.start);
    }
  };

  const getHeaderToolbar = () => {
    return {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    };
  };

  const getBusinessHours = () => {
    return {
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: '06:00',
      endTime: '23:00'
    };
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = (info) => {
    if (!isAdmin || !onEventDrop) {
      info.revert();
      return;
    }

    const { event, delta, revert } = info;
    const episodeId = event.extendedProps.episodeId;
    
    if (!episodeId) {
      console.error('No episode ID found for dropped event');
      revert();
      return;
    }

    // Calculate new start and end times
    const newStart = new Date(event.start);
    const newEnd = new Date(event.end);
    
    // Check if dropping to a past date
    if (newStart < new Date()) {
      revert();
      return;
    }

    // Add visual feedback
    event.setProp('className', event.classNames.concat(['fc-event-dragging']));

    const moveData = {
      episodeId,
      newStartTime: newStart.toISOString(),
      newEndTime: newEnd.toISOString(),
      delta: {
        days: Math.round(delta.days || 0),
        milliseconds: delta.milliseconds || 0
      },
      originalEvent: {
        start: new Date(event.start.getTime() - (delta.milliseconds || 0)),
        end: new Date(event.end.getTime() - (delta.milliseconds || 0))
      },
      revert
    };

    onEventDrop(moveData);
  };

  // Handle event resize
  const handleEventResize = (info) => {
    if (!isAdmin || !onEventResize) {
      info.revert();
      return;
    }

    const { event, endDelta, revert } = info;
    const episodeId = event.extendedProps.episodeId;
    
    if (!episodeId) {
      console.error('No episode ID found for resized event');
      revert();
      return;
    }

    // Calculate new duration
    const newEnd = new Date(event.end);
    const duration = Math.round((newEnd - event.start) / (1000 * 60)); // in minutes
    
    // Validate minimum duration (30 minutes)
    if (duration < 30) {
      revert();
      return;
    }

    // Validate maximum duration (8 hours)
    if (duration > 480) {
      revert();
      return;
    }

    // Add visual feedback
    event.setProp('className', event.classNames.concat(['fc-event-resizing']));

    const resizeData = {
      episodeId,
      newEndTime: newEnd.toISOString(),
      newDuration: duration,
      endDelta: {
        days: Math.round(endDelta.days || 0),
        milliseconds: endDelta.milliseconds || 0
      },
      originalEnd: new Date(event.end.getTime() - (endDelta.milliseconds || 0)),
      revert
    };

    onEventResize(resizeData);
  };

  // Handle drag start
  const handleEventDragStart = (info) => {
    if (onDragStart) {
      onDragStart(info);
    }
    
    // Add dragging class for visual feedback
    info.event.setProp('className', info.event.classNames.concat(['fc-event-drag-start']));
  };

  // Handle drag stop
  const handleEventDragStop = (info) => {
    if (onDragStop) {
      onDragStop(info);
    }
    
    // Remove dragging classes
    const classNames = info.event.classNames.filter(c => 
      !['fc-event-drag-start', 'fc-event-dragging', 'fc-event-resizing'].includes(c)
    );
    info.event.setProp('className', classNames);
  };

  // Check if event is editable
  const isEventEditable = (event) => {
    if (!isAdmin) return false;
    
    const status = event.extendedProps?.status;
    const startTime = new Date(event.start);
    
    // Cannot edit past events
    if (startTime < new Date()) return false;
    
    // Cannot edit booked events
    if (status === 'booked') return false;
    
    // Cannot edit if it has bookings
    if (event.extendedProps?.hasBookings) return false;
    
    return true;
  };

  const renderEventContent = (eventInfo) => {
    const { event } = eventInfo;
    const isMultiDay = event.allDay || 
      (event.start && event.end && event.start.getDate() !== event.end.getDate());
    
    const editable = isEventEditable(event);

    return (
      <div className={`fc-event-custom ${event.extendedProps.status} ${editable ? 'editable' : 'non-editable'}`}>
        {editable && isAdmin && (
          <div className="fc-event-drag-handle">⋮⋮</div>
        )}
        <div className="fc-event-time">
          {eventInfo.timeText}
        </div>
        <div className="fc-event-title">
          {event.title}
        </div>
        {(view === 'dayGridMonth' || isMultiDay) && (
          <div className="fc-event-details">
            <span className="fc-event-resource">{event.extendedProps.resource}</span>
            {event.extendedProps.price && (
              <span className="fc-event-price">{event.extendedProps.price}</span>
            )}
          </div>
        )}
        {event.extendedProps.status && (
          <div className={`fc-event-status-badge ${event.extendedProps.status}`}>
            {getStatusLabel(event.extendedProps.status)}
          </div>
        )}
        {editable && isAdmin && view !== 'dayGridMonth' && (
          <div className="fc-event-resize-handle">↘</div>
        )}
      </div>
    );
  };

  const getStatusLabel = (status) => {
    const labels = {
      'available': 'Available',
      'assigned': 'Assigned',
      'pending': 'Pending',
      'booked': 'Booked',
      'maintenance': 'Maintenance',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  };

  const handleViewDidMount = (info) => {
    // Map FullCalendar view names back to our simple names
    const reverseViewMap = {
      'dayGridMonth': 'month',
      'timeGridWeek': 'week',
      'timeGridDay': 'day',
      'listWeek': 'list'
    };
    const simpleName = reverseViewMap[info.view.type] || 'month';
    if (simpleName !== view && onViewChange) {
      onViewChange(simpleName);
    }
  };

  // FIXED: Process events to ensure proper date handling
  // The backend already converts times to facility timezone, so we just need to ensure
  // FullCalendar gets proper Date objects
  const processedEvents = events.map(event => {
    // Trust the backend times - they're already in facility timezone
    const processedEvent = {
      ...event,
      // Ensure start and end are Date objects for FullCalendar
      start: typeof event.start === 'string' ? new Date(event.start) : event.start,
      end: typeof event.end === 'string' ? new Date(event.end) : event.end,
      // Set editability based on business rules
      editable: isEventEditable(event),
      startEditable: isEventEditable(event),
      durationEditable: isEventEditable(event) && view !== 'dayGridMonth'
    };

    // Debug logging to verify times
    if (event.extendedProps?.debug) {
      console.log(`Event ${event.id} display times:`, {
        original: event.start,
        processed: processedEvent.start,
        timezone: event.extendedProps.facilityTimezone
      });
    }

    return processedEvent;
  });

  return (
    <div className="calendar-view-container">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={getFullCalendarView(view)}
        initialDate={date}
        headerToolbar={getHeaderToolbar()}
        businessHours={getBusinessHours()}
        events={processedEvents}
        eventClick={onEventClick}
        eventContent={renderEventContent}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventDragStart={handleEventDragStart}
        eventDragStop={handleEventDragStop}
        datesSet={handleDatesSet}
        viewDidMount={handleViewDidMount}
        dateClick={onDateClick}
        select={onDateSelect}
        selectable={isAdmin}
        selectMirror={true}
        editable={isAdmin}
        eventStartEditable={true}
        eventDurationEditable={true}
        dragRevertDuration={300}
        dragScroll={true}
        snapDuration="00:15:00"
        height="100%"
        nowIndicator={true}
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        weekends={true}
        eventDisplay="block"
        dayMaxEvents={true}
        moreLinkClick="popover"
        // IMPORTANT: Let FullCalendar handle the timezone display
        // The times from backend are already in facility timezone
        timeZone="local"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        views={{
          listWeek: {
            buttonText: 'List',
            listDayFormat: { 
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            },
            noEventsText: 'No ice time scheduled'
          },
          timeGridWeek: {
            dayHeaderFormat: { 
              weekday: 'short',
              month: 'numeric',
              day: 'numeric'
            }
          }
        }}
      />
      
      <div className="calendar-legend">
        <h4>Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color available"></span>
            <span>Available</span>
          </div>
          {isAdmin && (
            <>
              <div className="legend-item">
                <span className="legend-color assigned-pending"></span>
                <span>Assigned (Pending)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color assigned-reserved"></span>
                <span>Assigned (Reserved)</span>
              </div>
            </>
          )}
          <div className="legend-item">
            <span className="legend-color booked"></span>
            <span>Booked/Paid</span>
          </div>
          <div className="legend-item">
            <span className="legend-color maintenance"></span>
            <span>Unavailable</span>
          </div>
        </div>
        {isAdmin && (
          <div className="drag-drop-help">
            <p><strong>Drag & Drop:</strong> Drag ice time slots to reschedule them. Resize by dragging the bottom edge.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;
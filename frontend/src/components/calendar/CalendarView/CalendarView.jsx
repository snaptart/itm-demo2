// frontend/src/components/calendar/CalendarView/CalendarView.jsx - Fixed Event Styling
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

  // Get status colors based on booking status
  const getStatusColors = (status) => {
    const colorMap = {
      'available': {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E0',
        textColor: '#2D3748'
      },
      'assigned': {
        backgroundColor: '#FFEB3B',
        borderColor: '#F9A825',
        textColor: '#1A202C'
      },
      'pending': {
        backgroundColor: '#FFEB3B',
        borderColor: '#F9A825',
        textColor: '#1A202C'
      },
      'booked': {
        backgroundColor: '#4CAF50',
        borderColor: '#388E3C',
        textColor: '#FFFFFF'
      },
      'maintenance': {
        backgroundColor: '#9E9E9E',
        borderColor: '#616161',
        textColor: '#FFFFFF'
      },
      'cancelled': {
        backgroundColor: '#9E9E9E',
        borderColor: '#616161',
        textColor: '#FFFFFF'
      }
    };

    // Admin view - show assigned-reserved in blue
    if (isAdmin && status === 'assigned') {
      return {
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        textColor: '#FFFFFF'
      };
    }

    return colorMap[status] || colorMap['available'];
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

    // Get new times from the event
    const newStart = event.start;
    const newEnd = event.end;
    
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

    // Get new end time
    const newEnd = event.end;
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
    const status = event.extendedProps?.status || 'available';
    const editable = isEventEditable(event);

    // Simplified content that works with FullCalendar's positioning
    if (view === 'dayGridMonth') {
      // Month view - minimal content
      return {
        html: `
          <div class="fc-event-content-month">
            <div class="fc-event-time-month">${eventInfo.timeText}</div>
            <div class="fc-event-title-month">${event.title || 'Ice Time'}</div>
          </div>
        `
      };
    } else if (view === 'listWeek') {
      // List view - detailed content
      const programName = event.extendedProps?.assignedProgram || '';
      return {
        html: `
          <div class="fc-event-content-list">
            <div class="fc-event-main-list">
              <strong>${event.extendedProps?.resource || event.title}</strong>
              ${programName ? ` - ${programName}` : ''}
            </div>
            <div class="fc-event-details-list">
              <span class="fc-event-price-list">$${event.extendedProps?.price || '0'}</span>
              <span class="fc-event-status-list">${getStatusLabel(status)}</span>
            </div>
          </div>
        `
      };
    } else {
      // Week/Day views - balanced content
      return {
        html: `
          <div class="fc-event-content-time">
            <div class="fc-event-title-time">${event.title || 'Ice Time'}</div>
            <div class="fc-event-details-time">
              <span class="fc-event-resource-time">${event.extendedProps?.resource || ''}</span>
              ${event.extendedProps?.price ? `<span class="fc-event-price-time">$${event.extendedProps.price}</span>` : ''}
            </div>
          </div>
        `
      };
    }
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

  // Process events to ensure proper handling
  const processedEvents = events.map(event => {
    const editable = isEventEditable(event);
    const status = event.extendedProps?.status || 'available';
    
    // Get proper colors based on status
    const colors = getStatusColors(status);
    
    // Ensure dates are Date objects for FullCalendar
    const processedEvent = {
      ...event,
      start: event.start instanceof Date ? event.start : new Date(event.start),
      end: event.end instanceof Date ? event.end : new Date(event.end),
      backgroundColor: colors.backgroundColor,
      borderColor: colors.borderColor,
      textColor: colors.textColor,
      // Set editability based on business rules
      editable: editable,
      startEditable: editable,
      durationEditable: editable && view !== 'dayGridMonth',
      // Remove custom className to avoid CSS conflicts
      className: []
    };

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
        eventOverlap={false}
        slotEventOverlap={false}
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
        eventDidMount={(info) => {
          // Add hover effects for editable events
          const editable = isEventEditable(info.event);
          if (editable && isAdmin) {
            info.el.style.cursor = 'move';
            info.el.addEventListener('mouseenter', () => {
              info.el.style.transform = 'translateY(-1px)';
              info.el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            });
            info.el.addEventListener('mouseleave', () => {
              info.el.style.transform = 'none';
              info.el.style.boxShadow = 'none';
            });
          }
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
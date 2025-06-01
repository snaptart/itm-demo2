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

  const renderEventContent = (eventInfo) => {
    const { event } = eventInfo;
    const isMultiDay = event.allDay || 
      (event.start && event.end && event.start.getDate() !== event.end.getDate());

    return (
      <div className={`fc-event-custom ${event.extendedProps.status}`}>
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

  return (
    <div className="calendar-view-container">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={getFullCalendarView(view)}
        initialDate={date}
        headerToolbar={getHeaderToolbar()}
        businessHours={getBusinessHours()}
        events={events}
        eventClick={onEventClick}
        eventContent={renderEventContent}
        datesSet={handleDatesSet}
        viewDidMount={handleViewDidMount}
        dateClick={onDateClick}
        select={onDateSelect}
        selectable={isAdmin}
        selectMirror={true}
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
      </div>
    </div>
  );
}

export default CalendarView;
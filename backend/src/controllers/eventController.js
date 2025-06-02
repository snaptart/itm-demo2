// backend/src/controllers/eventController.js (Fixed with Proper Timezone Handling)
const { Event, Episode, Resource, Facility, Booking } = require('../models');
const { Op } = require('sequelize');

// Import timezone utilities with fallback
let TimezoneUtils;
try {
  TimezoneUtils = require('../utils/timezoneUtils');
} catch (error) {
  console.warn('TimezoneUtils not available, using fallback');
  TimezoneUtils = {
    DEFAULT_TIMEZONE: 'America/Chicago',
    parseAndConvertToUTC: (dateTime, timezone) => new Date(dateTime),
    convertToFacilityTime: (dateTime, timezone) => new Date(dateTime),
    calculateDurationWithDST: (start, end, timezone) => Math.round((new Date(end) - new Date(start)) / (1000 * 60))
  };
}

const eventController = {
  // FIXED: Create new event with proper timezone handling
  async createEvent(req, res) {
    try {
      const {
        resource_id,
        event_start_date_time,
        event_end_date_time,
        episode_duration,
        repeat_mode,
        repeat_end_date,
        repeat_days,
        generate_episodes,
        episode_data,
        facility_timezone
      } = req.body;

      console.log('Creating event with timezone context:', { 
        resource_id, 
        event_start_date_time, 
        event_end_date_time,
        facility_timezone 
      });

      // Validate required fields
      if (!resource_id || !event_start_date_time || !event_end_date_time) {
        return res.status(400).json({ 
          message: 'Resource ID, start time, and end time are required' 
        });
      }

      // Verify resource exists and get facility context
      const resource = await Resource.findByPk(resource_id, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      if (resource.facility.admin_user_id !== req.user.user_id) {
        return res.status(403).json({ 
          message: 'You do not have permission to create events for this facility' 
        });
      }

      // Get facility timezone (prefer from request, fallback to facility setting)
      const actualFacilityTimezone = facility_timezone || 
                                    resource.facility.facility_time_zone || 
                                    TimezoneUtils.DEFAULT_TIMEZONE;

      console.log(`Using facility timezone: ${actualFacilityTimezone}`);

		// FIXED: Convert facility times to UTC for storage
		let utcStartDateTime, utcEndDateTime;
		try {
		  // Check if times are already in ISO/UTC format
		  const startStr = event_start_date_time.toString();
		  const endStr = event_end_date_time.toString();
		  
		  // If already in ISO format with Z suffix, use as-is
		  if (startStr.includes('Z') || endStr.includes('Z')) {
			utcStartDateTime = new Date(event_start_date_time);
			utcEndDateTime = new Date(event_end_date_time);
			console.log('Times already in UTC format, using as-is');
		  } else {
			// Otherwise treat as facility local time (this shouldn't happen with current frontend)
			utcStartDateTime = TimezoneUtils.parseAndConvertToUTC(event_start_date_time, actualFacilityTimezone);
			utcEndDateTime = TimezoneUtils.parseAndConvertToUTC(event_end_date_time, actualFacilityTimezone);
		  }
		  
		  console.log(`Event time conversion:`);
		  console.log(`  Input start: ${event_start_date_time}`);
		  console.log(`  Input end: ${event_end_date_time}`);
		  console.log(`  Stored UTC start: ${utcStartDateTime.toISOString()}`);
		  console.log(`  Stored UTC end: ${utcEndDateTime.toISOString()}`);
		} catch (conversionError) {
		  console.error('Timezone conversion failed during event creation:', conversionError);
		  return res.status(400).json({ 
			message: 'Failed to convert event times to facility timezone' 
		  });
		}
		
      // Validate converted times
      if (isNaN(utcStartDateTime.getTime()) || isNaN(utcEndDateTime.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date format provided' 
        });
      }

      if (utcStartDateTime >= utcEndDateTime) {
        return res.status(400).json({ 
          message: 'End time must be after start time' 
        });
      }

      const createdEvents = [];
      
      if (repeat_mode === 'once') {
        // Create single event with UTC times
        const event = await createSingleEvent({
          resource_id,
          event_start_date_time: utcStartDateTime,
          event_end_date_time: utcEndDateTime,
          episode_duration: episode_duration || 60,
          created_by: req.user.username,
          facilityTimezone: actualFacilityTimezone
        });
        
        createdEvents.push(event);
        
        if (generate_episodes) {
          await generateEpisodesForEvent(event, resource, req.user, episode_data, actualFacilityTimezone);
        }
      } else {
        // FIXED: Create recurring events with timezone handling
        const recurringEvents = await createRecurringEvents({
          resource_id,
          facilityStartDateTime: new Date(event_start_date_time),
          facilityEndDateTime: new Date(event_end_date_time),
          episode_duration: episode_duration || 60,
          repeat_mode,
          repeat_end_date,
          repeat_days,
          created_by: req.user.username,
          facilityTimezone: actualFacilityTimezone
        });
        
        createdEvents.push(...recurringEvents);
        
        if (generate_episodes) {
          for (const event of recurringEvents) {
            await generateEpisodesForEvent(event, resource, req.user, episode_data, actualFacilityTimezone);
          }
        }
      }

      // Reload events with associations
      const newEvents = await Event.findAll({
        where: { event_id: { [Op.in]: createdEvents.map(e => e.event_id) } },
        include: [
          {
            model: Resource,
            as: 'resource',
            include: [{
              model: Facility,
              as: 'facility'
            }]
          },
          {
            model: Episode,
            as: 'episodes'
          }
        ]
      });

      // FIXED: Convert event times back to facility timezone for response
      const responseEvents = newEvents.map(event => {
        const facilityStartTime = TimezoneUtils.convertToFacilityTime(
          event.event_start_date_time, 
          actualFacilityTimezone
        );
        const facilityEndTime = TimezoneUtils.convertToFacilityTime(
          event.event_end_date_time, 
          actualFacilityTimezone
        );

        return {
          ...event.toJSON(),
          // Override with facility times for frontend
          event_start_date_time: facilityStartTime.toISOString(),
          event_end_date_time: facilityEndTime.toISOString(),
          facilityTimezone: actualFacilityTimezone,
          debug: {
            storedUtcStart: event.event_start_date_time.toISOString(),
            storedUtcEnd: event.event_end_date_time.toISOString()
          }
        };
      });

      res.status(201).json({
        message: `${newEvents.length} event(s) created successfully`,
        events: responseEvents,
        facilityTimezone: actualFacilityTimezone
      });

    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ message: 'Error creating event' });
    }
  },

  // Get events for a resource (unchanged, but add timezone context)
  async getEventsByResource(req, res) {
    try {
      const { resourceId } = req.params;
      const { start, end } = req.query;

      // Get resource for facility timezone context
      const resource = await Resource.findByPk(resourceId, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      const facilityTimezone = resource.facility.facility_time_zone || TimezoneUtils.DEFAULT_TIMEZONE;

      const whereClause = { resource_id: resourceId };
      
      // FIXED: Convert date range to UTC for database query
      if (start && end) {
        try {
          const utcStart = TimezoneUtils.parseAndConvertToUTC(start, facilityTimezone);
          const utcEnd = TimezoneUtils.parseAndConvertToUTC(end, facilityTimezone);
          
          whereClause.event_start_date_time = {
            [Op.between]: [utcStart, utcEnd]
          };
        } catch (conversionError) {
          console.error('Date range conversion error:', conversionError);
          return res.status(400).json({ message: 'Invalid date range format' });
        }
      }

      const events = await Event.findAll({
        where: whereClause,
        include: [
          {
            model: Resource,
            as: 'resource',
            include: [{
              model: Facility,
              as: 'facility'
            }]
          },
          {
            model: Episode,
            as: 'episodes'
          }
        ],
        order: [['event_start_date_time', 'ASC']]
      });

      // FIXED: Convert event times to facility timezone for response
      const responseEvents = events.map(event => {
        const facilityStartTime = TimezoneUtils.convertToFacilityTime(
          event.event_start_date_time, 
          facilityTimezone
        );
        const facilityEndTime = TimezoneUtils.convertToFacilityTime(
          event.event_end_date_time, 
          facilityTimezone
        );

        return {
          ...event.toJSON(),
          // Override with facility times
          event_start_date_time: facilityStartTime.toISOString(),
          event_end_date_time: facilityEndTime.toISOString()
        };
      });

      res.json({
        events: responseEvents,
        total: events.length,
        facilityTimezone
      });

    } catch (error) {
      console.error('Get events error:', error);
      res.status(500).json({ message: 'Error fetching events' });
    }
  },

  // Delete event and its episodes (unchanged)
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;

      const event = await Event.findByPk(id, {
        include: [
          {
            model: Resource,
            as: 'resource',
            include: [{
              model: Facility,
              as: 'facility'
            }]
          },
          {
            model: Episode,
            as: 'episodes',
            include: [{
              model: Booking,
              as: 'bookings'
            }]
          }
        ]
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Check permission
      if (event.resource.facility.admin_user_id !== req.user.user_id) {
        return res.status(403).json({ 
          message: 'You do not have permission to delete this event' 
        });
      }

      // Check if any episodes have bookings
      const hasBookings = event.episodes.some(episode => 
        episode.bookings && episode.bookings.length > 0
      );

      if (hasBookings) {
        return res.status(400).json({ 
          message: 'Cannot delete event with episodes that have bookings' 
        });
      }

      // Delete all episodes first
      await Episode.destroy({
        where: { event_id: id }
      });

      // Delete the event
      await event.destroy();

      res.json({ message: 'Event and episodes deleted successfully' });

    } catch (error) {
      console.error('Delete event error:', error);
      res.status(500).json({ message: 'Error deleting event' });
    }
  }
};

// FIXED: Helper function to create a single event with timezone handling
async function createSingleEvent(eventData) {
  const {
    resource_id,
    event_start_date_time,
    event_end_date_time,
    episode_duration,
    created_by,
    facilityTimezone
  } = eventData;

  console.log('Creating single event with UTC times:', {
    utcStart: event_start_date_time.toISOString(),
    utcEnd: event_end_date_time.toISOString()
  });

  return await Event.create({
    resource_id,
    // Store UTC times in database
    event_start_date_time,
    event_end_date_time,
    // Extract date/time components for legacy fields (using facility timezone)
    event_start_date: event_start_date_time.toISOString().split('T')[0],
    event_end_date: event_end_date_time.toISOString().split('T')[0],
    event_start_time: event_start_date_time.toTimeString().split(' ')[0],
    event_end_time: event_end_date_time.toTimeString().split(' ')[0],
    episode_duration,
    repeat_mode: 'once',
    created_by,
    updated_by: created_by
  });
}

// FIXED: Helper function to create recurring events with timezone handling
async function createRecurringEvents(eventData) {
  const {
    resource_id,
    facilityStartDateTime,
    facilityEndDateTime,
    episode_duration,
    repeat_mode,
    repeat_end_date,
    repeat_days,
    created_by,
    facilityTimezone
  } = eventData;

  const events = [];
  const timeDiff = facilityEndDateTime.getTime() - facilityStartDateTime.getTime();
  
  // Parse repeat end date in facility timezone
  let facilityRepeatEndDate;
  try {
    facilityRepeatEndDate = new Date(repeat_end_date + 'T23:59:59');
  } catch (error) {
    console.error('Invalid repeat end date:', repeat_end_date);
    throw new Error('Invalid repeat end date format');
  }
  
  let currentFacilityDate = new Date(facilityStartDateTime);
  
  console.log(`Creating recurring events from ${facilityStartDateTime.toISOString()} to ${facilityRepeatEndDate.toISOString()} in ${facilityTimezone}`);
  
  while (currentFacilityDate <= facilityRepeatEndDate) {
    let shouldCreate = false;
    
    switch (repeat_mode) {
      case 'daily':
        shouldCreate = true;
        break;
        
      case 'weekly':
        if (repeat_days && repeat_days.includes(currentFacilityDate.getDay())) {
          shouldCreate = true;
        }
        break;
        
      case 'biweekly':
        if (repeat_days && repeat_days.includes(currentFacilityDate.getDay())) {
          const weeksDiff = Math.floor((currentFacilityDate - facilityStartDateTime) / (7 * 24 * 60 * 60 * 1000));
          if (weeksDiff % 2 === 0) {
            shouldCreate = true;
          }
        }
        break;
    }
    
    if (shouldCreate) {
      const facilityEventStart = new Date(currentFacilityDate);
      const facilityEventEnd = new Date(currentFacilityDate.getTime() + timeDiff);
      
      // FIXED: Convert facility times to UTC for storage
      const utcEventStart = TimezoneUtils.parseAndConvertToUTC(
        facilityEventStart.toISOString(), 
        facilityTimezone
      );
      const utcEventEnd = TimezoneUtils.parseAndConvertToUTC(
        facilityEventEnd.toISOString(), 
        facilityTimezone
      );
      
      console.log(`Creating recurring event: ${facilityEventStart.toISOString()} (facility) -> ${utcEventStart.toISOString()} (UTC)`);
      
      const event = await Event.create({
        resource_id,
        // Store UTC times
        event_start_date_time: utcEventStart,
        event_end_date_time: utcEventEnd,
        // Legacy date/time fields
        event_start_date: utcEventStart.toISOString().split('T')[0],
        event_end_date: utcEventEnd.toISOString().split('T')[0],
        event_start_time: utcEventStart.toTimeString().split(' ')[0],
        event_end_time: utcEventEnd.toTimeString().split(' ')[0],
        episode_duration,
        repeat_mode,
        created_by,
        updated_by: created_by
      });
      
      events.push(event);
    }
    
    // Move to next day
    currentFacilityDate.setDate(currentFacilityDate.getDate() + 1);
  }
  
  console.log(`Created ${events.length} recurring events`);
  return events;
}

// FIXED: Helper function to generate episodes for an event with timezone handling
async function generateEpisodesForEvent(event, resource, user, episodeData = {}, facilityTimezone) {
  console.log(`Generating episodes for event ${event.event_id} in timezone ${facilityTimezone}`);
  
  // Use stored UTC times from event
  const utcStartTime = new Date(event.event_start_date_time);
  const utcEndTime = new Date(event.event_end_date_time);
  const duration = event.episode_duration || 60; // in minutes

  const episodes = [];
  let currentUtcStart = new Date(utcStartTime);

  console.log(`Episode generation: UTC ${utcStartTime.toISOString()} to ${utcEndTime.toISOString()}, duration ${duration}min`);

  while (currentUtcStart < utcEndTime) {
    const currentUtcEnd = new Date(currentUtcStart.getTime() + duration * 60000);
    
    if (currentUtcEnd > utcEndTime) {
      console.log('Episode would exceed event end time, stopping generation');
      break;
    }

    // Convert to facility time for title generation
    const facilityStart = TimezoneUtils.convertToFacilityTime(currentUtcStart, facilityTimezone);
    const facilityEnd = TimezoneUtils.convertToFacilityTime(currentUtcEnd, facilityTimezone);

    episodes.push({
      event_id: event.event_id,
      // Store UTC times in database
      episode_start_date_time: new Date(currentUtcStart),
      episode_end_date_time: new Date(currentUtcEnd),
      episode_duration: duration,
      episode_title: episodeData.episode_title || `Ice Time - ${resource.resource_name}`,
      episode_description: episodeData.episode_description || '',
      episode_status: 'available',
      episode_price: episodeData.episode_price || 150.00,
      created_by: user.username,
      updated_by: user.username
    });

    console.log(`  Episode: UTC ${currentUtcStart.toISOString()} to ${currentUtcEnd.toISOString()} (Facility: ${facilityStart.toISOString()} to ${facilityEnd.toISOString()})`);

    currentUtcStart = new Date(currentUtcEnd);
  }

  if (episodes.length > 0) {
    await Episode.bulkCreate(episodes);
    console.log(`Created ${episodes.length} episodes for event ${event.event_id}`);
  }

  return episodes.length;
}

module.exports = eventController;
// backend/src/controllers/eventController.js (Fixed with Proper UTC Storage)
const { Event, Episode, Resource, Facility, Booking } = require('../models');
const { Op } = require('sequelize');

const eventController = {
  // Create new event with proper UTC storage
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

      console.log('Creating event with data:', { 
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

      // FIXED: Expect and store UTC times directly
      // The frontend should send times already in UTC
      const utcStartDateTime = new Date(event_start_date_time);
      const utcEndDateTime = new Date(event_end_date_time);

      // Validate times
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

      console.log(`Storing event with UTC times: ${utcStartDateTime.toISOString()} to ${utcEndDateTime.toISOString()}`);

      const createdEvents = [];
      
      if (repeat_mode === 'once') {
        // Create single event with UTC times
        const event = await createSingleEvent({
          resource_id,
          event_start_date_time: utcStartDateTime,
          event_end_date_time: utcEndDateTime,
          episode_duration: episode_duration || 60,
          created_by: req.user.username
        });
        
        createdEvents.push(event);
        
        if (generate_episodes) {
          await generateEpisodesForEvent(event, resource, req.user, episode_data);
        }
      } else {
        // Create recurring events with UTC times
        const recurringEvents = await createRecurringEvents({
          resource_id,
          startDateTime: utcStartDateTime,
          endDateTime: utcEndDateTime,
          episode_duration: episode_duration || 60,
          repeat_mode,
          repeat_end_date,
          repeat_days,
          created_by: req.user.username,
          facility_timezone: facility_timezone || resource.facility.facility_time_zone
        });
        
        createdEvents.push(...recurringEvents);
        
        if (generate_episodes) {
          for (const event of recurringEvents) {
            await generateEpisodesForEvent(event, resource, req.user, episode_data);
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

      // FIXED: Return UTC times without conversion
      // Include timezone info for frontend to handle display
      res.status(201).json({
        message: `${newEvents.length} event(s) created successfully`,
        events: newEvents.map(event => ({
          ...event.toJSON(),
          facilityTimezone: facility_timezone || resource.facility.facility_time_zone
        }))
      });

    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ message: 'Error creating event' });
    }
  },

  // Get events for a resource
  async getEventsByResource(req, res) {
    try {
      const { resourceId } = req.params;
      const { start, end } = req.query;

      // Get resource for context
      const resource = await Resource.findByPk(resourceId, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      const whereClause = { resource_id: resourceId };
      
      // FIXED: Accept UTC date range from frontend
      if (start && end) {
        const utcStart = new Date(start);
        const utcEnd = new Date(end);
        
        if (!isNaN(utcStart.getTime()) && !isNaN(utcEnd.getTime())) {
          whereClause.event_start_date_time = {
            [Op.between]: [utcStart, utcEnd]
          };
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

      // FIXED: Return UTC times without conversion
      res.json({
        events: events.map(event => ({
          ...event.toJSON(),
          facilityTimezone: resource.facility.facility_time_zone
        })),
        total: events.length
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

// Helper function to create a single event
async function createSingleEvent(eventData) {
  const {
    resource_id,
    event_start_date_time,
    event_end_date_time,
    episode_duration,
    created_by
  } = eventData;

  return await Event.create({
    resource_id,
    // Store UTC times
    event_start_date_time,
    event_end_date_time,
    // Legacy fields - extract from UTC (these will be in UTC)
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

// Helper function to create recurring events
async function createRecurringEvents(eventData) {
  const {
    resource_id,
    startDateTime,
    endDateTime,
    episode_duration,
    repeat_mode,
    repeat_end_date,
    repeat_days,
    created_by,
    facility_timezone
  } = eventData;

  const events = [];
  const timeDiff = endDateTime.getTime() - startDateTime.getTime();
  
  // Parse repeat end date as UTC
  const repeatEndDate = new Date(repeat_end_date + 'T23:59:59Z');
  
  let currentDate = new Date(startDateTime);
  
  while (currentDate <= repeatEndDate) {
    let shouldCreate = false;
    
    switch (repeat_mode) {
      case 'daily':
        shouldCreate = true;
        break;
        
      case 'weekly':
        if (repeat_days && repeat_days.includes(currentDate.getDay())) {
          shouldCreate = true;
        }
        break;
        
      case 'biweekly':
        if (repeat_days && repeat_days.includes(currentDate.getDay())) {
          const weeksDiff = Math.floor((currentDate - startDateTime) / (7 * 24 * 60 * 60 * 1000));
          if (weeksDiff % 2 === 0) {
            shouldCreate = true;
          }
        }
        break;
    }
    
    if (shouldCreate) {
      const eventStart = new Date(currentDate);
      const eventEnd = new Date(currentDate.getTime() + timeDiff);
      
      const event = await Event.create({
        resource_id,
        // Store UTC times
        event_start_date_time: eventStart,
        event_end_date_time: eventEnd,
        // Legacy fields
        event_start_date: eventStart.toISOString().split('T')[0],
        event_end_date: eventEnd.toISOString().split('T')[0],
        event_start_time: eventStart.toTimeString().split(' ')[0],
        event_end_time: eventEnd.toTimeString().split(' ')[0],
        episode_duration,
        repeat_mode,
        created_by,
        updated_by: created_by
      });
      
      events.push(event);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return events;
}

// Helper function to generate episodes for an event
async function generateEpisodesForEvent(event, resource, user, episodeData = {}) {
  const startTime = new Date(event.event_start_date_time);
  const endTime = new Date(event.event_end_date_time);
  const duration = event.episode_duration || 60; // in minutes

  const episodes = [];
  let currentStart = new Date(startTime);

  while (currentStart < endTime) {
    const currentEnd = new Date(currentStart.getTime() + duration * 60000);
    
    if (currentEnd > endTime) {
      break;
    }

    episodes.push({
      event_id: event.event_id,
      // Store UTC times
      episode_start_date_time: new Date(currentStart),
      episode_end_date_time: new Date(currentEnd),
      episode_duration: duration,
      episode_title: episodeData.episode_title || `Ice Time - ${resource.resource_name}`,
      episode_description: episodeData.episode_description || '',
      episode_status: 'available',
      episode_price: episodeData.episode_price || 150.00,
      created_by: user.username,
      updated_by: user.username
    });

    currentStart = new Date(currentEnd);
  }

  if (episodes.length > 0) {
    await Episode.bulkCreate(episodes);
  }

  return episodes.length;
}

module.exports = eventController;
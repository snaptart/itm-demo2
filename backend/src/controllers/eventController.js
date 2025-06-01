const { Event, Episode, Resource, Facility } = require('../models');
const { Op } = require('sequelize');

const eventController = {
  // Create new event (Admin only)
  async createEvent(req, res) {
    try {
      const {
        resource_id,
        event_start_date_time,
        event_end_date_time,
        episode_duration,
        repeat_mode,
        generate_episodes
      } = req.body;

      // Validate required fields
      if (!resource_id || !event_start_date_time || !event_end_date_time) {
        return res.status(400).json({ 
          message: 'Resource ID, start time, and end time are required' 
        });
      }

      // Verify resource exists and user has permission
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

      // Create event
      const event = await Event.create({
        resource_id,
        event_start_date_time: new Date(event_start_date_time),
        event_end_date_time: new Date(event_end_date_time),
        event_start_date: new Date(event_start_date_time).toISOString().split('T')[0],
        event_end_date: new Date(event_end_date_time).toISOString().split('T')[0],
        event_start_time: new Date(event_start_date_time).toTimeString().split(' ')[0],
        event_end_time: new Date(event_end_date_time).toTimeString().split(' ')[0],
        episode_duration: episode_duration || 60,
        repeat_mode: repeat_mode || 'once',
        created_by: req.user.username,
        updated_by: req.user.username
      });

      // Generate episodes if requested
      if (generate_episodes) {
        await this.generateEpisodesForEvent(event, resource, req.user);
      }

      // Reload with associations
      const newEvent = await Event.findByPk(event.event_id, {
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

      res.status(201).json({
        message: 'Event created successfully',
        event: newEvent
      });

    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ message: 'Error creating event' });
    }
  },

  // Generate episodes for an event
  async generateEpisodesForEvent(event, resource, user) {
    const startTime = new Date(event.event_start_date_time);
    const endTime = new Date(event.event_end_date_time);
    const duration = event.episode_duration || 60; // in minutes

    const episodes = [];
    let currentStart = new Date(startTime);

    while (currentStart < endTime) {
      const currentEnd = new Date(currentStart.getTime() + duration * 60000);
      
      if (currentEnd > endTime) break;

      episodes.push({
        event_id: event.event_id,
        episode_start_date_time: new Date(currentStart),
        episode_end_date_time: new Date(currentEnd),
        episode_duration: duration,
        episode_title: `Ice Time - ${resource.resource_name}`,
        episode_status: 'available',
        episode_price: resource.facility.base_price || 150.00,
        created_by: user.username,
        updated_by: user.username
      });

      currentStart = new Date(currentEnd);
    }

    if (episodes.length > 0) {
      await Episode.bulkCreate(episodes);
    }

    return episodes.length;
  },

  // Get events for a resource
  async getEventsByResource(req, res) {
    try {
      const { resourceId } = req.params;
      const { start, end } = req.query;

      const whereClause = { resource_id: resourceId };
      
      if (start && end) {
        whereClause.event_start_date_time = {
          [Op.between]: [new Date(start), new Date(end)]
        };
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

      res.json({
        events,
        total: events.length
      });

    } catch (error) {
      console.error('Get events error:', error);
      res.status(500).json({ message: 'Error fetching events' });
    }
  },

  // Delete event and its episodes (Admin only)
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

module.exports = eventController;
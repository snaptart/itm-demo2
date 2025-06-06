// backend/src/middleware/realtimeMiddleware.js
const websocketService = require('../services/websocketService');

// Middleware to integrate real-time updates with existing controllers
const realtimeMiddleware = {
  
  // Middleware for episode operations
  episodeOperations: (operation) => {
    return async (req, res, next) => {
      // Store original response methods
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      
      let statusCode = 200;
      
      // Override res.status to capture status code
      res.status = function(code) {
        statusCode = code;
        return originalStatus(code);
      };
      
      // Override res.json to intercept successful responses
      res.json = function(data) {
        // Only broadcast on successful operations
        if (statusCode >= 200 && statusCode < 300 && data && !data.error) {
          setImmediate(async () => {
            try {
              await realtimeMiddleware.handleEpisodeOperation(operation, req, data);
            } catch (error) {
              console.error('Real-time broadcast error:', error);
            }
          });
        }
        
        return originalJson(data);
      };
      
      next();
    };
  },

  // Handle different episode operations
  async handleEpisodeOperation(operation, req, responseData) {
    const facilityId = await realtimeMiddleware.extractFacilityId(req, responseData);
    if (!facilityId) return;

    switch (operation) {
      case 'create':
        if (responseData.events) {
          // Handle event creation (which creates episodes)
          for (const event of responseData.events) {
            await websocketService.broadcastEpisodeCreated(facilityId, event);
          }
        }
        break;

      case 'update':
        if (responseData.episode) {
          const episodeId = responseData.episode.episode_id || req.params.id;
          const updates = realtimeMiddleware.extractUpdateFields(req.body);
          
          await websocketService.broadcastEpisodeUpdated(facilityId, episodeId, {
            ...updates,
            episode: responseData.episode
          });
        }
        break;

      case 'delete':
        const episodeId = req.params.id;
        await websocketService.broadcastEpisodeDeleted(facilityId, episodeId);
        break;

      case 'move':
        if (responseData.episode) {
          const episodeId = responseData.episode.episode_id || req.params.id;
          await websocketService.broadcastEpisodeMoved(
            facilityId, 
            episodeId, 
            req.body.new_start_time,
            req.body.new_end_time
          );
        }
        break;

      case 'resize':
        if (responseData.episode) {
          const episodeId = responseData.episode.episode_id || req.params.id;
          await websocketService.broadcastEpisodeUpdated(facilityId, episodeId, {
            episode_end_date_time: req.body.new_end_time,
            episode: responseData.episode
          });
        }
        break;
    }
  },

  // Extract facility ID from request/response
  async extractFacilityId(req, responseData) {
    // Try to get from response data first
    if (responseData.episode?.event?.resource?.facility_id) {
      return responseData.episode.event.resource.facility_id;
    }
    
    if (responseData.events?.[0]?.resource?.facility_id) {
      return responseData.events[0].resource.facility_id;
    }

    // Try to get from request parameters
    if (req.body.facility_id) {
      return req.body.facility_id;
    }

    // Try to get from episode if we have episode ID
    if (req.params.id) {
      try {
        const { Episode, Event, Resource } = require('../models');
        const episode = await Episode.findByPk(req.params.id, {
          include: [{
            model: Event,
            as: 'event',
            include: [{
              model: Resource,
              as: 'resource'
            }]
          }]
        });
        
        return episode?.event?.resource?.facility_id;
      } catch (error) {
        console.error('Error extracting facility ID:', error);
      }
    }

    return null;
  },

  // Extract update fields for delta broadcasting
  extractUpdateFields(body) {
    const updateFields = {};
    const relevantFields = [
      'episode_title',
      'episode_description', 
      'episode_price',
      'episode_status',
      'assigned_to_program_id'
    ];

    for (const field of relevantFields) {
      if (body.hasOwnProperty(field)) {
        updateFields[field] = body[field];
      }
    }

    return updateFields;
  },

  // Middleware to check episode locks before operations
  checkEpisodeLock: async (req, res, next) => {
    const episodeId = req.params.id;
    const userId = req.user.user_id;

    if (!episodeId) {
      return next();
    }

    const lock = websocketService.isEpisodeLocked(episodeId);
    
    if (lock && lock.userId !== userId) {
      return res.status(423).json({
        message: `Episode is currently being edited by ${lock.username}`,
        lockedBy: lock.username,
        lockTime: lock.lockTime
      });
    }

    next();
  },

  // Middleware for request operations
  requestOperations: (operation) => {
    return async (req, res, next) => {
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      
      let statusCode = 200;
      
      res.status = function(code) {
        statusCode = code;
        return originalStatus(code);
      };
      
      res.json = function(data) {
        if (statusCode >= 200 && statusCode < 300 && data && !data.error) {
          setImmediate(async () => {
            try {
              await realtimeMiddleware.handleRequestOperation(operation, req, data);
            } catch (error) {
              console.error('Real-time request broadcast error:', error);
            }
          });
        }
        
        return originalJson(data);
      };
      
      next();
    };
  },

  // Handle request operations
  async handleRequestOperation(operation, req, responseData) {
    try {
      const { RealtimeNotification } = require('../models');
      
      switch (operation) {
        case 'submit':
          if (responseData.requests) {
            // Broadcast to facility admins
            for (const request of responseData.requests) {
              await RealtimeNotification.createForFacility(request.facility_id, 'request:new', {
                title: 'New Ice Time Request',
                message: `${req.user.first_name} ${req.user.last_name} submitted a request`,
                request_id: request.request_id,
                episode_id: request.episode_id,
                user_id: req.user.user_id,
                created_by_user_id: req.user.user_id
              });
            }
          }
          break;

        case 'approve':
        case 'reject':
          if (responseData.request) {
            const request = responseData.request;
            
            // Notify the requester
            await RealtimeNotification.createForUser(request.user_id, `request:${operation}d`, {
              title: `Request ${operation === 'approve' ? 'Approved' : 'Rejected'}`,
              message: `Your ice time request has been ${operation}d`,
              request_id: request.request_id,
              created_by_user_id: req.user.user_id
            });
          }
          break;
      }
    } catch (error) {
      console.error('Request operation broadcast error:', error);
    }
  }
};

module.exports = realtimeMiddleware;
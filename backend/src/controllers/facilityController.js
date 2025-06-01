const { Facility, Resource, User, ResourceType } = require('../models');
const { Op } = require('sequelize');

const facilityController = {
  // Get all facilities
  async getAllFacilities(req, res) {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Op.or] = [
          { facility_name: { [Op.iLike]: `%${search}%` } },
          { facility_city: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Admin sees all facilities, scheduler sees only their assigned facilities
      if (req.user.user_type === 'scheduler') {
        // TODO: Add logic to filter based on scheduler's assigned facilities
      }

      const { count, rows } = await Facility.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'adminUser',
            attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
          },
          {
            model: Resource,
            as: 'resources',
            where: { resource_status: 'active' },
            required: false
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['facility_name', 'ASC']]
      });

      res.json({
        facilities: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Get facilities error:', error);
      res.status(500).json({ message: 'Error fetching facilities' });
    }
  },

  // Get single facility by ID
  async getFacilityById(req, res) {
    try {
      const { id } = req.params;

      const facility = await Facility.findByPk(id, {
        include: [
          {
            model: User,
            as: 'adminUser',
            attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
          },
          {
            model: Resource,
            as: 'resources',
            include: [{
              model: ResourceType,
              as: 'resourceType'
            }]
          }
        ]
      });

      if (!facility) {
        return res.status(404).json({ message: 'Facility not found' });
      }

      res.json(facility);
    } catch (error) {
      console.error('Get facility error:', error);
      res.status(500).json({ message: 'Error fetching facility' });
    }
  },

  // Create new facility (Admin only)
  async createFacility(req, res) {
    try {
      const {
        facility_name,
        facility_address_1,
        facility_address_2,
        facility_city,
        facility_state,
        facility_postal_code,
        facility_country,
        facility_time_zone,
        facility_daily_start_time,
        facility_daily_end_time,
        ice_resurfacing_duration,
        min_booking_duration,
        max_booking_duration,
        advance_booking_days,
        cancellation_hours
      } = req.body;

      // Validate required fields
      if (!facility_name || !facility_city || !facility_state) {
        return res.status(400).json({ 
          message: 'Facility name, city, and state are required' 
        });
      }

      const facility = await Facility.create({
        ...req.body,
        admin_user_id: req.user.user_id,
        created_by: req.user.username,
        updated_by: req.user.username
      });

      // Reload with associations
      const newFacility = await Facility.findByPk(facility.facility_id, {
        include: [{
          model: User,
          as: 'adminUser',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        }]
      });

      res.status(201).json({
        message: 'Facility created successfully',
        facility: newFacility
      });
    } catch (error) {
      console.error('Create facility error:', error);
      res.status(500).json({ message: 'Error creating facility' });
    }
  },

  // Update facility (Admin only)
  async updateFacility(req, res) {
    try {
      const { id } = req.params;

      const facility = await Facility.findByPk(id);
      if (!facility) {
        return res.status(404).json({ message: 'Facility not found' });
      }

      // Check if user is admin of this facility
      if (req.user.user_type !== 'admin' || 
          (facility.admin_user_id && facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to update this facility' 
        });
      }

      await facility.update({
        ...req.body,
        updated_by: req.user.username
      });

      const updatedFacility = await Facility.findByPk(id, {
        include: [
          {
            model: User,
            as: 'adminUser',
            attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
          },
          {
            model: Resource,
            as: 'resources'
          }
        ]
      });

      res.json({
        message: 'Facility updated successfully',
        facility: updatedFacility
      });
    } catch (error) {
      console.error('Update facility error:', error);
      res.status(500).json({ message: 'Error updating facility' });
    }
  },

  // Delete facility (Admin only)
  async deleteFacility(req, res) {
    try {
      const { id } = req.params;

      const facility = await Facility.findByPk(id);
      if (!facility) {
        return res.status(404).json({ message: 'Facility not found' });
      }

      // Check if user is admin of this facility
      if (req.user.user_type !== 'admin' || 
          (facility.admin_user_id && facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to delete this facility' 
        });
      }

      // Check if facility has active resources
      const activeResources = await Resource.count({
        where: { 
          facility_id: id,
          resource_status: 'active'
        }
      });

      if (activeResources > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete facility with active resources' 
        });
      }

      await facility.destroy();

      res.json({ message: 'Facility deleted successfully' });
    } catch (error) {
      console.error('Delete facility error:', error);
      res.status(500).json({ message: 'Error deleting facility' });
    }
  },

  // Get facility statistics
  async getFacilityStats(req, res) {
    try {
      const { id } = req.params;

      const facility = await Facility.findByPk(id);
      if (!facility) {
        return res.status(404).json({ message: 'Facility not found' });
      }

      // Get resource count
      const resourceCount = await Resource.count({
        where: { facility_id: id }
      });

      // Get active resource count
      const activeResourceCount = await Resource.count({
        where: { 
          facility_id: id,
          resource_status: 'active'
        }
      });

      // TODO: Add more statistics (bookings, utilization, revenue, etc.)

      res.json({
        facility_id: id,
        facility_name: facility.facility_name,
        statistics: {
          total_resources: resourceCount,
          active_resources: activeResourceCount,
          // Add more stats here
        }
      });
    } catch (error) {
      console.error('Get facility stats error:', error);
      res.status(500).json({ message: 'Error fetching facility statistics' });
    }
  }
};

module.exports = facilityController;
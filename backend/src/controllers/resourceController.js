const { Resource, Facility, ResourceType } = require('../models');
const { Op } = require('sequelize');

const resourceController = {
  // Get all resources for a facility
  async getResourcesByFacility(req, res) {
    try {
      const { facilityId } = req.params;
      const { status } = req.query;

      const whereClause = { facility_id: facilityId };
      if (status) {
        whereClause.resource_status = status;
      }

      const resources = await Resource.findAll({
        where: whereClause,
        include: [
          {
            model: ResourceType,
            as: 'resourceType'
          }
        ],
        order: [['resource_name', 'ASC']]
      });

      res.json(resources);
    } catch (error) {
      console.error('Get resources error:', error);
      res.status(500).json({ message: 'Error fetching resources' });
    }
  },

  // Get single resource by ID
  async getResourceById(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findByPk(id, {
        include: [
          {
            model: Facility,
            as: 'facility',
            attributes: ['facility_id', 'facility_name']
          },
          {
            model: ResourceType,
            as: 'resourceType'
          }
        ]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      res.json(resource);
    } catch (error) {
      console.error('Get resource error:', error);
      res.status(500).json({ message: 'Error fetching resource' });
    }
  },

  // Create new resource (Admin only)
  async createResource(req, res) {
    try {
      const {
        facility_id,
        resource_name,
        resource_type_id,
        resource_status,
        resource_desc
      } = req.body;

      // Validate required fields
      if (!facility_id || !resource_name || !resource_type_id) {
        return res.status(400).json({ 
          message: 'Facility ID, resource name, and resource type are required' 
        });
      }

      // Verify facility exists and user has permission
      const facility = await Facility.findByPk(facility_id);
      if (!facility) {
        return res.status(404).json({ message: 'Facility not found' });
      }

      if (req.user.user_type !== 'admin' || 
          (facility.admin_user_id && facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to add resources to this facility' 
        });
      }

      // Verify resource type exists
      const resourceType = await ResourceType.findByPk(resource_type_id);
      if (!resourceType) {
        return res.status(404).json({ message: 'Resource type not found' });
      }

      const resource = await Resource.create({
        facility_id,
        resource_name,
        resource_type_id,
        resource_status: resource_status || 'active',
        resource_desc,
        created_by: req.user.username,
        updated_by: req.user.username
      });

      // Reload with associations
      const newResource = await Resource.findByPk(resource.resource_id, {
        include: [
          {
            model: Facility,
            as: 'facility',
            attributes: ['facility_id', 'facility_name']
          },
          {
            model: ResourceType,
            as: 'resourceType'
          }
        ]
      });

      res.status(201).json({
        message: 'Resource created successfully',
        resource: newResource
      });
    } catch (error) {
      console.error('Create resource error:', error);
      res.status(500).json({ message: 'Error creating resource' });
    }
  },

  // Update resource (Admin only)
  async updateResource(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findByPk(id, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      // Check if user has permission
      if (req.user.user_type !== 'admin' || 
          (resource.facility.admin_user_id && 
           resource.facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to update this resource' 
        });
      }

      await resource.update({
        ...req.body,
        updated_by: req.user.username
      });

      const updatedResource = await Resource.findByPk(id, {
        include: [
          {
            model: Facility,
            as: 'facility',
            attributes: ['facility_id', 'facility_name']
          },
          {
            model: ResourceType,
            as: 'resourceType'
          }
        ]
      });

      res.json({
        message: 'Resource updated successfully',
        resource: updatedResource
      });
    } catch (error) {
      console.error('Update resource error:', error);
      res.status(500).json({ message: 'Error updating resource' });
    }
  },

  // Delete resource (Admin only)
  async deleteResource(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findByPk(id, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      // Check if user has permission
      if (req.user.user_type !== 'admin' || 
          (resource.facility.admin_user_id && 
           resource.facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to delete this resource' 
        });
      }

      // Check if resource has future events
      // TODO: Uncomment when Event model is created
      // const futureEvents = await Event.count({
      //   where: {
      //     resource_id: id,
      //     event_start_date_time: {
      //       [Op.gt]: new Date()
      //     }
      //   }
      // });

      // if (futureEvents > 0) {
      //   return res.status(400).json({ 
      //     message: 'Cannot delete resource with scheduled future events' 
      //   });
      // }

      await resource.destroy();

      res.json({ message: 'Resource deleted successfully' });
    } catch (error) {
      console.error('Delete resource error:', error);
      res.status(500).json({ message: 'Error deleting resource' });
    }
  },

  // Get all resource types
  async getResourceTypes(req, res) {
    try {
      const resourceTypes = await ResourceType.findAll({
        order: [['resource_type_name', 'ASC']]
      });

      res.json(resourceTypes);
    } catch (error) {
      console.error('Get resource types error:', error);
      res.status(500).json({ message: 'Error fetching resource types' });
    }
  },

  // Toggle resource status (Admin only)
  async toggleResourceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'inactive', 'maintenance'].includes(status)) {
        return res.status(400).json({ 
          message: 'Invalid status. Must be active, inactive, or maintenance' 
        });
      }

      const resource = await Resource.findByPk(id, {
        include: [{
          model: Facility,
          as: 'facility'
        }]
      });

      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      // Check if user has permission
      if (req.user.user_type !== 'admin' || 
          (resource.facility.admin_user_id && 
           resource.facility.admin_user_id !== req.user.user_id)) {
        return res.status(403).json({ 
          message: 'You do not have permission to update this resource' 
        });
      }

      await resource.update({
        resource_status: status,
        updated_by: req.user.username
      });

      res.json({
        message: 'Resource status updated successfully',
        resource: {
          resource_id: resource.resource_id,
          resource_name: resource.resource_name,
          resource_status: resource.resource_status
        }
      });
    } catch (error) {
      console.error('Toggle resource status error:', error);
      res.status(500).json({ message: 'Error updating resource status' });
    }
  }
};

module.exports = resourceController;
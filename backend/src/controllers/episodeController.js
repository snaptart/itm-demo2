// backend/src/controllers/episodeController.js - Update and Delete methods

  // Update episode
  async updateEpisode(req, res) {
    let transaction = null;
    
    try {
      const { id } = req.params;
      const {
        episode_title,
        episode_description,
        episode_price,
        episode_status,
        assigned_to_program_id
      } = req.body;

      console.log(`Updating episode ${id} with data:`, req.body);

      // Validate episode ID
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

      // Check permission - Admin only
      if (req.user.user_type !== 'admin') {
        return res.status(403).json({ 
          message: 'Only administrators can update episodes' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      // Get episode with associations
      const episode = await Episode.findByPk(id, {
        include: [
          {
            model: Event,
            as: 'event',
            include: [{
              model: Resource,
              as: 'resource',
              include: [{
                model: Facility,
                as: 'facility'
              }]
            }]
          },
          {
            model: Booking,
            as: 'bookings',
            where: {
              booking_status: {
                [Op.in]: ['pending', 'approved']
              }
            },
            required: false
          }
        ],
        transaction
      });

      if (!episode) {
        await transaction.rollback();
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Validation: Cannot update past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update past episodes' 
        });
      }

      // Validation: Cannot update booked episodes
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update booked episodes' 
        });
      }

      // Validation: Cannot update episodes with active bookings
      if (episode.bookings && episode.bookings.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot update episodes with active bookings' 
        });
      }

      // If assigning to a program, verify the program exists
      if (assigned_to_program_id) {
        const program = await Program.findByPk(assigned_to_program_id, { transaction });
        if (!program) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid program ID' 
          });
        }
      }

      // Build update object
      const updateData = {
        updated_by: req.user.username
      };

      // Only update provided fields
      if (episode_title !== undefined) {
        updateData.episode_title = episode_title.trim();
      }
      if (episode_description !== undefined) {
        updateData.episode_description = episode_description.trim();
      }
      if (episode_price !== undefined) {
        updateData.episode_price = episode_price === '' ? null : parseFloat(episode_price);
      }
      if (episode_status !== undefined) {
        // Validate status transition
        const validStatuses = ['available', 'assigned', 'pending', 'booked', 'maintenance', 'cancelled'];
        if (!validStatuses.includes(episode_status)) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: 'Invalid episode status' 
          });
        }
        updateData.episode_status = episode_status;
      }
      if (assigned_to_program_id !== undefined) {
        updateData.assigned_to_program_id = assigned_to_program_id || null;
        
        // If assigning to a program, update status to 'assigned' if currently 'available'
        if (assigned_to_program_id && episode.episode_status === 'available') {
          updateData.episode_status = 'assigned';
        }
        
        // If removing program assignment and status is 'assigned', revert to 'available'
        if (!assigned_to_program_id && episode.episode_status === 'assigned') {
          updateData.episode_status = 'available';
        }
      }

      // Update the episode
      await episode.update(updateData, { transaction });

      // Commit transaction
      await transaction.commit();

      console.log(`Successfully updated episode ${id}`);

      // Reload with all associations
      const updatedEpisode = await Episode.findByPk(id, {
        include: [
          {
            model: Event,
            as: 'event',
            include: [{
              model: Resource,
              as: 'resource',
              include: [{
                model: Facility,
                as: 'facility'
              }]
            }]
          },
          {
            model: Program,
            as: 'program'
          },
          {
            model: Program,
            as: 'assignedProgram'
          },
          {
            model: Booking,
            as: 'bookings',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
              },
              {
                model: Program,
                as: 'program'
              }
            ]
          }
        ]
      });

      res.json({
        message: 'Episode updated successfully',
        episode: {
          ...updatedEpisode.toJSON(),
          facilityTimezone: updatedEpisode.event.resource.facility.facility_time_zone
        }
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Update episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while updating the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Delete episode
  async deleteEpisode(req, res) {
    let transaction = null;
    
    try {
      const { id } = req.params;

      console.log(`Deleting episode ${id}`);

      // Validate episode ID
      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid episode ID' 
        });
      }

      // Check permission - Admin only
      if (req.user.user_type !== 'admin') {
        return res.status(403).json({ 
          message: 'Only administrators can delete episodes' 
        });
      }

      // Start transaction
      transaction = await sequelize.transaction();

      // Get episode with associations
      const episode = await Episode.findByPk(id, {
        include: [
          {
            model: Event,
            as: 'event',
            include: [{
              model: Resource,
              as: 'resource',
              include: [{
                model: Facility,
                as: 'facility'
              }]
            }]
          },
          {
            model: Booking,
            as: 'bookings'
          }
        ],
        transaction
      });

      if (!episode) {
        await transaction.rollback();
        return res.status(404).json({ 
          message: 'Episode not found' 
        });
      }

      // Validation: Cannot delete past episodes
      if (new Date(episode.episode_start_date_time) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete past episodes' 
        });
      }

      // Validation: Cannot delete booked episodes
      if (episode.episode_status === 'booked') {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete booked episodes' 
        });
      }

      // Validation: Cannot delete episodes with any bookings
      if (episode.bookings && episode.bookings.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete episodes that have bookings. Please cancel all bookings first.' 
        });
      }

      // Check if this is the last episode for the event
      const otherEpisodes = await Episode.count({
        where: {
          event_id: episode.event_id,
          episode_id: { [Op.ne]: id }
        },
        transaction
      });

      // Delete the episode
      await episode.destroy({ transaction });

      // If this was the last episode, optionally delete the event
      // For now, we'll keep the event even if it has no episodes
      
      // Commit transaction
      await transaction.commit();

      console.log(`Successfully deleted episode ${id}`);

      res.json({
        message: 'Episode deleted successfully',
        deletedEpisodeId: parseInt(id)
      });

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Delete episode error:', error);
      res.status(500).json({ 
        message: 'An error occurred while deleting the episode',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
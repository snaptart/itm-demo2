// backend/src/controllers/programController.js
const { Program, ProgramType, User } = require('../models');
const { Op } = require('sequelize');

const programController = {
  // Get all programs
  async getPrograms(req, res) {
    try {
      const { 
        active_only = 'true',
        include_type = 'true',
        include_scheduler = 'false'
      } = req.query;

      // Build where clause
      const whereClause = {};
      
      // For non-admins, only show programs they're associated with
      if (req.user.user_type === 'scheduler') {
        whereClause.scheduler_user_id = req.user.user_id;
      }

      // Build include array
      const includeArray = [];
      
      if (include_type === 'true') {
        includeArray.push({
          model: ProgramType,
          as: 'programType',
          attributes: ['program_type_id', 'program_type_name']
        });
      }
      
      if (include_scheduler === 'true') {
        includeArray.push({
          model: User,
          as: 'scheduler',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        });
      }

      const programs = await Program.findAll({
        where: whereClause,
        include: includeArray,
        order: [['program_name', 'ASC']],
        attributes: [
          'program_id',
          'program_name',
          'program_color',
          'program_type_id',
          'scheduler_user_id',
          'create_ts',
          'update_ts'
        ]
      });

      res.json({
        programs: programs,
        total: programs.length
      });

    } catch (error) {
      console.error('Get programs error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching programs',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get single program by ID
  async getProgramById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({ 
          message: 'Invalid program ID' 
        });
      }

      const program = await Program.findByPk(id, {
        include: [
          {
            model: ProgramType,
            as: 'programType'
          },
          {
            model: User,
            as: 'scheduler',
            attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
          }
        ]
      });

      if (!program) {
        return res.status(404).json({ 
          message: 'Program not found' 
        });
      }

      // Check permissions
      if (req.user.user_type === 'scheduler' && program.scheduler_user_id !== req.user.user_id) {
        return res.status(403).json({ 
          message: 'You do not have permission to view this program' 
        });
      }

      res.json({
        program: program
      });

    } catch (error) {
      console.error('Get program by ID error:', error);
      res.status(500).json({ 
        message: 'An error occurred while fetching the program',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Create program (placeholder)
  async createProgram(req, res) {
    res.status(501).json({ message: 'Create program not yet implemented' });
  },

  // Update program (placeholder)
  async updateProgram(req, res) {
    res.status(501).json({ message: 'Update program not yet implemented' });
  },

  // Delete program (placeholder)
  async deleteProgram(req, res) {
    res.status(501).json({ message: 'Delete program not yet implemented' });
  }
};

module.exports = programController;
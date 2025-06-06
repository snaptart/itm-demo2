// backend/src/repositories/BaseRepository.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');
const logger = require('../utils/logger');

class BaseRepository {
  constructor(model) {
    this.model = model;
    this.modelName = model.name;
  }

  /**
   * Find a record by primary key
   * @param {number|string} id - Primary key value
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - Found record or null
   */
  async findById(id, options = {}) {
    try {
      const record = await this.model.findByPk(id, {
        ...options,
        logging: this.getQueryLogger('findById', { id })
      });

      if (!record && options.required) {
        throw new NotFoundError(`${this.modelName} with ID ${id} not found`);
      }

      return record;
    } catch (error) {
      this.handleRepositoryError(error, 'findById', { id });
      throw error;
    }
  }

  /**
   * Find records with filtering and pagination
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Results with pagination info
   */
  async findWithPagination(criteria = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        include = [],
        order = [],
        attributes,
        paranoid = true
      } = options;

      const offset = (page - 1) * limit;
      const whereClause = this.buildWhereClause(criteria);

      const queryOptions = {
        where: whereClause,
        include,
        order,
        limit: parseInt(limit),
        offset: parseInt(offset),
        paranoid,
        logging: this.getQueryLogger('findWithPagination', { criteria, options })
      };

      if (attributes) {
        queryOptions.attributes = attributes;
      }

      const { count, rows } = await this.model.findAndCountAll(queryOptions);

      return {
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit),
          hasNext: page < Math.ceil(count / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      this.handleRepositoryError(error, 'findWithPagination', { criteria, options });
      throw error;
    }
  }

  /**
   * Find all records matching criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of records
   */
  async findAll(criteria = {}, options = {}) {
    try {
      const whereClause = this.buildWhereClause(criteria);
      
      const queryOptions = {
        where: whereClause,
        include: options.include || [],
        order: options.order || [],
        limit: options.limit,
        logging: this.getQueryLogger('findAll', { criteria, options })
      };

      if (options.attributes) {
        queryOptions.attributes = options.attributes;
      }

      return await this.model.findAll(queryOptions);
    } catch (error) {
      this.handleRepositoryError(error, 'findAll', { criteria, options });
      throw error;
    }
  }

  /**
   * Find a single record matching criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - Found record or null
   */
  async findOne(criteria, options = {}) {
    try {
      const whereClause = this.buildWhereClause(criteria);
      
      const record = await this.model.findOne({
        where: whereClause,
        include: options.include || [],
        logging: this.getQueryLogger('findOne', { criteria, options })
      });

      if (!record && options.required) {
        throw new NotFoundError(`${this.modelName} not found`);
      }

      return record;
    } catch (error) {
      this.handleRepositoryError(error, 'findOne', { criteria, options });
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @param {Object} options - Create options
   * @returns {Promise<Object>} - Created record
   */
  async create(data, options = {}) {
    const transaction = options.transaction || await sequelize.transaction();
    const shouldCommit = !options.transaction;

    try {
      const record = await this.model.create(data, {
        transaction,
        logging: this.getQueryLogger('create', { data })
      });

      if (shouldCommit) {
        await transaction.commit();
      }

      return record;
    } catch (error) {
      if (shouldCommit) {
        await transaction.rollback();
      }
      
      this.handleRepositoryError(error, 'create', { data });
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {number|string} id - Record ID
   * @param {Object} data - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Updated record
   */
  async updateById(id, data, options = {}) {
    const transaction = options.transaction || await sequelize.transaction();
    const shouldCommit = !options.transaction;

    try {
      const record = await this.findById(id, { transaction, required: true });
      
      await record.update(data, {
        transaction,
        logging: this.getQueryLogger('updateById', { id, data })
      });

      if (shouldCommit) {
        await transaction.commit();
      }

      return record;
    } catch (error) {
      if (shouldCommit) {
        await transaction.rollback();
      }
      
      this.handleRepositoryError(error, 'updateById', { id, data });
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {number|string} id - Record ID
   * @param {Object} options - Delete options
   * @returns {Promise<boolean>} - Success status
   */
  async deleteById(id, options = {}) {
    const transaction = options.transaction || await sequelize.transaction();
    const shouldCommit = !options.transaction;

    try {
      const record = await this.findById(id, { transaction, required: true });
      
      await record.destroy({
        transaction,
        logging: this.getQueryLogger('deleteById', { id })
      });

      if (shouldCommit) {
        await transaction.commit();
      }

      return true;
    } catch (error) {
      if (shouldCommit) {
        await transaction.rollback();
      }
      
      this.handleRepositoryError(error, 'deleteById', { id });
      throw error;
    }
  }

  /**
   * Count records matching criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} - Record count
   */
  async count(criteria = {}) {
    try {
      const whereClause = this.buildWhereClause(criteria);
      
      return await this.model.count({
        where: whereClause,
        logging: this.getQueryLogger('count', { criteria })
      });
    } catch (error) {
      this.handleRepositoryError(error, 'count', { criteria });
      throw error;
    }
  }

  /**
   * Check if a record exists
   * @param {Object} criteria - Search criteria
   * @returns {Promise<boolean>} - Existence status
   */
  async exists(criteria) {
    const count = await this.count(criteria);
    return count > 0;
  }

  /**
   * Bulk create records
   * @param {Array} dataArray - Array of record data
   * @param {Object} options - Bulk create options
   * @returns {Promise<Array>} - Created records
   */
  async bulkCreate(dataArray, options = {}) {
    const transaction = options.transaction || await sequelize.transaction();
    const shouldCommit = !options.transaction;

    try {
      const records = await this.model.bulkCreate(dataArray, {
        transaction,
        returning: true,
        logging: this.getQueryLogger('bulkCreate', { count: dataArray.length })
      });

      if (shouldCommit) {
        await transaction.commit();
      }

      return records;
    } catch (error) {
      if (shouldCommit) {
        await transaction.rollback();
      }
      
      this.handleRepositoryError(error, 'bulkCreate', { count: dataArray.length });
      throw error;
    }
  }

  /**
   * Build WHERE clause from criteria object
   * @param {Object} criteria - Search criteria
   * @returns {Object} - Sequelize WHERE clause
   */
  buildWhereClause(criteria) {
    const where = {};

    for (const [key, value] of Object.entries(criteria)) {
      if (value === null || value === undefined) {
        continue;
      }

      // Handle different types of criteria
      if (Array.isArray(value)) {
        where[key] = { [Op.in]: value };
      } else if (typeof value === 'object' && value.hasOwnProperty('op')) {
        // Custom operator: { op: 'gte', value: 100 }
        where[key] = { [Op[value.op]]: value.value };
      } else if (typeof value === 'string' && value.includes('%')) {
        // LIKE search
        where[key] = { [Op.iLike]: value };
      } else {
        where[key] = value;
      }
    }

    return where;
  }

  /**
   * Get query logger function
   * @param {string} operation - Operation name
   * @param {Object} context - Operation context
   * @returns {Function} - Logger function
   */
  getQueryLogger(operation, context) {
    return (sql, timing) => {
      logger.debug('Database query executed', {
        repository: this.constructor.name,
        model: this.modelName,
        operation,
        timing,
        context,
        sql: process.env.NODE_ENV === 'development' ? sql : '[hidden]'
      });
    };
  }

  /**
   * Handle repository errors with consistent logging
   * @param {Error} error - Original error
   * @param {string} operation - Operation name
   * @param {Object} context - Operation context
   */
  handleRepositoryError(error, operation, context) {
    logger.error('Repository operation failed', {
      repository: this.constructor.name,
      model: this.modelName,
      operation,
      error: error.message,
      context
    });

    // Convert database constraint errors to domain errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ConflictError(`Duplicate ${this.modelName.toLowerCase()} found`);
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new ConflictError(`Referenced ${this.modelName.toLowerCase()} does not exist`);
    }
  }

  /**
   * Execute raw SQL query
   * @param {string} sql - SQL query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Query results
   */
  async rawQuery(sql, options = {}) {
    try {
      const [results] = await sequelize.query(sql, {
        type: sequelize.QueryTypes.SELECT,
        logging: this.getQueryLogger('rawQuery', { sql }),
        ...options
      });

      return results;
    } catch (error) {
      this.handleRepositoryError(error, 'rawQuery', { sql });
      throw error;
    }
  }
}

module.exports = BaseRepository;
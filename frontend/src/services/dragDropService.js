// frontend/src/services/dragDropService.js
import api from './api';
import { dateUtils } from '../utils/dateUtils';

class DragDropService {
  constructor() {
    this.pendingOperations = new Map();
    this.conflictCache = new Map();
  }

  // Validate if a drag/drop operation is allowed
  async validateDragDrop(episodeId, newStartTime, newEndTime, facilityId) {
    const cacheKey = `${episodeId}-${newStartTime}-${newEndTime}`;
    
    // Check cache first
    if (this.conflictCache.has(cacheKey)) {
      return this.conflictCache.get(cacheKey);
    }

    try {
      const response = await api.post('/api/episodes/validate-move', {
        episode_id: episodeId,
        new_start_time: newStartTime,
        new_end_time: newEndTime,
        facility_id: facilityId
      });

      const result = {
        isValid: response.data.valid,
        conflicts: response.data.conflicts || [],
        warnings: response.data.warnings || [],
        businessRuleViolations: response.data.businessRuleViolations || []
      };

      // Cache the result for 30 seconds
      this.conflictCache.set(cacheKey, result);
      setTimeout(() => this.conflictCache.delete(cacheKey), 30000);

      return result;
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        conflicts: [],
        warnings: [],
        businessRuleViolations: ['Validation service unavailable']
      };
    }
  }

  // Handle episode move with optimistic updates
  async moveEpisode(moveData) {
    const { episodeId, newStartTime, newEndTime, revert } = moveData;
    const operationId = `move-${episodeId}-${Date.now()}`;

    try {
      // Store the operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'move',
        episodeId,
        originalData: moveData.originalEvent,
        revert
      });

      // Validate the move
      const validation = await this.validateDragDrop(
        episodeId, 
        newStartTime, 
        newEndTime,
        moveData.facilityId
      );

      if (!validation.isValid) {
        throw new Error(validation.businessRuleViolations[0] || 'Invalid move');
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        const confirmed = await this.showConflictDialog({
          type: 'warning',
          title: 'Move Confirmation',
          message: 'This move has potential issues:',
          details: validation.warnings,
          confirmText: 'Move Anyway'
        });

        if (!confirmed) {
          revert();
          this.pendingOperations.delete(operationId);
          return { success: false, cancelled: true };
        }
      }

      // Calculate new duration
      const duration = Math.round((new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60));

      // Perform the actual update
      const response = await api.put(`/api/episodes/${episodeId}`, {
        episode_start_date_time: newStartTime,
        episode_end_date_time: newEndTime,
        episode_duration: duration
      });

      this.pendingOperations.delete(operationId);
      return { 
        success: true, 
        data: response.data,
        message: 'Ice time moved successfully'
      };

    } catch (error) {
      console.error('Move episode error:', error);
      
      // Rollback the UI change
      revert();
      this.pendingOperations.delete(operationId);

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to move ice time'
      };
    }
  }

  // Handle episode resize with optimistic updates
  async resizeEpisode(resizeData) {
    const { episodeId, newEndTime, newDuration, revert } = resizeData;
    const operationId = `resize-${episodeId}-${Date.now()}`;

    try {
      // Store the operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'resize',
        episodeId,
        originalEnd: resizeData.originalEnd,
        revert
      });

      // Get current episode data for validation
      const currentEpisode = await this.getCurrentEpisodeData(episodeId);
      if (!currentEpisode) {
        throw new Error('Episode not found');
      }

      // Validate the resize
      const validation = await this.validateDragDrop(
        episodeId,
        currentEpisode.episode_start_date_time,
        newEndTime,
        currentEpisode.facilityId
      );

      if (!validation.isValid) {
        throw new Error(validation.businessRuleViolations[0] || 'Invalid resize');
      }

      // Check for duration limits
      if (newDuration < 30) {
        throw new Error('Ice time must be at least 30 minutes long');
      }

      if (newDuration > 240) {
        throw new Error('Ice time cannot exceed 4 hours');
      }

      // Perform the actual update
      const response = await api.put(`/api/episodes/${episodeId}`, {
        episode_end_date_time: newEndTime,
        episode_duration: newDuration
      });

      this.pendingOperations.delete(operationId);
      return { 
        success: true, 
        data: response.data,
        message: `Ice time duration updated to ${newDuration} minutes`
      };

    } catch (error) {
      console.error('Resize episode error:', error);
      
      // Rollback the UI change
      revert();
      this.pendingOperations.delete(operationId);

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to resize ice time'
      };
    }
  }

  // Get current episode data for validation
  async getCurrentEpisodeData(episodeId) {
    try {
      const response = await api.get(`/api/episodes/${episodeId}`);
      return response.data.episode;
    } catch (error) {
      console.error('Failed to get episode data:', error);
      return null;
    }
  }

  // Check if operation can be performed
  canPerformOperation(event, operationType = 'move') {
    const status = event.extendedProps?.status;
    const startTime = new Date(event.start);
    
    // Cannot edit past events
    if (startTime < new Date()) {
      return { allowed: false, reason: 'Cannot modify past ice time' };
    }
    
    // Cannot edit booked events
    if (status === 'booked') {
      return { allowed: false, reason: 'Cannot modify booked ice time' };
    }
    
    // Cannot edit if it has active bookings
    if (event.extendedProps?.hasBookings) {
      return { allowed: false, reason: 'Cannot modify ice time with active bookings' };
    }

    // Check for maintenance status
    if (status === 'maintenance') {
      return { allowed: false, reason: 'Cannot modify maintenance periods' };
    }

    return { allowed: true };
  }

  // Show conflict dialog (to be implemented with a modal component)
  async showConflictDialog(options) {
    return new Promise((resolve) => {
      // This would trigger a modal component
      // For now, using browser confirm as fallback
      const message = `${options.message}\n\n${options.details.join('\n')}\n\nContinue?`;
      resolve(window.confirm(message));
    });
  }

  // Cleanup pending operations (call on component unmount)
  cleanup() {
    this.pendingOperations.clear();
    this.conflictCache.clear();
  }

  // Get pending operations count
  getPendingOperationsCount() {
    return this.pendingOperations.size;
  }

  // Cancel pending operation
  cancelPendingOperation(operationId) {
    const operation = this.pendingOperations.get(operationId);
    if (operation && operation.revert) {
      operation.revert();
      this.pendingOperations.delete(operationId);
      return true;
    }
    return false;
  }

  // Batch validation for multiple moves
  async validateBatchMoves(moves) {
    try {
      const response = await api.post('/api/episodes/validate-batch-moves', {
        moves: moves.map(move => ({
          episode_id: move.episodeId,
          new_start_time: move.newStartTime,
          new_end_time: move.newEndTime
        }))
      });

      return {
        isValid: response.data.valid,
        results: response.data.results || [],
        overallConflicts: response.data.overallConflicts || []
      };
    } catch (error) {
      console.error('Batch validation error:', error);
      return {
        isValid: false,
        results: [],
        overallConflicts: ['Batch validation service unavailable']
      };
    }
  }

  // Smart snap to grid
  snapToGrid(dateTime, snapDuration = 15) {
    const date = new Date(dateTime);
    const minutes = date.getMinutes();
    const snappedMinutes = Math.round(minutes / snapDuration) * snapDuration;
    
    date.setMinutes(snappedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    
    return date;
  }

  // Calculate optimal drop target
  findOptimalDropTarget(originalSlot, targetTime, duration, facilitySchedule) {
    const snappedTime = this.snapToGrid(targetTime);
    
    // Check if the snapped time works
    const endTime = new Date(snappedTime.getTime() + duration * 60000);
    
    // Validate against business hours
    if (!this.isWithinBusinessHours(snappedTime, endTime, facilitySchedule)) {
      return this.findNearestValidSlot(snappedTime, duration, facilitySchedule);
    }
    
    return {
      startTime: snappedTime,
      endTime: endTime,
      isOptimal: true
    };
  }

  // Check if time is within business hours
  isWithinBusinessHours(startTime, endTime, facilitySchedule) {
    if (!facilitySchedule) return true;
    
    const dayOfWeek = startTime.getDay();
    const daySchedule = facilitySchedule[dayOfWeek];
    
    if (!daySchedule || daySchedule.isClosed) return false;
    
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
    return startHour >= daySchedule.openHour && endHour <= daySchedule.closeHour;
  }

  // Find nearest valid time slot
  findNearestValidSlot(preferredTime, duration, facilitySchedule) {
    // Implementation would find the nearest available slot
    // For now, return the preferred time
    return {
      startTime: preferredTime,
      endTime: new Date(preferredTime.getTime() + duration * 60000),
      isOptimal: false,
      adjustmentReason: 'Adjusted to fit business hours'
    };
  }
}

// Create singleton instance
const dragDropService = new DragDropService();

export default dragDropService;
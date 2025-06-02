// frontend/src/services/dragDropService.js (Simplified - Local Time)
import calendarService from './calendarService';

class DragDropService {
  constructor() {
    this.pendingOperations = new Map();
  }

  // Validate if a drag/drop operation is allowed
  async validateDragDrop(episodeId, newStartTime, newEndTime, facilityId) {
    try {
      const result = await calendarService.validateEpisodeMove(
        episodeId, 
        newStartTime, 
        newEndTime, 
        facilityId
      );

      if (result.success) {
        return {
          isValid: result.data.isValid,
          conflicts: result.data.conflicts || [],
          warnings: result.data.warnings || [],
          businessRuleViolations: result.data.businessRuleViolations || []
        };
      } else {
        return {
          isValid: false,
          conflicts: [{
            type: 'validation_error',
            severity: 'error',
            title: 'Validation Error',
            description: result.error || 'Unable to validate move'
          }],
          warnings: [],
          businessRuleViolations: [result.error || 'Validation failed']
        };
      }
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        conflicts: [{
          type: 'validation_error',
          severity: 'error',
          title: 'Validation Error',
          description: 'Unable to validate move'
        }],
        warnings: [],
        businessRuleViolations: ['Validation service unavailable']
      };
    }
  }

  // Handle episode move with proper error handling
  async moveEpisode(moveData) {
    const { episodeId, newStartTime, newEndTime, revert } = moveData;
    const operationId = `move-${episodeId}-${Date.now()}`;

    try {
      // Store the operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'move',
        episodeId,
        revert
      });

      // Perform the actual update using the calendar service
      const result = await calendarService.moveEpisode(
        episodeId,
        newStartTime,
        newEndTime
      );

      this.pendingOperations.delete(operationId);

      if (result.success) {
        return { 
          success: true, 
          data: result.data,
          message: 'Ice time moved successfully'
        };
      } else {
        // Rollback the UI change
        revert();
        return {
          success: false,
          error: result.error || 'Failed to move ice time'
        };
      }

    } catch (error) {
      console.error('Move episode error:', error);
      
      // Rollback the UI change
      revert();
      this.pendingOperations.delete(operationId);

      return {
        success: false,
        error: 'Failed to move ice time'
      };
    }
  }

  // Handle episode resize with proper error handling
  async resizeEpisode(resizeData) {
    const { episodeId, newEndTime, revert } = resizeData;
    const operationId = `resize-${episodeId}-${Date.now()}`;

    try {
      // Store the operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'resize',
        episodeId,
        revert
      });

      // Perform the actual update using the calendar service
      const result = await calendarService.resizeEpisode(
        episodeId,
        newEndTime
      );

      this.pendingOperations.delete(operationId);

      if (result.success) {
        // Calculate duration for message
        const episodeResult = await calendarService.getEpisodeById(episodeId);
        let duration = 'updated';
        if (episodeResult.success) {
          const startTime = new Date(episodeResult.data.episode.episode_start_date_time);
          const endTime = new Date(newEndTime);
          duration = Math.round((endTime - startTime) / (1000 * 60));
        }

        return { 
          success: true, 
          data: result.data,
          message: `Ice time duration updated to ${duration} minutes`
        };
      } else {
        // Rollback the UI change
        revert();
        return {
          success: false,
          error: result.error || 'Failed to resize ice time'
        };
      }

    } catch (error) {
      console.error('Resize episode error:', error);
      
      // Rollback the UI change
      revert();
      this.pendingOperations.delete(operationId);

      return {
        success: false,
        error: 'Failed to resize ice time'
      };
    }
  }

  // Check if operation can be performed
  canPerformOperation(event, operationType = 'move') {
    const editCheck = calendarService.canEditEpisode(event);
    return editCheck;
  }

  // Show conflict dialog (placeholder for modal integration)
  async showConflictDialog(options) {
    return new Promise((resolve) => {
      // This would trigger a modal component in a full implementation
      // For now, using browser confirm as fallback
      const message = `${options.message}\n\n${options.details.join('\n')}\n\nContinue?`;
      resolve(window.confirm(message));
    });
  }

  // Cleanup pending operations (call on component unmount)
  cleanup() {
    this.pendingOperations.clear();
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
      const result = await calendarService.validateBatchMoves(moves);
      
      if (result.success) {
        return {
          isValid: result.data.isValid,
          results: result.data.results || [],
          overallConflicts: result.data.overallConflicts || []
        };
      } else {
        return {
          isValid: false,
          results: [],
          overallConflicts: ['Batch validation service unavailable']
        };
      }
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
    
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
    const businessStart = parseInt(facilitySchedule.start?.split(':')[0] || 6);
    const businessEnd = parseInt(facilitySchedule.end?.split(':')[0] || 23);
    
    return startHour >= businessStart && endHour <= businessEnd;
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

  // Validate move against business rules
  async validateBusinessRules(episodeId, newStartTime, newEndTime) {
    const violations = [];
    const warnings = [];

    try {
      // Check if moving to past
      if (new Date(newStartTime) < new Date()) {
        violations.push({
          type: 'past_date',
          severity: 'error',
          title: 'Past Date',
          description: 'Cannot move ice time to the past'
        });
      }

      // Duration validation
      const duration = Math.round((new Date(newEndTime) - new Date(newStartTime)) / (1000 * 60));
      
      if (duration < 30) {
        violations.push({
          type: 'duration_too_short',
          severity: 'error',
          title: 'Duration Too Short',
          description: 'Ice time must be at least 30 minutes long'
        });
      }

      if (duration > 480) {
        violations.push({
          type: 'duration_too_long',
          severity: 'error',
          title: 'Duration Too Long',
          description: 'Ice time cannot exceed 8 hours'
        });
      }

      // Warning for very long durations
      if (duration > 240 && duration <= 480) {
        warnings.push({
          type: 'duration_long',
          severity: 'warning',
          title: 'Long Duration',
          description: 'This is a very long ice time slot'
        });
      }

    } catch (error) {
      console.error('Business rules validation error:', error);
      violations.push({
        type: 'validation_error',
        severity: 'error',
        title: 'Validation Error',
        description: 'Unable to validate business rules'
      });
    }

    return { violations, warnings };
  }

  // Check for cross-episode conflicts in batch moves
  checkCrossEpisodeConflicts(moves) {
    const conflicts = [];

    // Sort moves by start time
    const sortedMoves = [...moves].sort((a, b) => 
      new Date(a.newStartTime) - new Date(b.newStartTime)
    );

    // Check each pair for overlaps
    for (let i = 0; i < sortedMoves.length - 1; i++) {
      for (let j = i + 1; j < sortedMoves.length; j++) {
        const move1 = sortedMoves[i];
        const move2 = sortedMoves[j];

        // Only check if they're on the same resource
        if (move1.resourceId === move2.resourceId) {
          const overlap = this.checkTimeOverlap(
            move1.newStartTime, move1.newEndTime,
            move2.newStartTime, move2.newEndTime
          );

          if (overlap) {
            conflicts.push({
              type: 'batch_overlap',
              severity: 'error',
              title: 'Batch Move Conflict',
              description: `Episodes ${move1.episodeId} and ${move2.episodeId} would overlap`,
              episodes: [move1.episodeId, move2.episodeId]
            });
          }
        }
      }
    }

    return conflicts;
  }

  // Check if two time ranges overlap
  checkTimeOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return s1 < e2 && s2 < e1;
  }

  // Get operation status
  getOperationStatus(operationId) {
    return this.pendingOperations.has(operationId) ? 'pending' : 'completed';
  }

  // Handle optimistic updates
  async handleOptimisticUpdate(updateFunction, rollbackFunction) {
    try {
      // Apply optimistic update
      updateFunction();
      
      // Attempt actual update
      const result = await this.performUpdate();
      
      if (!result.success) {
        // Rollback on failure
        rollbackFunction();
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      // Ensure rollback on any error
      rollbackFunction();
      throw error;
    }
  }
}

// Create singleton instance
const dragDropService = new DragDropService();

export default dragDropService;
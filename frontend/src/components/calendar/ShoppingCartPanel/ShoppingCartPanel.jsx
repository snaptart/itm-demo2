// frontend/src/components/calendar/ShoppingCartPanel/ShoppingCartPanel.jsx
import React, { useState, useEffect } from 'react';
import { dateUtils } from '../../../utils/dateUtils';
import './ShoppingCartPanel.css';

function ShoppingCartPanel({
  items,
  onRemoveItem,
  onClearCart,
  onSubmitRequests,
  onClose,
  selectedProgram,
  isSubmitting
}) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Cleanup function to prevent DOM issues
  useEffect(() => {
    return () => {
      setShowConfirmClear(false);
      setShowConfirmSubmit(false);
    };
  }, []);

  const getTotalCost = () => {
    return items.reduce((total, item) => total + (item.price || 0), 0);
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return dateUtils.formatForDisplay(date);
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.round((end - start) / (1000 * 60)); // minutes
    return dateUtils.formatDuration(duration);
  };

  const groupItemsByFacility = () => {
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.facilityName]) {
        grouped[item.facilityName] = [];
      }
      grouped[item.facilityName].push(item);
    });
    return grouped;
  };

  const handleClearCart = () => {
    if (showConfirmClear) {
      onClearCart();
      setShowConfirmClear(false);
    } else {
      setShowConfirmClear(true);
    }
  };

  const handleSubmitRequests = () => {
    if (showConfirmSubmit) {
      onSubmitRequests();
      setShowConfirmSubmit(false);
    } else {
      setShowConfirmSubmit(true);
    }
  };

  const groupedItems = groupItemsByFacility();

  return (
    <div className="shopping-cart-panel">
      <div className="cart-header">
        <div className="cart-title">
          <h3>🛒 Shopping Cart</h3>
          <span className="cart-count">({items.length} items)</span>
        </div>
        <button className="cart-close" onClick={onClose} aria-label="Close cart">
          ×
        </button>
      </div>

      <div className="cart-body">
        {items.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-icon">🛒</div>
            <p>Your cart is empty</p>
            <p className="empty-hint">Click on available ice time slots to add them to your cart.</p>
          </div>
        ) : (
          <>
            {/* Program Info */}
            {selectedProgram && (
              <div className="cart-program-info">
                <h4>Requesting for:</h4>
                <div className="program-details">
                  <strong>{selectedProgram.program_name}</strong>
                  <br />
                  <small>{selectedProgram.programType?.program_type_name}</small>
                </div>
              </div>
            )}

            {/* Cart Items grouped by facility */}
            <div className="cart-items">
              {Object.entries(groupedItems).map(([facilityName, facilityItems]) => (
                <div key={facilityName} className="facility-group">
                  <h4 className="facility-name">{facilityName}</h4>
                  
                  {facilityItems.map((item, index) => (
                    <div key={`${item.episodeId}-${index}`} className="cart-item">
                      <div className="item-main">
                        <div className="item-header">
                          <span className="item-title">{item.title || 'Ice Time'}</span>
                          <button 
                            className="remove-item"
                            onClick={() => onRemoveItem(item.episodeId)}
                            aria-label="Remove from cart"
                          >
                            ×
                          </button>
                        </div>
                        
                        <div className="item-details">
                          <div className="item-resource">
                            <span className="detail-label">Rink:</span>
                            <span className="detail-value">{item.resourceName}</span>
                          </div>
                          
                          <div className="item-datetime">
                            <span className="detail-label">Time:</span>
                            <span className="detail-value">
                              {formatDateTime(item.startTime)}
                            </span>
                          </div>
                          
                          <div className="item-duration">
                            <span className="detail-label">Duration:</span>
                            <span className="detail-value">
                              {formatDuration(item.startTime, item.endTime)}
                            </span>
                          </div>
                          
                          {item.price > 0 && (
                            <div className="item-price">
                              <span className="detail-label">Price:</span>
                              <span className="detail-value price">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Cart Summary */}
            <div className="cart-summary">
              <div className="summary-row">
                <span className="summary-label">Total Items:</span>
                <span className="summary-value">{items.length}</span>
              </div>
              
              {getTotalCost() > 0 && (
                <div className="summary-row total">
                  <span className="summary-label">Total Cost:</span>
                  <span className="summary-value">${getTotalCost().toFixed(2)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="cart-footer">
        {items.length > 0 && (
          <>
            <button 
              className="btn btn-secondary"
              onClick={handleClearCart}
              disabled={isSubmitting}
            >
              {showConfirmClear ? 'Confirm Clear' : 'Clear Cart'}
            </button>
            
            <button 
              className="btn btn-primary"
              onClick={handleSubmitRequests}
              disabled={isSubmitting || !selectedProgram}
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner"></span>
                  Submitting...
                </>
              ) : showConfirmSubmit ? (
                `Submit ${items.length} Requests`
              ) : (
                'Submit Requests'
              )}
            </button>
          </>
        )}
        
        {showConfirmClear && (
          <div className="confirmation-hint">
            Click "Confirm Clear" again to empty your cart
          </div>
        )}
        
        {showConfirmSubmit && (
          <div className="confirmation-hint">
            Click "Submit {items.length} Requests" to send your requests to the arena administrator
          </div>
        )}
      </div>
    </div>
  );
}

export default ShoppingCartPanel;
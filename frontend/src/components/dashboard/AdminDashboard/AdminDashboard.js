import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardStats from '../DashboardStats/DashboardStats';
import FacilityList from '../../facility/FacilityList/FacilityList';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import facilityService from '../../../services/facilityService';
import authService from '../../../services/authService';
import './AdminDashboard.css';

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalFacilities: 0,
    activeResources: 0,
    pendingBookings: 0,
    todaysBookings: 0
  });
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load facilities
      const facilitiesResult = await facilityService.getFacilities({ limit: 10 });
      if (facilitiesResult.success) {
        setFacilities(facilitiesResult.data.facilities);
        setStats(prev => ({
          ...prev,
          totalFacilities: facilitiesResult.data.pagination.total
        }));

        // Calculate active resources from facilities
        const activeResourceCount = facilitiesResult.data.facilities.reduce((total, facility) => {
          return total + (facility.resources?.length || 0);
        }, 0);
        
        setStats(prev => ({
          ...prev,
          activeResources: activeResourceCount
        }));
      } else {
        setError(facilitiesResult.error);
      }

      // TODO: Load booking statistics when booking service is available
      // const bookingStats = await bookingService.getStats();
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFacility = () => {
    navigate('/facilities/new');
  };

  const handleViewFacility = (facility) => {
    navigate(`/facilities/${facility.facility_id}`);
  };

  const handleManageResources = (facility) => {
    navigate(`/facilities/${facility.facility_id}/resources`);
  };

  const handleViewAllFacilities = () => {
    navigate('/facilities');
  };

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const handleViewBookings = () => {
    navigate('/bookings');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Administrator Dashboard</h1>
        <p className="welcome-message">
          Welcome back, {currentUser?.first_name || currentUser?.username}!
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <DashboardStats stats={stats} />

      <div className="dashboard-content">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <button 
              className="action-button primary"
              onClick={handleCreateFacility}
            >
              <span className="icon">+</span>
              Create New Facility
            </button>
            <button 
              className="action-button"
              onClick={handleViewCalendar}
            >
              <span className="icon">📅</span>
              View Calendar
            </button>
            <button 
              className="action-button"
              onClick={handleViewBookings}
            >
              <span className="icon">📋</span>
              Manage Bookings
            </button>
            <button 
              className="action-button"
              onClick={() => navigate('/reports')}
            >
              <span className="icon">📊</span>
              View Reports
            </button>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Facilities Overview</h2>
            <button 
              className="link-button"
              onClick={handleViewAllFacilities}
            >
              View All →
            </button>
          </div>
          
          {facilities.length > 0 ? (
            <FacilityList 
              facilities={facilities}
              onViewDetails={handleViewFacility}
              onManageResources={handleManageResources}
              isCompact={true}
            />
          ) : (
            <div className="empty-state">
              <p>No facilities found.</p>
              <button 
                className="primary-button"
                onClick={handleCreateFacility}
              >
                Create Your First Facility
              </button>
            </div>
          )}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Recent Activity</h2>
            </div>
            <div className="activity-list">
              <p className="placeholder-text">
                Activity feed will be displayed here once booking functionality is implemented.
              </p>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="section-header">
              <h2>Pending Approvals</h2>
            </div>
            <div className="approvals-list">
              <p className="placeholder-text">
                Pending booking approvals will be displayed here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/AccountSettings.css";

const AccountSettings = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn || isLoggedIn !== "true") {
      navigate("/");
      return;
    }

    // Load user information
    const currentUser = localStorage.getItem("currentUser");
    setUsername(currentUser || "Admin");

    // Load dark mode preference
    const savedMode = localStorage.getItem("darkMode");
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);
  }, [navigate]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear messages when user types
    setError("");
    setSuccess("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    // In a real application, you would verify the current password
    // and update the password in your database or authentication system
    
    // For this demo, we'll simulate a successful password change
    setSuccess("Password updated successfully");
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const initiateDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDeleteAccount = () => {
    setShowDeleteConfirm(false);
  };

  const confirmDeleteAccount = () => {
    // In a real application, you would delete the user's account from your database
    // For this demo, we'll simulate account deletion by logging out
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const handleGoBack = () => {
    navigate("/Dashboard");
  };

  return (
    <div className={`account-settings-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>

      <div className="dashboard-header">
        <div className="logo-section">
          <div className="logo">
            <div className="face-recognition-icon">
              <div className="face-outline"></div>
              <div className="scan-line"></div>
              <div className="face-grid"></div>
            </div>
          </div>
          <h1>Account Settings</h1>
        </div>
        <div className="settings-back-button" onClick={handleGoBack}>
          <span>← Back to Dashboard</span>
      </div>
        <div className="user-section">
          <div className="dark-mode-toggle" onClick={toggleDarkMode}>
            {darkMode ? (
              <i className="mode-icon sun-icon">☀️</i>
            ) : (
              <i className="mode-icon moon-icon">🌙</i>
            )}
          </div>
          <div className="user-info">
            <span>Welcome, {username}</span>
          </div>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-card">
          <h2>Change Password</h2>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <button type="submit" className="update-button">Update Password</button>
          </form>
        </div>

        <div className="settings-card danger-zone">
          <h2 style={{ color: 'red' }}>Danger Zone</h2>
          <p style={{ fontSize: '16px' }}>Delete your account and all associated data. This action cannot be undone.</p>
          <button className="delete-button" onClick={initiateDeleteAccount}>Delete Account</button>
          {showDeleteConfirm && (
          <div className="delete-confirmation-overlay">
            <div className="delete-confirmation-modal">
              <h3>Are you sure?</h3>
              <p  style={{ fontSize: '16px' }}>This action will permanently delete your account and cannot be undone.</p>
              <div className="confirmation-buttons">
                <button className="cancel-button" onClick={cancelDeleteAccount}>Cancel</button>
                <button className="confirm-button" onClick={confirmDeleteAccount}>Yes, Delete My Account</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
      <div className="dashboard-footer">
          <p>Attendance Management System - Admin Panel</p>
          <p className="copyright">© 2025 All Rights Reserved</p>
        </div>
    </div>
  );
};

export default AccountSettings;
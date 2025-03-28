import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../css/Dashboard.css";

const AdminDashboard = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
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

  const handleLogout = () => {
    // Clear login information
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  return (
    <div className={`admin-dashboard-container ${darkMode ? "dark-mode" : ""}`}>
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
          <h1>Admin Dashboard</h1>
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

      <div className="dashboard-content">
        <div className="dashboard-cards">
          <Link to="/NewUser" className="dashboard-card">
            <div className="card-icon">👤</div>
            <h2>Register New User</h2>
            <p>Add new users to the system</p>
          </Link>

          <Link to="/ViewAttendance" className="dashboard-card">
            <div className="card-icon">📊</div>
            <h2>View Attendance</h2>
            <p>Monitor user attendance records</p>
          </Link>
          
          {/* New Card - Manage Users */}
          <Link to="/ManageUsers" className="dashboard-card">
            <div className="card-icon">👥</div>
            <h2>Manage Users</h2>
            <p>View and manage registered users</p>
          </Link>
          
          {/* New Card - Analytics */}
          <Link to="/Analytics" className="dashboard-card">
            <div className="card-icon">📈</div>
            <h2>Analytics</h2>
            <p>View attendance statistics</p>
          </Link>

          <Link to="/AccountSettings" className="dashboard-card">
            <div className="card-icon">⚙️</div>
            <h2>Account Settings</h2>
            <p>Manage your admin account</p>
          </Link>

          <div className="dashboard-card logout-card" onClick={handleLogout}>
            <div className="card-icon">🚪</div>
            <h2>Logout</h2>
            <p>Exit the admin dashboard</p>
          </div>
        </div>

        <div className="dashboard-footer">
          <p>Attendance Management System - Admin Panel</p>
          <p className="copyright">© 2025 All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
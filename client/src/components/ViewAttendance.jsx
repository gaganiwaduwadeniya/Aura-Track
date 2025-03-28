import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/ViewAttendance.css";

const ViewAttendance = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDegree, setSelectedDegree] = useState("all");
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryData, setSummaryData] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0
  });
  
  const navigate = useNavigate();
  
  // List of available degrees
  const degrees = ["all", "Computer Science","Computer Engineering","Software Engineering","Data Science"];

// In ViewAttendance.jsx, update the fetchAttendanceData function:

const fetchAttendanceData = async () => {
  setLoading(true);
  setError(null);
  try {
    console.log(`Fetching attendance for date: ${selectedDate}, degree: ${selectedDegree}`);
    const response = await fetch(`http://localhost:5000/api/attendance?date=${selectedDate}&degreeProgram=${selectedDegree}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch attendance data');
    }
    
    if (!data.success) {
      throw new Error(data.error || 'Server returned unsuccessful response');
    }
    
    console.log('Received attendance data:', data);
    setAttendanceData(data.data || []);
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    setError(error.message || 'Failed to load attendance data. Please try again later.');
    setAttendanceData([]);
  } finally {
    setLoading(false);
  }
};

// And similarly update the fetchSummaryData function:

const fetchSummaryData = async () => {
  try {
    console.log(`Fetching summary for date: ${selectedDate}, degree: ${selectedDegree}`);
    const response = await fetch(`http://localhost:5000/api/attendance/summary?date=${selectedDate}&degreeProgram=${selectedDegree}`);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('Error in summary response:', data);
      // Don't throw here, just keep previous summary
      return;
    }
    
    console.log('Received summary data:', data);
    setSummaryData(data.summary || {
      total: 0,
      present: 0,
      late: 0,
      absent: 0
    });
  } catch (error) {
    console.error('Error fetching summary data:', error);
    // Keep previous summary data in case of error
  }
};

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

  useEffect(() => {
    // Fetch attendance and summary data when date or degree changes
    fetchAttendanceData();
    fetchSummaryData();
  }, [selectedDate, selectedDegree]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    // The useEffect will trigger data fetch
  };

  const handleDegreeChange = (e) => {
    setSelectedDegree(e.target.value);
    // The useEffect will trigger data fetch
  };

  const downloadAttendanceSummary = () => {
    // Create URL with query parameters
    const downloadUrl = `http://localhost:5000/api/attendance/download?date=${selectedDate}&degreeProgram=${selectedDegree}`;
    
    // Open the URL in a new window/tab to trigger download
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className={`admin-dashboard-container attendance-view-container ${darkMode ? "dark-mode" : ""}`}>
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
          <h1>Attendance Records</h1>
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
        <div className="attendance-controls">
          <div className="control-group">
            <label htmlFor="attendance-date">Select Date:</label>
            <input 
              type="date" 
              id="attendance-date" 
              value={selectedDate} 
              onChange={handleDateChange}
              className="date-picker"
            />
          </div>
          
          <div className="control-group">
            <label htmlFor="degree-filter">Filter by Degree:</label>
            <select 
              id="degree-filter" 
              value={selectedDegree} 
              onChange={handleDegreeChange}
              className="degree-select"
            >
              {degrees.map((degree) => (
                <option key={degree} value={degree}>
                  {degree === "all" ? "All Degrees" : degree}
                </option>
              ))}
            </select>
          </div>
          
          <button className="download-btn" onClick={downloadAttendanceSummary}>
            <span className="download-icon">📥</span> Download Summary
          </button>
        </div>

        <div className="attendance-summary">
          <div className="summary-card">
            <h3>Total</h3>
            <p className="summary-count">{summaryData.total}</p>
          </div>
          <div className="summary-card present">
            <h3>Present</h3>
            <p className="summary-count">{summaryData.present}</p>
          </div>
          <div className="summary-card late">
            <h3>Late</h3>
            <p className="summary-count">{summaryData.late}</p>
          </div>
          <div className="summary-card absent">
            <h3>Absent</h3>
            <p className="summary-count">{summaryData.absent}</p>
          </div>
        </div>

        <div className="attendance-table-container">
          {loading ? (
            <div className="loading-indicator">Loading attendance data...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : attendanceData.length === 0 ? (
            <div className="no-data-message">No attendance records found for the selected date and degree program.</div>
          ) : (
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Degree</th>
                  <th>Status</th>
                  <th>Check-in Time</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((student) => (
                  <tr key={student.id} className={`status-${student.status.toLowerCase()}`}>
                    <td>{student.id}</td>
                    <td>{student.name}</td>
                    <td>{student.degree}</td>
                    <td>
                      <span className={`status-badge ${student.status.toLowerCase()}`}>
                        {student.status}
                      </span>
                    </td>
                    <td>{student.checkInTime || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="back-btn-container">
          <button className="back-btn" onClick={() => navigate("/Dashboard")}>
            <span className="back-icon">👈</span>
            Back to Dashboard
          </button>
        </div>

        <div className="dashboard-footer view-attendance-footer">
          <p>Attendance Management System - Admin Panel</p>
          <p className="copyright">© 2025 All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

export default ViewAttendance;
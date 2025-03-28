import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import '../css/Analytics.css';

const Analytics = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [studentDistributionData, setStudentDistributionData] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    totalStudents: '-',
    averageAttendance: '-',
    bestAttendanceMonth: '-'
  });
  const [username, setUsername] = useState("");
  const [selectedDegreeProgram, setSelectedDegreeProgram] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    // Dark mode persistence
    const savedMode = localStorage.getItem('darkMode');
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);

    // Load user information
    const currentUser = localStorage.getItem("currentUser");
    setUsername(currentUser || "Admin");

    // Fetch all analytics data
    fetchAnalyticsData();
  }, [selectedDegreeProgram]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch monthly attendance data
      const attendanceResponse = await axios.get('http://localhost:5000/api/analytics/monthly-attendance', {
        params: { degreeProgram: selectedDegreeProgram }
      });
      setAttendanceData(attendanceResponse.data.data);

      // Fetch student distribution data
      const distributionResponse = await axios.get('http://localhost:5000/api/analytics/student-distribution');
      setStudentDistributionData(distributionResponse.data.data);

      // Fetch attendance overview
      const overviewResponse = await axios.get('http://localhost:5000/api/analytics/overview', {
        params: { degreeProgram: selectedDegreeProgram }
      });
      setAttendanceSummary(overviewResponse.data.data);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`analytics-container ${darkMode ? 'dark-mode' : ''}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Analytics...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`analytics-container ${darkMode ? 'dark-mode' : ''}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={fetchAnalyticsData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`analytics-container ${darkMode ? 'dark-mode' : ''}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>

      <div className="dashboard-header">
        <div className="logo-section">
          <Link to="/Dashboard" className="back-button">
            <div className="back-icon">← Back to Dashboard</div>
          </Link>
          <div className="logo">
            <div className="face-recognition-icon">
              <div className="face-outline"></div>
              <div className="scan-line"></div>
              <div className="face-grid"></div>
            </div>
          </div>
          <h1>Student Analytics</h1>
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
          
          {/* Degree Program Filter */}
          <div className="degree-filter-analytics">
           <select 
            value={selectedDegreeProgram} 
            onChange={(e) => setSelectedDegreeProgram(e.target.value)}
            className="filter-select"
           >
              <option value="all">All Degree Programs</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Computer Engineering">Computer Engineering</option>
              <option value="Software Engineering">Software Engineering</option>
              <option value="Data Science">Data Science</option>
           </select>
          </div>
        </div>
      </div>

      <div className="analytics-content">
        <div className="chart-grid">
          {/* Monthly Attendance Line Chart */}
          <div className="chart-card">
            <h2>Monthly Attendance Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#8884d8" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="absent" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Attendance Bar Chart */}
          <div className="chart-card">
            <h2>Detailed Attendance</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#8884d8" />
                <Bar dataKey="absent" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Student Distribution Pie Chart */}
          <div className="chart-card">
            <h2>Student Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={studentDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {studentDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analytics-summary">
          <div className="summary-card">
            <h3>Attendance Overview</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Students</span>
                <span className="stat-value">{attendanceSummary.totalStudents}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Attendance</span>
                <span className="stat-value">{attendanceSummary.averageAttendance}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Best Attendance Month</span>
                <span className="stat-value">{attendanceSummary.bestAttendanceMonth}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
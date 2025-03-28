import { Link } from "react-router-dom";
import "../css/Startup.css";
import { useState, useEffect } from "react";

const StartupPage = () => {
  // Load the saved mode from localStorage on component mount
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? JSON.parse(savedMode) : false;
  });

  // Save to localStorage whenever the mode changes
  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`startup-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>
      
      <div className="logo-container">
        <div className="logo">
          <div className="face-recognition-icon">
            <div className="face-outline"></div>
            <div className="scan-line"></div>
            <div className="face-grid"></div>
          </div>
        </div>
      </div>
      
      <div className="content">
      <h1>Welcome to Face Recognition Attendance <span className="aura-track">- Aura Track -</span></h1>
        <p>Efficient and secure attendance tracking using face recognition technology.</p>
        <div className="button-container">
          <Link to="/MarkAttendance" className="btn mark-attendance">
            <span className="btn-icon">📋</span> Mark Attendance
          </Link>
          <Link to="/Signin" className="btn admin-login">
            <span className="btn-icon">🔐</span> Admin Login
          </Link>
        </div>
      </div>
      
      <div className="mode-toggle-container">
        {/* Sun icon */}
        <svg className="toggle-icon sun-icon" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"
          />
        </svg>
        
        <span className="mode-label"></span>
        
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={darkMode} 
            onChange={toggleDarkMode} 
          />
          <span className="toggle-slider"></span>
        </label>
        
        {/* Moon icon */}
        <svg className="toggle-icon moon-icon" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M9.37 5.51c-.18.64-.27 1.31-.27 1.99 0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27C17.45 17.19 14.93 19 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
          />
        </svg>
      </div>
      
      <div className="footer">
        <p>© 2025 Face Recognition Attendance System</p>
      </div>
    </div>
  );
};

export default StartupPage;
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios"; // Import axios for API calls
import "../css/Signin.css";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Make the API call to the backend using axios with the correct URL format
      const response = await axios.post('http://localhost:5000/login', {
        username,
        password
      });

      // Login successful
      const data = response.data;
      
      if (data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("currentUser", username);
        
        // Store admin data
        localStorage.setItem("adminData", JSON.stringify({
          fullName: data.user.fullName,
          email: data.user.email,
          username: data.user.username,
          registrationNumber: data.user.registrationNumber,
          mobileNumber: data.user.mobileNumber,
          address: data.user.address
        }));
        
        navigate("/Dashboard");
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Handle specific error responses from the server
      if (error.response) {
        // The server responded with a status code outside the 2xx range
        if (error.response.status === 404) {
          setErrorMessage("User not found. Please check your username.");
        } else if (error.response.status === 401) {
          setErrorMessage("Invalid password. Please try again.");
        } else {
          setErrorMessage(error.response.data.error || "Login failed. Please try again.");
        }
      } else if (error.request) {
        // The request was made but no response was received
        setErrorMessage("Network error. Please check your connection and try again.");
      } else {
        // Something happened in setting up the request
        setErrorMessage("An error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`admin-login-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>

      <div className="login-card">
        <div className="logo-container">
          <div className="logo">
            <div className="face-recognition-icon">
              <div className="face-outline"></div>
              <div className="scan-line"></div>
              <div className="face-grid"></div>
            </div>
          </div>
        </div>

        <h2>Admin Login</h2>

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <div className="forgot-password">
            <Link to="/ForgotPassword">Forgot Password?</Link>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="admin-signup">
          <p>Need an admin account?</p>
          <Link to="/Signup" className="signup-link">
            Sign Up
          </Link>
        </div>

        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // Import toastify CSS
import axios from "axios"; // Import axios for API calls
import "../css/Signup.css";

const AdminSignup = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    registrationNumber: "",
    mobileNumber: "",
    address: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const navigate = useNavigate();

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);
    
    // Check admin count on component mount
    checkAdminCount();
  }, []);

  // Function to check how many admin accounts exist
  const checkAdminCount = async () => {
    try {
      const response = await axios.get('http://localhost:5000/admin/count');
      setAdminCount(response.data.count);
    } catch (error) {
      console.error("Error checking admin count:", error);
      // Fallback to localStorage if API fails
      const existingAdmins = JSON.parse(localStorage.getItem("adminAccounts")) || [];
      setAdminCount(existingAdmins.length);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    // Check if we already have 2 admin accounts
    if (adminCount >= 2) {
      toast.error("Maximum number of admin accounts (2) has been reached. Please contact the system administrator.");
      setIsLoading(false);
      return;
    }

    try {
      // Send signup request to backend
      const response = await axios.post('http://localhost:5000/signup', {
        fullName: formData.fullName,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        registrationNumber: formData.registrationNumber,
        mobileNumber: formData.mobileNumber,
        address: formData.address
      });

      if (response.data.success) {
        toast.success("Admin account created successfully! Redirecting to login...");
        
        // For local storage tracking as well (keeping for compatibility)
        const existingAdmins = JSON.parse(localStorage.getItem("adminAccounts")) || [];
        const newAdmin = {
          fullName: formData.fullName,
          email: formData.email,
          username: formData.username,
          password: "********", // Don't store actual password in localStorage
          registrationNumber: formData.registrationNumber,
          mobileNumber: formData.mobileNumber,
          address: formData.address,
          createdAt: new Date().toISOString()
        };
        existingAdmins.push(newAdmin);
        localStorage.setItem("adminAccounts", JSON.stringify(existingAdmins));
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/Signin");
        }, 2000);
      }
    } catch (error) {
      console.error("Error during signup:", error);
      
      // Handle specific error messages from backend
      if (error.response && error.response.data) {
        toast.error(error.response.data.error || "Signup failed. Please try again.");
      } else {
        toast.error("Network error. Please check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`admin-signup-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>

      <div className="signup-card">
        <div className="logo-container">
          <div className="logo">
            <div className="face-recognition-icon">
              <div className="face-outline"></div>
              <div className="scan-line"></div>
              <div className="face-grid"></div>
            </div>
          </div>
        </div>

        <h2>Admin Registration</h2>
        <p className="signup-info">
          Create an admin account to manage attendance records and system settings.
          <strong> Note: Only two admin accounts can be created for security reasons.</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="registrationNumber">Registration Number</label>
            <input
              type="text"
              id="registrationNumber"
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleChange}
              required
              placeholder="Enter your registration number"
            />
          </div>

          <div className="input-group">
            <label htmlFor="mobileNumber">Mobile Number</label>
            <input
              type="tel"
              id="mobileNumber"
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={handleChange}
              required
              placeholder="Enter your mobile number"
            />
          </div>

          <div className="input-group">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="Enter your address"
              rows="3"
            />
          </div>

          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a password"
              minLength="8"
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
            />
          </div>

          <button type="submit" className="signup-button" disabled={isLoading}>
            {isLoading ? <span className="loading-spinner"></span> : "Create Account"}
          </button>
        </form>

        <div className="login-link">
          <p>Already have an account?</p>
          <Link to="/signin">Log In</Link>
        </div>

        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>

      {/* Toast Container to display notifications */}
      <ToastContainer />
    </div>
  );
};

export default AdminSignup;
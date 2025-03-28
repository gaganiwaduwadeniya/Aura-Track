import React, { useState,useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/ForgotPassword.css";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email entry, 2: Verification code, 3: New password
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);

   // Load dark mode preference from localStorage
      useEffect(() => {
        const savedMode = localStorage.getItem("darkMode");
        setDarkMode(savedMode ? JSON.parse(savedMode) : false);
      }, []);
  
  // Handle email submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);
    
    try {
      // Call API to send verification code to the email
      const response = await axios.post('http://localhost:5000/forgot-password', { email });
      
      if (response.data.success) {
        setSuccessMessage("Verification code has been sent to your email");
        setStep(2); // Move to verification step
      } else {
        throw new Error(response.data.error || "Failed to send verification code");
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
      
      if (error.response) {
        if (error.response.status === 404) {
          setErrorMessage("Email not found in our records");
        } else {
          setErrorMessage(error.response.data.error || "Failed to send verification code. Please try again.");
        }
      } else if (error.request) {
        setErrorMessage("Network error. Please check your connection and try again.");
      } else {
        setErrorMessage("An error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle verification code submission
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);
    
    try {
      // Call API to verify the code
      const response = await axios.post('http://localhost:5000/verify-code', { 
        email, 
        verificationCode 
      });
      
      if (response.data.success) {
        setSuccessMessage("Verification successful");
        setStep(3); // Move to new password step
      } else {
        throw new Error(response.data.error || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      
      if (error.response) {
        if (error.response.status === 400) {
          setErrorMessage("Invalid or expired verification code");
        } else {
          setErrorMessage(error.response.data.error || "Verification failed. Please try again.");
        }
      } else if (error.request) {
        setErrorMessage("Network error. Please check your connection and try again.");
      } else {
        setErrorMessage("An error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle new password submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    
    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    
    // Check password strength
    if (newPassword.length < 8) {
      setErrorMessage("Password should be at least 8 characters long");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call API to update the password
      const response = await axios.post('http://localhost:5000/reset-password', {
        email,
        verificationCode,
        newPassword
      });
      
      if (response.data.success) {
        setSuccessMessage("Password has been reset successfully");
        setTimeout(() => {
          navigate("/Signin"); // Redirect to login page after success
        }, 2000);
      } else {
        throw new Error(response.data.error || "Password reset failed");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      
      if (error.response) {
        setErrorMessage(error.response.data.error || "Password reset failed. Please try again.");
      } else if (error.request) {
        setErrorMessage("Network error. Please check your connection and try again.");
      } else {
        setErrorMessage("An error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Resend verification code
  const handleResendCode = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);
    
    try {
      // Call API to resend verification code
      const response = await axios.post('http://localhost:5000/resend-code', { email });
      
      if (response.data.success) {
        setSuccessMessage("New verification code has been sent to your email");
      } else {
        throw new Error(response.data.error || "Failed to resend verification code");
      }
    } catch (error) {
      console.error("Error resending code:", error);
      setErrorMessage("Failed to resend verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={`forgot-password-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>
      
      <div className="forgot-password-card">
        <div className="logo-container">
          <div className="logo">
            <div className="face-recognition-icon">
              <div className="face-outline"></div>
              <div className="scan-line"></div>
              <div className="face-grid"></div>
            </div>
          </div>
        </div>
        
        <h2>Reset Password</h2>
        
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}
        
        {step === 1 && (
          <form onSubmit={handleEmailSubmit}>
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
              />
            </div>
            
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? <span className="loading-spinner"></span> : "Send Verification Code"}
            </button>
          </form>
        )}
        
        {step === 2 && (
          <form onSubmit={handleVerificationSubmit}>
            <div className="input-group">
              <label htmlFor="verificationCode">Verification Code</label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                placeholder="Enter verification code"
              />
            </div>
            
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? <span className="loading-spinner"></span> : "Verify Code"}
            </button>
            
            <div className="resend-code">
              <button 
                type="button" 
                className="resend-button" 
                onClick={handleResendCode}
                disabled={isLoading}
              >
                Resend Code
              </button>
            </div>
          </form>
        )}
        
        {step === 3 && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="input-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
              />
            </div>
            
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? <span className="loading-spinner"></span> : "Reset Password"}
            </button>
          </form>
        )}
        
        <div className="back-link">
          <Link to="/Signin">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
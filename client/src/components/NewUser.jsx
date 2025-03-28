import React, { useState, useEffect, useRef } from "react";
import { useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import "../css/NewUser.css";
import axios from "axios"; // Make sure to install axios: npm install axios

// API base URL - update this to match your backend
const API_URL = "http://localhost:5000";

const NewUser = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    address: "",
    mobile: "",
    email: "",
    indexNumber: "",
    degreeProgram: "",
    intake: "",
  });
  
  const [photos, setPhotos] = useState({
    front: null,
    Smile: null,
    withObject: null,
    left: null,
    right: null,
  });
  
  const [verificationCode, setVerificationCode] = useState("");
  const [inputVerificationCode, setInputVerificationCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentAngle, setCurrentAngle] = useState("front");
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(true);
  
  // Check if user is logged in and handle dark mode
  useEffect(() => {
    if (localStorage.getItem("isLoggedIn") !== "true") navigate("/");
    localStorage.setItem("darkMode", darkMode);
  }, [navigate, darkMode]);
  
  // Camera functions
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 500, height: 375 } 
      });
      
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
    } catch (error) {
      console.error("Error accessing camera:", error);
      showMessage("Camera access denied. Please enable camera access.", "error");
    }
  }, []); // Empty dependency array, only created once
  
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]); // Dependent on stream

  // Camera control
  useEffect(() => {
    // Only start the camera when the current step is 2 and it's capturing
    if (currentStep === 2 && isCapturing && !stream) {
      startCamera();
    } else if (currentStep !== 2 || !isCapturing) {
      stopCamera();
    }
  
    // Cleanup the camera when component unmounts or when no longer needed
    return () => {
      stopCamera();
    };
  }, [currentStep, isCapturing, startCamera, stopCamera, stream]); // Include stream to ensure it's managed correctly
  
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoData = canvas.toDataURL("image/png");
      
      setPhotos(prev => ({
        ...prev,
        [currentAngle]: photoData
      }));
      
      setIsCapturing(false);
      stopCamera(); // Stop camera after capturing
    }
  };
  
  const retakePhoto = () => {
    setPhotos(prev => ({
      ...prev,
      [currentAngle]: null
    }));
    setIsCapturing(true);
  };
  
  // Generate verification code for step 3 - now using API
  useEffect(() => {
    if (currentStep === 3) {
      // Request verification code from the backend
      requestVerificationCode();
    }
  }, [currentStep]);

  // Message handling
  const showMessage = (text, type = "error") => setMessage({ text, type });
  const clearMessage = () => setMessage({ text: "", type: "" });
  
  // Form handling
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Request verification code from backend
  const requestVerificationCode = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/register/send-verification`, {
        email: formData.email
      });
      
      if (response.data.success) {
        // In a real app, you wouldn't expose this code to the frontend
        // This is just for demonstration purposes
        setVerificationCode(response.data.verificationCode);
        showMessage(`Verification code sent to ${formData.email}`, "success");
      } else {
        showMessage("Failed to send verification code", "error");
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
      showMessage("Server error when sending verification code", "error");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Validation
  const validateStep1 = async () => {
    try {
      setIsLoading(true);
      
      // First validate locally
      const requiredFields = ["firstName", "lastName", "email", "mobile", "indexNumber", "degreeProgram"];
      const missingFields = requiredFields.filter(field => !formData[field]);
      
      if (missingFields.length > 0) {
        showMessage("Please fill in all required fields");
        setIsLoading(false);
        return false;
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        showMessage("Please enter a valid email address");
        setIsLoading(false);
        return false;
      }
      
      if (!/^\d{10}$/.test(formData.mobile)) {
        showMessage("Please enter a valid 10-digit mobile number");
        setIsLoading(false);
        return false;
      }
      
      // Then validate with the server
      const response = await axios.post(`${API_URL}/api/register/step1`, formData);
      
      if (response.data.success) {
        clearMessage();
        return true;
      } else {
        showMessage(response.data.message);
        return false;
      }
    } catch (error) {
      console.error("Error validating step 1:", error);
      if (error.response && error.response.data) {
        showMessage(error.response.data.message || "Validation failed");
      } else {
        showMessage("Could not connect to the server");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  const validateStep2 = () => {
    console.log("Current photos state:", photos); // Debugging log

    const allPhotosTaken = Object.values(photos).every(photo => !!photo); // Ensures no falsy values
    
    if (!allPhotosTaken) {
      showMessage("Please capture all required photos before proceeding");
      return false;
    }
    
    clearMessage();
    return true;
  };
  
  // Navigation
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate("/Dashboard");
    }
  };
  
  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await validateStep1();
      if (isValid) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };
  
  const verifyCode = async () => {
    if (inputVerificationCode === verificationCode) {
      setIsLoading(true);
      try {
        // Automatically submit registration when verification is successful
        // This is the key fix - we're now submitting the data immediately upon verification
        const registrationData = {
          ...formData,
          photos
        };
        
        const response = await axios.post(`${API_URL}/api/register/complete`, registrationData);
        
        if (response.data.success) {
          setIsVerified(true);
          showMessage("Verification successful! Registration complete.", "success");
          
          // Set a timeout to navigate back to Dashboard
          setTimeout(() => {
            navigate("/Dashboard");
          }, 3000);
        } else {
          showMessage("Verification successful but registration failed. Please try again.", "error");
        }
      } catch (error) {
        console.error("Error completing registration:", error);
        showMessage("Server error when completing registration", "error");
      } finally {
        setIsLoading(false);
      }
    } else {
      showMessage("Invalid verification code. Please try again.");
    }
  };
  
  // This function is now just a backup in case we want to keep the manual complete button
  const handleFinish = async () => {
    try {
      setIsLoading(true);
      
      // Combine all data and submit to the server
      const registrationData = {
        ...formData,
        photos
      };
      
      const response = await axios.post(`${API_URL}/api/register/complete`, registrationData);
      
      if (response.data.success) {
        showMessage("Registration successfully completed!", "success");
        setTimeout(() => {
          navigate("/Dashboard");
        }, 2000);
      } else {
        showMessage("Failed to complete registration. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error completing registration:", error);
      showMessage("Server error when completing registration", "error");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render functions
  const renderUserForm = () => (
    <div className="form-grid">
      {[
        { id: "firstName", label: "First Name *", type: "text", required: true },
        { id: "lastName", label: "Last Name *", type: "text", required: true },
        { id: "address", label: "Address", type: "text", className: "full-width" },
        { id: "mobile", label: "Mobile Number *", type: "tel", placeholder: "10-digit number", required: true },
        { id: "email", label: "Email Address *", type: "email", required: true },
        { id: "indexNumber", label: "Index Number *", type: "text", required: true }
      ].map(field => (
        <div key={field.id} className={`form-group ${field.className || ''}`}>
          <label htmlFor={field.id}>{field.label}</label>
          <input
            type={field.type}
            id={field.id}
            name={field.id}
            value={formData[field.id]}
            onChange={handleChange}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      ))}
      
      <div className="form-group">
        <label htmlFor="degreeProgram">Degree Program *</label>
        <select
          id="degreeProgram"
          name="degreeProgram"
          value={formData.degreeProgram}
          onChange={handleChange}
          required
        >
          <option value="">Select Program</option>
          {["Computer Science","Computer Engineering","Software Engineering","Data Science"].map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="intake">Intake</label>
        <select
          id="intake"
          name="intake"
          value={formData.intake}
          onChange={handleChange}
        >
          <option value="">Select Intake</option>
          {["Intake 40", "Intake 41", "Intake 42"].map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="navigation-buttons">
          <button className="next-button" onClick={handleNext} disabled={isLoading}>
               {isLoading ? "Loading..." : "Next"}
          </button>
       </div>
    </div>
  );
  
  const renderPhotoCapture = () => (
    <>
      <div className="camera-section">
        <div className="video-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            className={!isCapturing ? "hidden" : ""}
          ></video>
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          
          {photos[currentAngle] && (
            <div className="photo-preview">
              <img src={photos[currentAngle]} alt={`${currentAngle} angle`} />
            </div>
          )}
        </div>
        
        <div className="camera-controls">
          <div className="angle-selection">
            <p>Select photo type:</p>
            <div className="angle-buttons">
              {[
                { id: "front", label: "Front View" },
                { id: "Smile", label: "Smile" },
                { id: "withObject", label: "With Object" },
                { id: "left", label: "Left View" },
                { id: "right", label: "Right View" }
              ].map(angle => (
                <button 
                  key={angle.id}
                  className={`angle-button ${currentAngle === angle.id ? "active" : ""}`}
                  onClick={() => {
                    setCurrentAngle(angle.id);
                    setIsCapturing(!photos[angle.id]);
                  }}
                >
                  {angle.label}
                  {photos[angle.id] && <span className="check-mark">✓</span>}
                </button>
              ))}
            </div>
          </div>
          
          <div className="capture-controls">
            {isCapturing ? (
              <button className="capture-button" onClick={capturePhoto}>
                <span className="camera-icon">📷</span> Capture Photo
              </button>
            ) : (
              <button className="retake-button" onClick={retakePhoto}>
                <span className="retake-icon">🔄</span> Retake Photo
              </button>
            )}
          </div>
          {/* Move navigation buttons here */}
          <div className="navigation-buttons">
             <button className="prev-button" onClick={handleBack}>
               Previous
             </button>
             <button className="next-button" onClick={handleNext}>
               Next
             </button>
          </div>
        </div>
      </div>
      
      <div className="photo-guide">
        <h3>Photo Capture Guide</h3>
        <ul>
          <li>Ensure good lighting on your face</li>
          <li>Keep a neutral expression</li>
          <li>For left and right view, turn your head 90 degrees</li>
          <li>Hold an everyday object (glasses) for the object photo</li>
        </ul>
      </div>
    </>
  );
  
  const renderVerification = () => (
    <div className="verification-section">
      <div className="verification-icon">📧</div>
      <h2>Email Verification</h2>
      <p>We've sent a 6-digit verification code to your email:</p>
      <p className="email-display">{formData.email}</p>
      
      {!isVerified ? (
        <>
          <div className="verification-input">
            <label htmlFor="verificationCode">Enter Verification Code</label>
            <input
              type="text"
              id="verificationCode"
              value={inputVerificationCode}
              onChange={(e) => setInputVerificationCode(e.target.value)}
              maxLength="6"
              placeholder="Enter 6-digit code"
            />
          </div>
          
          <div className="verification-buttons">
            <button className="verify-button" onClick={verifyCode} disabled={isLoading}>
              {isLoading ? "Processing..." : "Verify Code"}
            </button>
            
            <button className="resend-code" onClick={requestVerificationCode} disabled={isLoading}>
              {isLoading ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </>
      ) : (
        <div className="verification-complete">
          <div className="checkmark-icon">✅</div>
          <h3>Verification Complete!</h3>
          <p>The user has been successfully registered in the system.</p>
        </div>
      )}
    </div>
  );
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderUserForm();
      case 2: return renderPhotoCapture();
      case 3: return renderVerification();
      default: return null;
    }
  };
  
  return (
    <div className={`new-user-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>
      
      <div className="new-user-header">
        <div className="back-button" onClick={handleBack}>
          ← {currentStep === 1 ? "Back to Dashboard" : "Previous Step"}
        </div>
        <h1>Register New User</h1>
        <div className="dark-mode-toggle" onClick={() => setDarkMode(prev => !prev)}>
          {darkMode ? "☀️" : "🌙"}
        </div>
      </div>
      
      <div className="steps-indicator">
        {[1, 2, 3].map((step) => (
          <React.Fragment key={step}>
            <div className={`step ${currentStep >= step ? "active" : ""}`}>
              <div className="step-number">{step}</div>
              <div className="step-name">
                {step === 1 ? "User Details" : 
                 step === 2 ? "Capture Photos" : "Verification"}
              </div>
            </div>
            {step < 3 && <div className="step-connector"></div>}
          </React.Fragment>
        ))}
      </div>
      
      <div className="message-container">
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
            <button className="close-message" onClick={clearMessage}>×</button>
          </div>
        )}
      </div>
      
      <div className="registration-content">
        <div className="step-content">
          {renderStepContent()}
        </div>
        
        {/* This button is now optional as verification automatically triggers registration */}
        {currentStep === 3 && isVerified && (
          <div className="navigation-buttons">
            <button 
              className="finish-button" 
              onClick={() => navigate("/Dashboard")} 
              disabled={isLoading}
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewUser;
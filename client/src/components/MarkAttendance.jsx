import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "../css/MarkAttendance.css";
import axios from "axios";

const MarkAttendance = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState("");
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [processingEmbeddings, setProcessingEmbeddings] = useState(false);
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);
    
    // Check and process embeddings when component mounts
    checkAndProcessEmbeddings();
  }, []);
  
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const checkAndProcessEmbeddings = async () => {
    try {
      console.log("[DEBUG] Starting checkAndProcessEmbeddings");
      setProcessingEmbeddings(true);
      setCaptureStatus("Checking face recognition data...");
      
      // First, check if embeddings need processing
      const checkResponse = await axios.get('http://localhost:5000/api/check-embeddings');
      
      if (checkResponse.data.needsProcessing) {
        console.log("[DEBUG] Embeddings need processing");
        setCaptureStatus("Processing face recognition data. This may take a moment...");
        
        // Process all registrations
        const processResponse = await axios.get('http://localhost:5000/api/process-all-registrations');
        
        if (processResponse.data.success) {
          console.log("[DEBUG] Embeddings processed successfully");
          setCaptureStatus("Face recognition data processed successfully!");
          
          // Fetch the latest embeddings after processing
          const latestEmbeddings = await fetchLatestEmbeddings();
          
          if (latestEmbeddings && latestEmbeddings.embeddings) {
            console.log("[DEBUG] Latest embeddings fetched");
            // You can store or use latestEmbeddings here if needed
            setEmbeddingsReady(true);
          } else {
            console.error("[ERROR] Failed to fetch latest embeddings");
            setCaptureStatus("Warning: Could not retrieve face recognition data.");
          }
        } else {
          console.error("[ERROR] Embeddings processing failed:", processResponse.data);
          setCaptureStatus("Warning: Face recognition data processing had some issues.");
        }
      } else {
        console.log("[DEBUG] No embedding processing needed");
        
        // Fetch the latest embeddings
        const latestEmbeddings = await fetchLatestEmbeddings();
        
        if (latestEmbeddings && latestEmbeddings.embeddings) {
          console.log("[DEBUG] Latest embeddings fetched");
          setCaptureStatus("Face recognition data is ready.");
          // You can store or use latestEmbeddings here if needed
          setEmbeddingsReady(true);
        } else {
          console.error("[ERROR] Failed to fetch latest embeddings");
          setCaptureStatus("Warning: Could not retrieve face recognition data.");
        }
      }
    } catch (error) {
      console.error("[CRITICAL ERROR] Unexpected error in checkAndProcessEmbeddings:", error);
      setCaptureStatus("Error preparing face recognition data");
    } finally {
      setProcessingEmbeddings(false);
    }
  };

  // Fetch latest embeddings route
  const fetchLatestEmbeddings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/latest-embeddings');
      return response.data;
    } catch (error) {
      console.error("[ERROR] Failed to fetch latest embeddings:", error);
      return null;
    }
  };
  
  const startCamera = async () => {
    if (!embeddingsReady) {
      setCaptureStatus("Please wait, processing face recognition data...");
      return;
    }

    try {
      setCameraError("");
      setIsCapturing(true);
      
      setTimeout(async () => {
        if (!videoRef.current) {
          console.error("[ERROR] Video element not found in DOM");
          setCameraError("Video element not found in DOM. Please refresh the page.");
          setIsCapturing(false);
          return;
        }
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        console.log("[DEBUG] Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          } 
        });
        
        console.log("[DEBUG] Camera access granted, stream:", stream);
        streamRef.current = stream;
        
        if (videoRef.current) {
          console.log("[DEBUG] Setting video source to stream");
          videoRef.current.srcObject = stream;
          
          try {
            await videoRef.current.play();
            console.log("[DEBUG] Video is playing");
            setCaptureStatus("Camera activated. Please position your face within the frame.");
          } catch (e) {
            console.error("[ERROR] Error playing video:", e);
            setCameraError(`Error playing video: ${e.message}`);
          }
        } else {
          console.error("[ERROR] Video element reference lost");
          setCameraError("Video element reference lost after camera initialization. Please refresh.");
          setIsCapturing(false);
        }
      }, 100);
      
    } catch (err) {
      console.error("[ERROR] Error in startCamera:", err);
      setCameraError(`Could not start camera: ${err.message}`);
      setIsCapturing(false);
    }
  };
  
  const stopCamera = () => {
    console.log("[DEBUG] Stopping camera...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log("[DEBUG] Stopping track:", track);
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
    setCaptureStatus("");
  };
  
  const captureImageFromVideo = () => {
    if (!videoRef.current) {
      console.error("[ERROR] Video element not available");
      return null;
    }
    
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log("[DEBUG] Image captured successfully");
      return imageDataUrl;
    } catch (err) {
      console.error("[ERROR] Error converting canvas to image:", err);
      return null;
    }
  };
  
  const performFaceRecognition = async () => {
    try {
      console.log("[DEBUG] Starting performFaceRecognition");
      setCaptureStatus("Processing...");
      
      const imageData = captureImageFromVideo();
      
      if (!imageData) {
        console.error("[ERROR] Failed to capture image");
        setCaptureStatus("Failed to capture image. Please try again.");
        return;
      }
      
      try {
        console.log("[DEBUG] Sending image for face recognition");
        const response = await axios.post('http://localhost:5000/api/recognize-face', {
          image: imageData
        });
        
        console.log("[DEBUG] Recognition full response:", response);
        console.log("[DEBUG] Recognition response data:", response.data);
        
        if (response.data.success && response.data.attendanceRecorded && response.data.userDetails) {
          console.log("[DEBUG] Face recognition successful");
          const userData = response.data.userDetails;
          
          const studentData = {
            name: `${userData.firstName} ${userData.lastName}`,
            id: userData.indexNumber,
            course: userData.degreeProgram,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            similarity: (userData.similarity * 100).toFixed(1) + '%'
          };
          
          try {
            console.log("[DEBUG] Recording attendance");
            await axios.post('http://localhost:5000/api/record-attendance', {
              userId: response.data.userDetails.userId || response.data.recognizedName,
              timestamp: new Date().toISOString()
            });
            
            setStudentInfo(studentData);
            setCaptureStatus(`✅ Face recognized! Attendance marked successfully. (Confidence: ${studentData.similarity})`);
            setAttendanceMarked(true);
          } catch (attendanceError) {
            console.error("[ERROR] Failed to record attendance:", attendanceError);
            setCaptureStatus("❌ Recognized, but failed to record attendance");
          }
        } else {
          console.error("[ERROR] Face not recognized", response.data);
          setCaptureStatus("❌ Face not recognized. Please try again or contact administrator.");
        }
      } catch (recognitionError) {
        console.error("[ERROR] Face recognition request failed:", recognitionError);
        setCaptureStatus(`Recognition error: ${recognitionError.message}`);
      }
    } catch (error) {
      console.error("[CRITICAL ERROR] Unexpected error in performFaceRecognition:", error);
      setCaptureStatus("Unexpected error during face recognition");
    }
  };
  
  const markAttendance = () => {
    performFaceRecognition();
  };
  
  const resetProcess = () => {
    stopCamera();
    setAttendanceMarked(false);
    setStudentInfo(null);
    setCaptureStatus("");
  };
  
  const handleVideoClick = async () => {
    if (videoRef.current && videoRef.current.paused) {
      try {
        console.log("[DEBUG] Attempting to play video after click");
        await videoRef.current.play();
      } catch (err) {
        console.error("[ERROR] Error playing video after click:", err);
      }
    }
  };
  
  return (
    <div className={`attendance-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="attendance-header">
        <Link to="/" className="back-button">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="currentColor"
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            />
          </svg>
          Back to Home
        </Link>
        <h1>Mark Attendance</h1>
      </div>
      
      <div className="attendance-content">
        <div className="camera-container">
          <div className="video-wrapper" onClick={handleVideoClick}>
            {isCapturing ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  id="camera-video"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#333',transform: 'scaleX(-1)' }}
                ></video>
                <div className="face-frame">
                  <div className="frame-inner"></div>
                  <div className="frame-corner top-left"></div>
                  <div className="frame-corner top-right"></div>
                  <div className="frame-corner bottom-left"></div>
                  <div className="frame-corner bottom-right"></div>
                  {isCapturing && !attendanceMarked && (
                    <div className="scanning-line"></div>
                  )}
                </div>
                {processingEmbeddings && (
                  <div className="processing-overlay">
                    <div className="processing-spinner"></div>
                    <p>Processing face data...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="camera-placeholder">
                <svg viewBox="0 0 24 24" width="64" height="64">
                  <path
                    fill="currentColor"
                    d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 8a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm6.5-9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM20 4h-3.17l-1.24-1.35A1.99 1.99 0 0 0 14.12 2H9.88c-.56 0-1.1.24-1.48.65L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h3.17l1.24 1.35c.37.41.91.65 1.47.65h4.24c.56 0 1.1-.24 1.47-.65L16.83 6H20v12z"
                  />
                </svg>
                <p>Camera preview will appear here</p>
              </div>
            )}
          </div>
          
          {cameraError && (
            <div className="error-message">
              {cameraError}
            </div>
          )}
          
          <div className="camera-controls">
            {!isCapturing ? (
              <button 
                className="control-button start" 
                onClick={startCamera}
                disabled={processingEmbeddings || !embeddingsReady}
              >
                {processingEmbeddings ? "Processing..." : 
                 !embeddingsReady ? "Preparing..." : 
                 "Start Camera"}
              </button>
            ) : (
              <>
                {!attendanceMarked ? (
                  <div className="button-container">
                    <button 
                      className="control-button mark" 
                      onClick={markAttendance}
                      disabled={processingEmbeddings}
                    >
                      Mark Attendance
                    </button>
                    <button 
                      className="control-button cancel" 
                      onClick={stopCamera}
                      disabled={processingEmbeddings}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="control-button reset" onClick={resetProcess}>
                    Mark Another
                  </button>
                )}
              </>
            )}
          </div>
          
          {captureStatus && (
            <div className={`status-message ${attendanceMarked ? "success" : ""} ${processingEmbeddings ? "processing" : ""}`}>
              {captureStatus}
            </div>
          )}
        </div>
        
        {studentInfo && (
          <div className="student-info">
            <h2>Attendance Confirmation</h2>
            <div className="info-card">
              <div className="info-row">
                <span className="info-label">Name:</span>
                <span className="info-value">{studentInfo.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Student ID:</span>
                <span className="info-value">{studentInfo.id}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Course:</span>
                <span className="info-value">{studentInfo.course}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date:</span>
                <span className="info-value">{studentInfo.date}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Time:</span>
                <span className="info-value">{studentInfo.time}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Confidence:</span>
                <span className="info-value">{studentInfo.similarity}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="attendance-footer">
        <p>Please make sure your face is clearly visible and well-lit</p>
        {cameraError && (
          <p>
            <b>Troubleshooting:</b> Try refreshing the page and granting camera permissions again. 
            Make sure no other apps are using your camera.
          </p>
        )}
      </div>
    </div>
  );
};

export default MarkAttendance;
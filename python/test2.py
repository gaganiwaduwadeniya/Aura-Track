import cv2
import os
import datetime
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from scipy.spatial.distance import cosine
import mediapipe as mp
import h5py
import time
from collections import defaultdict, Counter

# Configuration
MODEL_FOLDER = 'resnet50_model'
FEATURE_MODEL_PATH = os.path.join(MODEL_FOLDER, 'resnet50_face_features.h5')
KNOWN_FACES_DIR = 'known_faces'
ATTENDANCE_FILE = 'attendance.csv'
SIMILARITY_THRESHOLD = 0.4  # Adjusted for ResNet50 (higher value means more similar)

# Camera settings
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480

# Face recognition settings
RECOGNITION_INTERVAL = 3  # Process every N frames
FACE_MEMORY_DURATION = 3.0  # Keep face identities for 3 seconds
FACE_RECOGNITION_SAMPLES = 5  # Number of samples to average for recognition
FACE_RECOGNITION_CONFIDENCE = 0.65  # Minimum confidence to update display

# Create attendance file if it doesn't exist
if not os.path.exists(ATTENDANCE_FILE):
    with open(ATTENDANCE_FILE, "w") as f:
        f.write("Name,Time\n")
    print(f"Created attendance file: {ATTENDANCE_FILE}")

# Load the ResNet50 feature extraction model
print("Loading ResNet50 Face feature extraction model...")
try:
    # Configure TensorFlow for better performance
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(4)
    
    # Load model
    resnet_feature_model = load_model(FEATURE_MODEL_PATH)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    exit(1)

# Initialize MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
face_detection = mp_face_detection.FaceDetection(
    model_selection=1,  # 0=closer faces, 1=longer distance faces
    min_detection_confidence=0.5
)

# Function to perform face alignment using eye centers
def align_face(image, landmarks):
    # Extract eye landmarks (MediaPipe provides normalized coordinates)
    h, w, _ = image.shape
    
    # Convert to absolute coordinates (rough estimate from MediaPipe landmarks)
    left_eye_x = int(landmarks.location_data.relative_keypoints[0].x * w)
    left_eye_y = int(landmarks.location_data.relative_keypoints[0].y * h)
    right_eye_x = int(landmarks.location_data.relative_keypoints[1].x * w)
    right_eye_y = int(landmarks.location_data.relative_keypoints[1].y * h)
    
    # Calculate angle
    dx = right_eye_x - left_eye_x
    dy = right_eye_y - left_eye_y
    angle = np.degrees(np.arctan2(dy, dx))
    
    # Get rotation matrix
    center = ((left_eye_x + right_eye_x) // 2, (left_eye_y + right_eye_y) // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, scale=1.0)
    
    # Apply rotation
    aligned_image = cv2.warpAffine(image, rotation_matrix, (w, h), flags=cv2.INTER_CUBIC)
    
    return aligned_image

# Function to preprocess image for ResNet50 model
def preprocess_image(img):
    # Resize to 224x224 (ResNet input size)
    resized = cv2.resize(img, (224, 224))
    # Convert from BGR to RGB (OpenCV uses BGR, but model expects RGB)
    rgb_img = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    
    # Convert to float32 BEFORE subtraction
    bgr_img = rgb_img[..., ::-1].copy().astype(np.float32)
    
    # Zero-center by mean pixel values
    bgr_img[..., 0] -= 91.4953
    bgr_img[..., 1] -= 103.8827
    bgr_img[..., 2] -= 131.0912
    
    # Add batch dimension
    preprocessed = np.expand_dims(bgr_img, axis=0)
    return preprocessed

# Function to extract face embeddings using ResNet50 model
def extract_resnet_features(face_img):
    preprocessed = preprocess_image(face_img)
    features = resnet_feature_model.predict(preprocessed, verbose=0)
    return features[0]  # Return the feature vector

# Function to detect face using MediaPipe and return cropped face
def detect_and_crop_face(image):
    # Convert the BGR image to RGB
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    # Process the image
    results = face_detection.process(rgb_image)
    
    if not results.detections:
        return None, None
    
    # Get the first detected face
    detection = results.detections[0]
    bboxC = detection.location_data.relative_bounding_box
    
    # Convert normalized coordinates to absolute pixel values
    ih, iw, _ = image.shape
    x = int(bboxC.xmin * iw)
    y = int(bboxC.ymin * ih)
    w = int(bboxC.width * iw)
    h = int(bboxC.height * ih)
    
    # Ensure coordinates are within image boundaries
    x = max(0, x)
    y = max(0, y)
    w = min(w, iw - x)
    h = min(h, ih - y)
    
    # Crop the face
    face_img = image[y:y+h, x:x+w]
    
    # Try to align the face if landmarks are available
    try:
        aligned_face = align_face(image, detection)
        # Re-crop the aligned face using the same boundaries
        aligned_face_crop = aligned_face[y:y+h, x:x+w]
        if aligned_face_crop.size > 0:
            face_img = aligned_face_crop
    except Exception as e:
        print(f"Warning: Face alignment failed: {e}")
    
    return face_img, (x, y, w, h)

# Load known faces and compute their embeddings
print("Loading known faces and computing embeddings...")
known_faces = {}
attended_persons = set()  # To avoid duplicate attendance entries

# Process each person's directory
for person_name in os.listdir(KNOWN_FACES_DIR):
    person_path = os.path.join(KNOWN_FACES_DIR, person_name)
    if os.path.isdir(person_path):
        known_faces[person_name] = []
        print(f"Processing images for: {person_name}")
        
        # Process each image in the person's directory
        for img_name in os.listdir(person_path):
            if img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                img_path = os.path.join(person_path, img_name)
                try:
                    # Load image
                    img = cv2.imread(img_path)
                    if img is None:
                        print(f"Could not read image: {img_path}")
                        continue
                    
                    # Detect and crop face using MediaPipe
                    face_img, face_coords = detect_and_crop_face(img)
                    
                    if face_img is not None and face_img.size > 0:
                        # Extract features and store
                        embedding = extract_resnet_features(face_img)
                        known_faces[person_name].append(embedding)
                        print(f"  Processed: {img_name}")
                    else:
                        print(f"  No face detected in: {img_name}")
                
                except Exception as e:
                    print(f"  Error processing {img_path}: {str(e)}")

print(f"Loaded embeddings for {len(known_faces)} persons")

# Function to mark attendance
def mark_attendance(name):
    if name not in attended_persons:
        current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(ATTENDANCE_FILE, "a") as f:
            f.write(f"{name},{current_time}\n")
        attended_persons.add(name)
        print(f"Marked attendance for {name} at {current_time}")
        return True
    else:
        print(f"Attendance already marked for {name}")
        return False

# Class to handle face tracking and recognition stabilization
class FaceTracker:
    def __init__(self):
        self.face_records = {}  # Stores recognized faces and their history
        self.face_history = {}  # Stores recognition history for each detected face
        self.last_seen = {}     # Stores when each face was last seen
        self.current_time = datetime.datetime.now().timestamp()
        
    def update_time(self):
        self.current_time = datetime.datetime.now().timestamp()
        
    def _get_face_id(self, bbox, prev_faces):
        """Generate a unique ID for a face based on its position"""
        x, y, w, h = bbox
        center = (x + w/2, y + h/2)
        
        # Check if this face matches an existing face by position
        for face_id, face_bbox in prev_faces.items():
            prev_x, prev_y, prev_w, prev_h = face_bbox
            prev_center = (prev_x + prev_w/2, prev_y + prev_h/2)
            
            # Calculate distance between centers
            distance = np.sqrt((center[0] - prev_center[0])**2 + (center[1] - prev_center[1])**2)
            
            # If centers are close enough, it's the same face
            if distance < (w + prev_w) / 4:  # Threshold based on face size
                return face_id
        
        # If no match found, generate a new ID
        return f"face_{len(prev_faces) + 1}"
    
    def clean_old_faces(self):
        """Remove faces that haven't been seen recently"""
        to_remove = []
        for face_id, last_time in self.last_seen.items():
            if self.current_time - last_time > FACE_MEMORY_DURATION:
                to_remove.append(face_id)
        
        for face_id in to_remove:
            if face_id in self.face_records:
                del self.face_records[face_id]
            if face_id in self.face_history:
                del self.face_history[face_id]
            if face_id in self.last_seen:
                del self.last_seen[face_id]
    
    def update_face(self, bbox, name, similarity):
        """Update face recognition data"""
        # Get current face positions
        current_face_positions = {face_id: data['bbox'] for face_id, data in self.face_records.items()}
        
        # Get face ID
        face_id = self._get_face_id(bbox, current_face_positions)
        
        # Update last seen time
        self.last_seen[face_id] = self.current_time
        
        # Update face history
        if face_id not in self.face_history:
            self.face_history[face_id] = []
        
        # Add new recognition to history
        self.face_history[face_id].append((name, similarity))
        
        # Keep only the most recent samples
        if len(self.face_history[face_id]) > FACE_RECOGNITION_SAMPLES:
            self.face_history[face_id].pop(0)
        
        # Get the most common name from history
        names = [n for n, _ in self.face_history[face_id]]
        name_counts = Counter(names)
        most_common_name, count = name_counts.most_common(1)[0]
        
        # Calculate confidence as the proportion of this name in the history
        confidence = count / len(self.face_history[face_id])
        
        # Only update the display name if confidence is high enough
        if confidence >= FACE_RECOGNITION_CONFIDENCE:
            # Calculate average similarity for this name
            avg_similarity = np.mean([s for n, s in self.face_history[face_id] if n == most_common_name])
            
            # Update face record
            self.face_records[face_id] = {
                'name': most_common_name,
                'similarity': avg_similarity,
                'bbox': bbox,
                'confidence': confidence
            }
        elif face_id not in self.face_records:
            # If we don't have a confident name yet, show as "Identifying..."
            self.face_records[face_id] = {
                'name': "Identifying...",
                'similarity': 0,
                'bbox': bbox,
                'confidence': 0
            }
        else:
            # Just update the position
            self.face_records[face_id]['bbox'] = bbox
        
        return face_id
    
    def get_face_records(self):
        """Get the current face records"""
        return self.face_records

# Initialize webcam with higher resolution
print("Starting webcam with high resolution...")
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Could not open webcam")
    exit(1)

# Set camera resolution to high quality
cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
cap.set(cv2.CAP_PROP_FPS, 30)  # Try to get 30fps if supported

# Get actual camera properties (may differ from requested)
actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
actual_fps = cap.get(cv2.CAP_PROP_FPS)
print(f"Camera initialized at {int(actual_width)}x{int(actual_height)} @ {int(actual_fps)}fps")

print("Press 'q' to quit the application")

# Initialize face tracker
face_tracker = FaceTracker()

# Main loop for face recognition
frame_count = 0
notification_time = 0
notification_text = ""
last_process_time = time.time()
fps_update_time = time.time()
fps_counter = 0
fps_display = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Error: Failed to capture image from webcam")
        break
    
    current_time = time.time()
    fps_counter += 1
    
    # Update FPS display every second
    if current_time - fps_update_time >= 1.0:
        fps_display = fps_counter
        fps_counter = 0
        fps_update_time = current_time
    
    # Update face tracker time
    face_tracker.update_time()
    
    # Clean old faces
    face_tracker.clean_old_faces()
    
    frame_count += 1
    display_frame = frame.copy()
    
    # Clear old notifications (display for 3 seconds)
    if notification_text and current_time - notification_time > 3.0:
        notification_text = ""

    # Process frames at a reduced rate to decrease CPU load
    process_this_frame = (frame_count % RECOGNITION_INTERVAL == 0)
    
    # Get existing face records
    face_records = face_tracker.get_face_records()
    
    # Display existing tracked faces (do this for every frame)
    for face_id, face_data in face_records.items():
        x, y, w, h = face_data['bbox']
        name = face_data['name']
        similarity = face_data['similarity']
        
        # Draw a box around the face with color based on recognition state
        if name == "Identifying...":
            color = (0, 165, 255)  # Orange for identifying
        elif name == "Unknown":
            color = (0, 0, 255)    # Red for unknown
        else:
            color = (0, 255, 0)    # Green for known person
            
        # Draw face box
        cv2.rectangle(display_frame, (x, y), (x+w, y+h), color, 2)
        
        # Add a filled rectangle for text background
        cv2.rectangle(display_frame, (x, y+h), (x+w, y+h+30), color, cv2.FILLED)
        
        # Display name and similarity score
        if name != "Identifying..." and name != "Unknown":
            display_text = f"{name} ({similarity:.2f})"
        else:
            display_text = name
        
        # Display text with better centering
        text_size = cv2.getTextSize(display_text, cv2.FONT_HERSHEY_DUPLEX, 0.6, 1)[0]
        text_x = x + (w - text_size[0]) // 2
        cv2.putText(display_frame, display_text, (text_x, y+h+20), 
                    cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)
    
    # Only process every Nth frame to reduce CPU load
    if process_this_frame:
        processing_start_time = time.time()
        
        # Detect and process face in current frame
        face_img, face_coords = detect_and_crop_face(frame)
        
        if face_img is not None and face_img.size > 0 and face_coords is not None:
            x, y, w, h = face_coords
            
            # Extract face features
            try:
                embedding = extract_resnet_features(face_img)
                
                # Compare with known faces
                best_match = "Unknown"
                best_similarity = 0
                
                for person_name, known_embeddings in known_faces.items():
                    if not known_embeddings:
                        continue
                    
                    # Calculate cosine similarity with all known embeddings for this person
                    similarities = [1 - cosine(embedding, known_emb) for known_emb in known_embeddings]
                    avg_similarity = np.mean(similarities)
                    
                    # Update best match if this person is more similar
                    if avg_similarity > best_similarity and avg_similarity > SIMILARITY_THRESHOLD:
                        best_similarity = avg_similarity
                        best_match = person_name
                
                # Update face tracker with new detection
                face_id = face_tracker.update_face(face_coords, best_match, best_similarity)
                
                # Only mark attendance if this is a confirmed face (not "Identifying..." or "Unknown")
                face_data = face_tracker.get_face_records().get(face_id)
                if face_data and face_data['name'] != "Identifying..." and face_data['name'] != "Unknown":
                    # Mark attendance only if confidence is high enough after multiple detections
                    if face_data['confidence'] >= FACE_RECOGNITION_CONFIDENCE and mark_attendance(face_data['name']):
                        notification_text = f"Attendance marked for {face_data['name']}"
                        notification_time = current_time
            
            except Exception as e:
                print(f"Error processing face: {str(e)}")
        
        # Measure and report processing time
        processing_time = time.time() - processing_start_time
        if processing_time > 0.1:  # Only log if processing takes significant time
            print(f"Frame processing time: {processing_time:.3f}s")
    
    # Display FPS
    cv2.putText(display_frame, f"FPS: {fps_display}", (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # Display notification if available
    if notification_text:
        # Display notification at the bottom center
        text_size = cv2.getTextSize(notification_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
        text_x = (display_frame.shape[1] - text_size[0]) // 2
        text_y = display_frame.shape[0] - 20
        
        # Add background for better visibility
        cv2.rectangle(display_frame, 
                     (text_x - 10, text_y - 25), 
                     (text_x + text_size[0] + 10, text_y + 5), 
                     (0, 0, 0), cv2.FILLED)
        
        cv2.putText(display_frame, notification_text, (text_x, text_y), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Show the frame
    cv2.imshow('Face Recognition', display_frame)
    
    # Break the loop when 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release resources
cap.release()
cv2.destroyAllWindows()
print("Application closed")
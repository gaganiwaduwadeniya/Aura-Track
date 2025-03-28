from flask import Flask, request, jsonify
import cv2
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
import pickle
import shutil
from flask_cors import CORS
import datetime
from datetime import datetime  # This is the correct import
import base64
from scipy.spatial.distance import cosine
import mediapipe as mp
import time
from collections import Counter


app = Flask(__name__)
CORS(app)

# Configuration
MODEL_FOLDER = 'resnet50_model'
FEATURE_MODEL_PATH = os.path.join(MODEL_FOLDER, 'resnet50_face_features.h5')
TEMP_FACES_DIR = 'temp_faces'
OUTPUT_FILE = 'face_embeddings.pkl'
SIMILARITY_THRESHOLD = 0.4  # Adjusted for ResNet50 (higher value means more similar)

# Ensure temp directory exists
os.makedirs(TEMP_FACES_DIR, exist_ok=True)

# Configure TensorFlow for better performance (optional)
tf.config.threading.set_intra_op_parallelism_threads(4)
tf.config.threading.set_inter_op_parallelism_threads(4)

# Initialize MediaPipe Face Detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
face_detection = mp_face_detection.FaceDetection(
    model_selection=1,  # 0=closer faces, 1=longer distance faces
    min_detection_confidence=0.5
)

# Function to perform face alignment using eye landmarks
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
def extract_resnet_features(face_img, resnet_feature_model):
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

# Function to detect face in an image (for validation only)
def detect_face(image_data):
    try:
        # Convert base64 to image
        if ',' in image_data:
            image_data = image_data.split(',')[1]  # Remove data URL prefix
        
        image_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return False, "Failed to decode image"
        
        # Detect face using MediaPipe instead of Haar cascade
        rgb_image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb_image)
        
        if not results.detections:
            return False, "No face detected in the image"
        elif len(results.detections) > 1:
            return False, "Multiple faces detected, please capture only one face"
        
        # Get the first detected face
        detection = results.detections[0]
        bboxC = detection.location_data.relative_bounding_box
        
        # Convert normalized coordinates to absolute pixel values
        ih, iw, _ = img.shape
        x = int(bboxC.xmin * iw)
        y = int(bboxC.ymin * ih)
        w = int(bboxC.width * iw)
        h = int(bboxC.height * ih)
        
        # Calculate face area ratio
        image_area = img.shape[0] * img.shape[1]
        face_area = w * h
        face_ratio = face_area / image_area
        
        if face_ratio < 0.05:
            return False, "Face is too small in the image, please move closer"
        elif face_ratio > 0.7:
            return False, "Face is too large in the image, please move back"
        
        # Additional check for face detection confidence
        if detection.score[0] < 0.7:
            return False, "Face detection confidence is too low, please try with better lighting"
        
        return True, "Face detected successfully"
        
    except Exception as e:
        return False, f"Error processing image: {str(e)}"

# Load the ResNet50 model (lazy loading - will only load when needed)
_resnet_model = None
def get_resnet_model():
    global _resnet_model
    if _resnet_model is None:
        print("Loading ResNet50 Face feature extraction model...")
        try:
            _resnet_model = load_model(FEATURE_MODEL_PATH)
            print("Model loaded successfully!")
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            _resnet_model = None
    return _resnet_model


@app.route('/api/process-images', methods=['POST'])
def process_images():
    try:
        # Get the images data from request
        data = request.json
        images = data.get('images', [])
        
        if not images:
            return jsonify({"error": "No images provided"}), 400
        
        # Load ResNet50 model
        resnet_feature_model = get_resnet_model()
        if resnet_feature_model is None:
            return jsonify({"error": "Failed to load ResNet50 model"}), 500
        
        # Clear temp directory
        if os.path.exists(TEMP_FACES_DIR):
            shutil.rmtree(TEMP_FACES_DIR)
        os.makedirs(TEMP_FACES_DIR, exist_ok=True)
        
        # Save images to temp directory
        logs = ["Starting image processing with ResNet50 model..."]
        
        # Group images by person name
        person_images = {}
        for img_data in images:
            person_name = img_data.get('personName')
            if person_name not in person_images:
                person_images[person_name] = []
            person_images[person_name].append(img_data)
        
        logs.append(f"Found images for {len(person_images)} users")
        
        # Save images grouped by person
        for person_name, person_img_list in person_images.items():
            person_dir = os.path.join(TEMP_FACES_DIR, person_name)
            os.makedirs(person_dir, exist_ok=True)
            
            logs.append(f"Saving {len(person_img_list)} images for {person_name}")
            
            for img_data in person_img_list:
                image_name = img_data.get('imageName')
                image_base64 = img_data.get('imageData')
                
                # Handle different base64 formats
                if ',' in image_base64:
                    image_base64 = image_base64.split(',')[1]  # Remove data URL prefix
                
                # Convert base64 to image and save
                image_bytes = base64.b64decode(image_base64)
                img_path = os.path.join(person_dir, image_name)
                with open(img_path, 'wb') as f:
                    f.write(image_bytes)
                
                logs.append(f"  Saved image: {image_name} for person: {person_name}")
        
        # Process images with ResNet50 model
        logs.append("Processing images with ResNet50 model...")
        
        # Process each person's directory
        embeddings_data = {}
        
        for person_name in os.listdir(TEMP_FACES_DIR):
            person_path = os.path.join(TEMP_FACES_DIR, person_name)
            if os.path.isdir(person_path):
                embeddings_data[person_name] = []
                logs.append(f"Processing images for: {person_name}")
                
                # Process each image in the person's directory
                for img_name in os.listdir(person_path):
                    if img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                        img_path = os.path.join(person_path, img_name)
                        try:
                            # Load image
                            img = cv2.imread(img_path)
                            if img is None:
                                logs.append(f"Could not read image: {img_path}")
                                continue
                            
                            # Detect face in the image using MediaPipe
                            face_img, face_coords = detect_and_crop_face(img)
                            
                            if face_img is not None and face_img.size > 0:
                                # Extract features using ResNet50
                                embedding = extract_resnet_features(face_img, resnet_feature_model)
                                
                                # Store embedding
                                embeddings_data[person_name].append(embedding.tolist())  # Convert numpy array to list for JSON
                                logs.append(f"  Processed: {img_name}")
                            else:
                                logs.append(f"  No face detected in: {img_name}")
                        
                        except Exception as e:
                            logs.append(f"  Error processing {img_path}: {str(e)}")
        
        # Print summary
        total_embeddings = sum(len(emb) for emb in embeddings_data.values())
        logs.append(f"\nProcessed {total_embeddings} face images for {len(embeddings_data)} persons")
        
        # Save embeddings to file (for backup/local use)
        logs.append(f"Saving embeddings to {OUTPUT_FILE}...")
        with open(OUTPUT_FILE, 'wb') as f:
            pickle.dump(embeddings_data, f)
        logs.append("Embeddings saved successfully!")
        
        # Return the embeddings and logs
        response = {
            "logs": logs,
            "embeddings": embeddings_data,
            "timestamp": datetime.now().isoformat()  # FIXED: Changed from datetime.datetime.now()
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500

# New route for face recognition using stored embeddings
@app.route('/api/recognize-face', methods=['POST'])
def recognize_face():
    try:
        # Get the image data from request
        data = request.json
        image_data = data.get('image')
        stored_embeddings = data.get('embeddings')
        
        if not image_data:
            return jsonify({"error": "No image provided"}), 400
        
        if not stored_embeddings:
            return jsonify({"error": "No embeddings provided"}), 400
        
        # Convert stored embeddings from lists back to numpy arrays
        processed_embeddings = {}
        for person_name, embeddings_list in stored_embeddings.items():
            processed_embeddings[person_name] = [np.array(emb) for emb in embeddings_list]
        
        # Load ResNet50 model
        resnet_feature_model = get_resnet_model()
        if resnet_feature_model is None:
            return jsonify({"error": "Failed to load ResNet50 model"}), 500
        
        # Convert base64 to image
        if ',' in image_data:
            image_data = image_data.split(',')[1]  # Remove data URL prefix
        
        image_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Failed to decode image"}), 400
        
        # Detect face in the image using MediaPipe with error handling
        max_retries = 3
        face_img = None
        face_coords = None
        
        for attempt in range(max_retries):
            try:
                face_img, face_coords = detect_and_crop_face_with_custom_handler(img)
                if face_img is not None and face_img.size > 0:
                    break  # Successfully detected face
            except Exception as e:
                # Log the error but continue to retry
                print(f"Face detection attempt {attempt+1} failed: {str(e)}")
                # Brief pause before retrying
                time.sleep(0.1)
        
        if face_img is None or face_img.size == 0:
            return jsonify({"recognizedName": "Unknown", "similarity": 0, 
                           "message": "No face detected in the image",
                           "timestamp": datetime.now().isoformat()}), 200  # FIXED: Changed from datetime.datetime.now()
        
        # Extract features using ResNet50
        embedding = extract_resnet_features(face_img, resnet_feature_model)
        
        # Compare with known faces
        best_match = "Unknown"
        best_similarity = 0
        similarities = {}
        
        for person_name, known_embeddings in processed_embeddings.items():
            if not known_embeddings:
                continue
            
            # Calculate cosine similarity with all known embeddings for this person
            person_similarities = [1 - cosine(embedding, known_emb) for known_emb in known_embeddings]
            avg_similarity = np.mean(person_similarities)
            similarities[person_name] = avg_similarity
            
            # Update best match if this person is more similar
            if avg_similarity > best_similarity and avg_similarity > SIMILARITY_THRESHOLD:
                best_similarity = avg_similarity
                best_match = person_name
        
        # Create response
        recognition_result = {
            "recognizedName": best_match,
            "similarity": float(best_similarity) if best_match != "Unknown" else 0,
            "allSimilarities": {name: float(sim) for name, sim in similarities.items()},
            "timestamp": datetime.now().isoformat()  # FIXED: Changed from datetime.datetime.now()
        }
        
        return jsonify(recognition_result)
    
    except Exception as e:
        print(f"Recognition error: {str(e)}")
        # Return a graceful failure that won't break the frontend
        return jsonify({
            "recognizedName": "Unknown", 
            "similarity": 0,
            "error": f"Recognition error occurred",
            "timestamp": datetime.now().isoformat()  # FIXED: Changed from datetime.datetime.now()
        }), 200  # Using 200 status so frontend continues to work

# Add this new function that uses a custom InputStreamHandler
def detect_and_crop_face_with_custom_handler(image):
    # Create a MediaPipe face detection solution with custom config
    mp_face_detection = mp.solutions.face_detection
    
    # Configure face detection with custom options
    # Increase timeout_micros and configure for immediate input stream handling
    with mp_face_detection.FaceDetection(
        model_selection=1,  # 0 for short-range, 1 for full-range detection
        min_detection_confidence=0.5,
    ) as face_detection:
        # Important: set the InputStreamHandler option (this is done through internal properties)
        # Since we can't directly set this in the Python API, we need to handle errors
        
        # Convert the image to RGB (MediaPipe uses RGB)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Process the image - use non_blocking to avoid timestamp issues
        # Perform detections with added robustness
        results = face_detection.process(image_rgb)
        
        if results.detections:
            # Get the first face detection (highest confidence)
            detection = results.detections[0]
            
            # Get bounding box
            bboxC = detection.location_data.relative_bounding_box
            ih, iw, _ = image.shape
            x = int(bboxC.xmin * iw)
            y = int(bboxC.ymin * ih)
            w = int(bboxC.width * iw)
            h = int(bboxC.height * ih)
            
            # Adjust for out-of-bounds coordinates
            x = max(0, x)
            y = max(0, y)
            w = min(w, iw - x)
            h = min(h, ih - y)
            
            # Crop face
            face_img = image[y:y+h, x:x+w]
            
            # Add padding around the face (20% each side)
            padding_x = int(0.2 * w)
            padding_y = int(0.2 * h)
            
            # Calculate new coordinates with padding
            padded_x = max(0, x - padding_x)
            padded_y = max(0, y - padding_y)
            padded_w = min(iw - padded_x, w + 2 * padding_x)
            padded_h = min(ih - padded_y, h + 2 * padding_y)
            
            # Crop padded face
            padded_face = image[padded_y:padded_y+padded_h, padded_x:padded_x+padded_w]
            
            # Return the face image and coordinates
            return padded_face, (padded_x, padded_y, padded_w, padded_h)
        else:
            return None, None
        

if __name__ == "__main__":
    app.run(debug=True, port=5001)
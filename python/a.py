import cv2
import os
import datetime
import numpy as np
from deepface import DeepFace
from scipy.spatial.distance import cosine

# Create attendance file
attendance_file = "attendance.csv"
if not os.path.exists(attendance_file):
    with open(attendance_file, "w") as f:
        f.write("Name,Time\n")

# Load face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Load known faces
known_faces_dir = "known_faces"
known_faces = {}

# Precompute embeddings
for person_name in os.listdir(known_faces_dir):
    person_path = os.path.join(known_faces_dir, person_name)
    if os.path.isdir(person_path):
        known_faces[person_name] = []
        for img_name in os.listdir(person_path):
            img_path = os.path.join(person_path, img_name)
            try:
                embedding = DeepFace.represent(img_path, model_name="Facenet", enforce_detection=False)[0]['embedding']
                known_faces[person_name].append(embedding)
            except:
                print(f"Skipping {img_path}, could not extract embedding.")

# Initialize webcam
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    try:
        # Set enforce_detection to False
        detected_faces = DeepFace.extract_faces(frame, detector_backend="retinaface", enforce_detection=True)
        
        for face in detected_faces:
            facial_area = face['facial_area']
            x = facial_area['x']
            y = facial_area['y']
            w = facial_area['w']
            h = facial_area['h']
            face_roi = frame[y:y+h, x:x+w]
            
            try:
                face_embedding = DeepFace.represent(face_roi, model_name="Facenet", enforce_detection=False)[0]['embedding']
            except Exception as e:
                print(f"Error getting embedding: {str(e)}")
                continue
            
            name = "Unknown"
            min_distance = 0.4  # Threshold for matching
            
            for person_name, embeddings in known_faces.items():
                for stored_embedding in embeddings:
                    distance = cosine(face_embedding, stored_embedding)
                    if distance < min_distance:
                        name = person_name
                        min_distance = distance  # Update best match
            
            # Mark attendance
            if name != "Unknown":
                with open(attendance_file, "a") as f:
                    f.write(f"{name},{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            # Draw rectangle and label
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(frame, name, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
    
    except Exception as e:
        print(f"Error in face detection: {str(e)}")
        pass
    
    cv2.imshow('Face Recognition Attendance', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break  # Exit when 'q' is pressed

# Clean up
cap.release()
cv2.destroyAllWindows()
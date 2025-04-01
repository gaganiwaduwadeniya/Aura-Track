import os
import time
import numpy as np
import tensorflow as tf
import cv2
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model
from scipy.spatial.distance import cosine, euclidean
from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score, roc_curve, auc
from tqdm import tqdm
import pandas as pd
import seaborn as sns
from collections import defaultdict

print("TensorFlow version:", tf.__version__)

# Configuration
MODEL_FOLDER = 'vgg_model'
FEATURE_MODEL_PATH = os.path.join(MODEL_FOLDER, 'vggface_features.h5')
KNOWN_FACES_DIR = 'faces'
RESULTS_DIR = 'vgg_validation_results'
SIMILARITY_THRESHOLD = 0.6  # Default threshold, will be optimized

# Create results directory
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)
    print(f"Created directory: {RESULTS_DIR}")

# Load the VGG feature extraction model
print("Loading VGG Face feature extraction model...")
try:
    # Configure TensorFlow for better performance
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(4)
    
    # Load model
    vgg_feature_model = load_model(FEATURE_MODEL_PATH)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    exit(1)

# Load face cascade for detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
if face_cascade.empty():
    print("Error: Could not load face cascade classifier")
    exit(1)

# Function to detect face using Haar cascade and return cropped face
def detect_and_crop_face(image):
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Detect faces with adjusted parameters for better detection
    faces = face_cascade.detectMultiScale(
        gray, 
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    
    if len(faces) == 0:
        return None, None
    
    # Get the first detected face
    x, y, w, h = faces[0]
    
    # Crop the face
    face_img = image[y:y+h, x:x+w]
    
    return face_img, (x, y, w, h)

# Function to preprocess image for VGG model
def preprocess_image(img):
    # Resize to 224x224 (VGG input size)
    resized = cv2.resize(img, (224, 224))
    # Convert from BGR to RGB (OpenCV uses BGR, but model expects RGB)
    rgb_img = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    # Normalize pixel values
    normalized = rgb_img / 255.0
    # Add batch dimension
    preprocessed = np.expand_dims(normalized, axis=0)
    return preprocessed

# Function to extract face embeddings using VGG model
def extract_vgg_features(face_img):
    start_time = time.time()
    preprocessed = preprocess_image(face_img)
    features = vgg_feature_model.predict(preprocessed, verbose=0)
    processing_time = time.time() - start_time
    return features[0], processing_time

# Define distance metrics
def calculate_distances(embedding1, embedding2):
    cosine_dist = cosine(embedding1, embedding2)
    cosine_similarity = 1 - cosine_dist
    euclidean_dist = euclidean(embedding1, embedding2)
    return {
        'cosine_similarity': cosine_similarity,
        'cosine_distance': cosine_dist,
        'euclidean_distance': euclidean_dist
    }

# Collect all person data
def collect_person_data():
    all_person_data = {}
    persons_with_sufficient_images = []
    
    print("Collecting face data from directories...")
    for person_name in os.listdir(KNOWN_FACES_DIR):
        person_path = os.path.join(KNOWN_FACES_DIR, person_name)
        
        if os.path.isdir(person_path):
            person_images = []
            
            for img_name in os.listdir(person_path):
                if img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    img_path = os.path.join(person_path, img_name)
                    person_images.append(img_path)
            
            # Only include persons with at least 2 images (1 for testing, rest for training)
            if len(person_images) >= 2:
                all_person_data[person_name] = person_images
                persons_with_sufficient_images.append(person_name)
                print(f"Found {person_name} with {len(person_images)} images")
            else:
                print(f"Skipping {person_name} - insufficient images (need at least 2)")
    
    return all_person_data, persons_with_sufficient_images

# Run leave-one-out cross validation
def run_cross_validation(all_person_data, persons_list):
    results = []
    all_distances = defaultdict(list)
    all_genuine_distances = defaultdict(list)
    all_impostor_distances = defaultdict(list)
    processing_times = []
    
    print("\nRunning cross-validation...")
    
    # For each person
    for person_name in tqdm(persons_list, desc="Processing persons"):
        # Get all images for this person
        person_images = all_person_data[person_name]
        
        # For each image of the person (leave-one-out)
        for test_idx, test_image_path in enumerate(person_images):
            try:
                # Load test image
                test_img = cv2.imread(test_image_path)
                if test_img is None:
                    print(f"Could not read image: {test_image_path}")
                    continue
                
                # Detect and crop face
                test_face, _ = detect_and_crop_face(test_img)
                if test_face is None or test_face.size == 0:
                    print(f"No face detected in: {test_image_path}")
                    continue
                
                # Extract features
                test_embedding, proc_time = extract_vgg_features(test_face)
                processing_times.append(proc_time)
                
                # Build training set (all other images from this person + other persons)
                training_embeddings = {}
                
                # Add other images from this person (genuine matches)
                for train_idx, train_image_path in enumerate(person_images):
                    if train_idx != test_idx:  # Skip the test image
                        train_img = cv2.imread(train_image_path)
                        train_face, _ = detect_and_crop_face(train_img)
                        
                        if train_face is not None and train_face.size > 0:
                            train_embedding, _ = extract_vgg_features(train_face)
                            
                            # Store distances for this genuine pair
                            distances = calculate_distances(test_embedding, train_embedding)
                            for metric, value in distances.items():
                                all_genuine_distances[metric].append(value)
                                all_distances[metric].append((value, True))  # True = genuine match
                            
                            # Add to training set
                            if person_name not in training_embeddings:
                                training_embeddings[person_name] = []
                            training_embeddings[person_name].append(train_embedding)
                
                # Add samples from other persons (impostor matches)
                for other_person in persons_list:
                    if other_person != person_name:
                        # Take a subset of images from other persons to keep balanced
                        other_images = all_person_data[other_person][:min(3, len(all_person_data[other_person]))]
                        
                        for other_image_path in other_images:
                            other_img = cv2.imread(other_image_path)
                            other_face, _ = detect_and_crop_face(other_img)
                            
                            if other_face is not None and other_face.size > 0:
                                other_embedding, _ = extract_vgg_features(other_face)
                                
                                # Store distances for this impostor pair
                                distances = calculate_distances(test_embedding, other_embedding)
                                for metric, value in distances.items():
                                    all_impostor_distances[metric].append(value)
                                    all_distances[metric].append((value, False))  # False = impostor match
                                
                                # Add to training set
                                if other_person not in training_embeddings:
                                    training_embeddings[other_person] = []
                                training_embeddings[other_person].append(other_embedding)
                
                # Now classify the test image
                best_match = "Unknown"
                best_similarity = 0
                best_distance = 1.0  # Initialize with maximum cosine distance
                
                for candidate_name, embeddings in training_embeddings.items():
                    if not embeddings:
                        continue
                    
                    # Calculate average similarity with all embeddings for this person
                    similarities = [1 - cosine(test_embedding, emb) for emb in embeddings]
                    avg_similarity = np.mean(similarities)
                    
                    # Update best match if this person is more similar
                    if avg_similarity > best_similarity:
                        best_similarity = avg_similarity
                        best_match = candidate_name if avg_similarity > (1 - SIMILARITY_THRESHOLD) else "Unknown"
                
                # Record result
                is_correct = (best_match == person_name)
                result = {
                    'person': person_name,
                    'test_image': os.path.basename(test_image_path),
                    'predicted': best_match,
                    'similarity': best_similarity,
                    'correct': is_correct,
                    'processing_time': proc_time
                }
                results.append(result)
                
            except Exception as e:
                print(f"Error processing {test_image_path}: {str(e)}")
    
    return results, all_distances, all_genuine_distances, all_impostor_distances, processing_times

# Find optimal threshold
def find_optimal_threshold(all_distances, metric='cosine_similarity'):
    print(f"\nFinding optimal threshold for {metric}...")
    
    # Extract data for the specified metric
    data = [(d, label) for d, label in all_distances[metric]]
    distances = [d for d, _ in data]
    labels = [label for _, label in data]
    
    # Calculate ROC curve
    if metric == 'cosine_similarity' or metric.endswith('_similarity'):
        # For similarity measures, higher values indicate genuine matches
        fpr, tpr, thresholds = roc_curve(labels, distances)
    else:
        # For distance measures, lower values indicate genuine matches
        fpr, tpr, thresholds = roc_curve(labels, [-d for d in distances])
    
    # Find optimal threshold (maximum J statistic = TPR - FPR)
    j_scores = tpr - fpr
    optimal_idx = np.argmax(j_scores)
    optimal_threshold = thresholds[optimal_idx]
    
    # Adjust threshold based on metric type
    if metric == 'cosine_similarity' or metric.endswith('_similarity'):
        return optimal_threshold, fpr, tpr, thresholds
    else:
        # Convert back to original scale
        return -optimal_threshold, fpr, tpr, -thresholds

# Calculate performance metrics
def calculate_metrics(results, optimal_thresholds):
    metrics = {}
    
    # Basic accuracy from the classification results
    correct = sum(1 for r in results if r['correct'])
    total = len(results)
    metrics['accuracy'] = correct / total if total > 0 else 0
    
    # Average processing time
    metrics['avg_processing_time'] = np.mean([r['processing_time'] for r in results])
    
    # For each distance metric
    for metric, threshold in optimal_thresholds.items():
        print(f"\nCalculating performance with optimal {metric} threshold: {threshold:.4f}")
        
        # Create a dataframe for easier analysis
        df = pd.DataFrame(results)
        
        # Apply threshold to adjust predictions
        if metric == 'cosine_similarity':
            # Adjust predictions based on optimal threshold
            predictions = []
            true_labels = []
            for _, row in df.iterrows():
                true_person = row['person']
                pred_person = row['predicted'] if row['similarity'] >= threshold else "Unknown"
                true_labels.append(true_person)
                predictions.append(pred_person)
            
            # Calculate performance metrics
            cm = confusion_matrix(true_labels, predictions, labels=np.unique(true_labels + predictions))
            metrics[f'{metric}_accuracy'] = accuracy_score(true_labels, predictions)
            
            # Convert to binary problem (correct/incorrect identification)
            binary_true = [1 if true_labels[i] == predictions[i] else 0 for i in range(len(true_labels))]
            binary_pred = [1 if predictions[i] != "Unknown" else 0 for i in range(len(predictions))]
            
            # Calculate precision, recall, F1
            try:
                metrics[f'{metric}_precision'] = precision_score(binary_true, binary_pred, zero_division=0)
                metrics[f'{metric}_recall'] = recall_score(binary_true, binary_pred, zero_division=0)
                metrics[f'{metric}_f1'] = f1_score(binary_true, binary_pred, zero_division=0)
            except Exception as e:
                print(f"Error calculating metrics: {e}")
                metrics[f'{metric}_precision'] = 0
                metrics[f'{metric}_recall'] = 0
                metrics[f'{metric}_f1'] = 0
    
    return metrics

# Plot distance distributions
def plot_distance_distributions(genuine_distances, impostor_distances, optimal_thresholds):
    print("\nPlotting distance distributions...")
    
    # Set up the figure
    fig, axes = plt.subplots(len(genuine_distances), 1, figsize=(10, 4 * len(genuine_distances)))
    
    # If only one metric, wrap axes in a list
    if len(genuine_distances) == 1:
        axes = [axes]
    
    for i, metric in enumerate(genuine_distances.keys()):
        ax = axes[i]
        
        # Get the data
        genuine_data = genuine_distances[metric]
        impostor_data = impostor_distances[metric]
        
        # Plot histograms
        ax.hist(genuine_data, bins=30, alpha=0.5, label='Genuine Pairs', color='green')
        ax.hist(impostor_data, bins=30, alpha=0.5, label='Impostor Pairs', color='red')
        
        # If we have an optimal threshold, plot it
        if metric in optimal_thresholds:
            ax.axvline(x=optimal_thresholds[metric], color='blue', linestyle='--', 
                      label=f'Optimal Threshold: {optimal_thresholds[metric]:.4f}')
        
        ax.set_title(f'Distribution of {metric}')
        ax.set_xlabel(metric)
        ax.set_ylabel('Frequency')
        ax.legend()
    
    plt.tight_layout()
    plt.savefig(os.path.join(RESULTS_DIR, 'distance_distributions.png'))
    print(f"Saved distance distributions plot to {RESULTS_DIR}/distance_distributions.png")

# Plot ROC curves
def plot_roc_curves(all_distances, optimal_thresholds):
    print("\nPlotting ROC curves...")
    
    plt.figure(figsize=(10, 8))
    
    for metric in all_distances.keys():
        # Calculate ROC curve
        data = [(d, label) for d, label in all_distances[metric]]
        distances = [d for d, _ in data]
        labels = [label for _, label in data]
        
        if metric == 'cosine_similarity' or metric.endswith('_similarity'):
            fpr, tpr, _ = roc_curve(labels, distances)
        else:
            fpr, tpr, _ = roc_curve(labels, [-d for d in distances])
        
        roc_auc = auc(fpr, tpr)
        
        # Plot ROC curve
        plt.plot(fpr, tpr, lw=2, label=f'{metric} (AUC = {roc_auc:.2f})')
    
    # Reference line
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('Receiver Operating Characteristic (ROC) Curve')
    plt.legend(loc="lower right")
    plt.grid(True)
    
    plt.savefig(os.path.join(RESULTS_DIR, 'roc_curves.png'))
    print(f"Saved ROC curves plot to {RESULTS_DIR}/roc_curves.png")

# Create a confusion matrix
def plot_confusion_matrix(results, persons_list):
    print("\nGenerating confusion matrix...")
    
    # Extract actual and predicted labels
    y_true = [r['person'] for r in results]
    y_pred = [r['predicted'] for r in results]
    
    # Get unique labels (including "Unknown")
    labels = list(set(y_true + y_pred))
    labels.sort()
    
    # Calculate confusion matrix
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    
    # Plot confusion matrix
    plt.figure(figsize=(12, 10))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels)
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.title('Confusion Matrix')
    plt.tight_layout()
    
    plt.savefig(os.path.join(RESULTS_DIR, 'confusion_matrix.png'))
    print(f"Saved confusion matrix to {RESULTS_DIR}/confusion_matrix.png")

# Save results to a CSV file
def save_results_to_csv(results, metrics, optimal_thresholds):
    # Save individual test results
    results_df = pd.DataFrame(results)
    results_df.to_csv(os.path.join(RESULTS_DIR, 'test_results.csv'), index=False)
    
    # Save overall metrics
    metrics_df = pd.DataFrame({
        'Metric': list(metrics.keys()) + list(optimal_thresholds.keys()),
        'Value': list(metrics.values()) + list(optimal_thresholds.values())
    })
    metrics_df.to_csv(os.path.join(RESULTS_DIR, 'performance_metrics.csv'), index=False)
    
    print(f"\nSaved results to {RESULTS_DIR}/test_results.csv")
    print(f"Saved metrics to {RESULTS_DIR}/performance_metrics.csv")

# Main validation function
def validate_vgg_face_recognition_model():
    print("Starting VGG face recognition model validation...")
    
    # Collect data
    all_person_data, persons_list = collect_person_data()
    
    if len(persons_list) == 0:
        print("Error: No persons with sufficient images found.")
        return
    
    print(f"Found {len(persons_list)} persons with sufficient images for validation.")
    
    # Run cross-validation
    results, all_distances, genuine_distances, impostor_distances, processing_times = run_cross_validation(all_person_data, persons_list)
    
    if not results:
        print("Error: No validation results generated.")
        return
    
    # Find optimal thresholds for each distance metric
    optimal_thresholds = {}
    roc_data = {}
    
    for metric in all_distances.keys():
        try:
            threshold, fpr, tpr, thresholds = find_optimal_threshold(all_distances, metric)
            optimal_thresholds[metric] = threshold
            roc_data[metric] = (fpr, tpr, thresholds)
        except Exception as e:
            print(f"Error finding optimal threshold for {metric}: {e}")
    
    # Calculate metrics
    metrics = calculate_metrics(results, optimal_thresholds)
    
    # Print summary
    print("\n========== VGG MODEL VALIDATION RESULTS ==========")
    print(f"Total Tests: {len(results)}")
    print(f"Overall Accuracy: {metrics['accuracy']:.4f}")
    print(f"Average Processing Time: {metrics['avg_processing_time'] * 1000:.2f} ms")
    
    for metric, threshold in optimal_thresholds.items():
        print(f"\nOptimal {metric} threshold: {threshold:.4f}")
        if f'{metric}_accuracy' in metrics:
            print(f"- Accuracy: {metrics[f'{metric}_accuracy']:.4f}")
        if f'{metric}_precision' in metrics:
            print(f"- Precision: {metrics[f'{metric}_precision']:.4f}")
        if f'{metric}_recall' in metrics:
            print(f"- Recall: {metrics[f'{metric}_recall']:.4f}")
        if f'{metric}_f1' in metrics:
            print(f"- F1 Score: {metrics[f'{metric}_f1']:.4f}")
    
    # Create visualizations
    plot_distance_distributions(genuine_distances, impostor_distances, optimal_thresholds)
    plot_roc_curves(all_distances, optimal_thresholds)
    plot_confusion_matrix(results, persons_list)
    
    # Save results
    save_results_to_csv(results, metrics, optimal_thresholds)
    
    print("\n========== VALIDATION COMPLETE ==========")
    print(f"All results and visualizations saved to {RESULTS_DIR} directory.")

# Run the validation
if __name__ == "__main__":
    validate_vgg_face_recognition_model()
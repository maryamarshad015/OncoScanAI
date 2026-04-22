#!/usr/bin/env python3
"""Create multiple test images and check predictions"""

import torch
import numpy as np
from PIL import Image
from io import BytesIO
from utils import preprocess_medical_image

yolo = torch.load("models/yolov11.pth", map_location='cpu', weights_only=False)

def create_test_image(pattern="random"):
    """Create different test images"""
    if pattern == "black":
        # Almost black image
        img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    elif pattern == "white":
        # White image
        img_array = np.full((224, 224, 3), 255, dtype=np.uint8)
    elif pattern == "random":
        # Random noise
        img_array = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    elif pattern == "gradual":
        # Gradual gradient
        img_array = np.zeros((224, 224, 3), dtype=np.uint8)
        for i in range(224):
            img_array[i, :] = int(255 * i / 224)
    else:
        img_array = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    
    img = Image.fromarray(img_array, mode='RGB')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()

patterns = ["black", "white", "random", "gradual", "random"]
print("[TEST] Testing multiple synthetic images...\n")

for i, pattern in enumerate(patterns):
    print(f"Test {i+1}: {pattern.upper()} image")
    content = create_test_image(pattern)
    
    try:
        input_tensor = preprocess_medical_image(content)
        
        with torch.no_grad():
            output = yolo(input_tensor)
        
        if isinstance(output, list):
            output = output[0]
        
        if hasattr(output, 'probs'):
            probs = output.probs.data
            pred_idx = torch.argmax(probs)
            confidence = probs[pred_idx]
            class_name = output.names.get(pred_idx.item())
            
            benign_conf = float(probs[0])
            malignant_conf = float(probs[1])
            
            print(f"  Benign: {benign_conf:.4f}, Malignant: {malignant_conf:.4f}")
            print(f"  → Predicted: {class_name} ({float(confidence):.4f})\n")
            
    except Exception as e:
        print(f"  Error: {e}\n")

print("[TEST] Completed!")

#!/usr/bin/env python3
"""Test different prediction strategies"""

import torch
import numpy as np
from PIL import Image
from io import BytesIO
from utils import preprocess_medical_image

yolo = torch.load("models/yolov11.pth", map_location='cpu', weights_only=False)

def create_test_image(pattern="random"):
    """Create different test images"""
    if pattern == "black":
        img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    elif pattern == "white":
        img_array = np.full((224, 224, 3), 255, dtype=np.uint8)
    else:
        img_array = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    
    img = Image.fromarray(img_array, mode='RGB')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()

patterns = ["black", "white", "black", "white"]
print("[TEST] Comparing prediction strategies...\n")
print(f"{'Image':<10} {'Benign%':<10} {'Malignant%':<10} {'argmax':<15} {'argmin':<15} {'1-argmax':<15}")
print("-" * 75)

for pattern in patterns:
    content = create_test_image(pattern)
    
    try:
        input_tensor = preprocess_medical_image(content)
        
        with torch.no_grad():
            output = yolo(input_tensor)
        
        if isinstance(output, list):
            output = output[0]
        
        if hasattr(output, 'probs'):
            probs = output.probs.data
            
            benign_conf = float(probs[0])
            malignant_conf = float(probs[1])
            
            # Strategy 1: argmax (current)
            pred_idx_max = torch.argmax(probs).item()
            class_max = output.names.get(pred_idx_max)
            
            # Strategy 2: argmin (inverted)
            pred_idx_min = torch.argmin(probs).item()
            class_min = output.names.get(pred_idx_min)
            
            # Strategy 3: 1 - argmax (flip benign/malignant)
            flipped_probs = 1.0 - probs
            pred_idx_flip = torch.argmax(flipped_probs).item()
            class_flip = output.names.get(pred_idx_flip)
            
            print(f"{pattern:<10} {benign_conf:<10.1%} {malignant_conf:<10.1%} {class_max:<15} {class_min:<15} {class_flip:<15}")
            
    except Exception as e:
        print(f"{pattern:<10} Error: {e}")

print("\n[TEST] Completed!")

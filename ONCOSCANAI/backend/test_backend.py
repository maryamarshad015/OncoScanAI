#!/usr/bin/env python3
"""Debug script to test backend startup"""

import sys
import torch
from utils import preprocess_medical_image
from ultralytics import YOLO

# Test loading YOLO model
print("[TEST] Loading YOLOv11 model...")
try:
    yolo = torch.load("models/yolov11.pth", map_location='cpu', weights_only=False)
    print(f"[OK] Model loaded: {type(yolo)}")
    
    if hasattr(yolo, 'names'):
        print(f"[INFO] Model class names: {yolo.names}")
    else:
        print("[WARN] Model has no 'names' attribute")
        
except Exception as e:
    print(f"[ERROR] Failed to load model: {e}")
    sys.exit(1)

# Test preprocessing with a test image if available
print("\n[TEST] Testing inference...")
try:
    test_image_path = "test_image.png"
    with open(test_image_path, "rb") as f:
        content = f.read()
    
    input_tensor = preprocess_medical_image(content, model_type='yolo')
    print(f"[OK] Image preprocessed: shape={input_tensor.shape}")
    
    # Run inference
    with torch.no_grad():
        output = yolo(input_tensor)
    
    if isinstance(output, list):
        output = output[0]
    
    print(f"[INFO] Output type: {type(output)}")
    
    if hasattr(output, 'probs'):
        probs = output.probs.data
        print(f"[INFO] Probabilities: {[float(p) for p in probs]}")
        print(f"[INFO] Class names from output: {output.names}")
        
        pred_idx = torch.argmax(probs)
        confidence = probs[pred_idx]
        class_name = output.names.get(pred_idx.item(), f"unknown_{pred_idx.item()}")
        
        print(f"[INFO] Prediction: class={class_name}, idx={pred_idx.item()}, conf={float(confidence):.4f}")
    
except FileNotFoundError:
    print("[WARN] test_image.png not found, skipping inference test")
except Exception as e:
    print(f"[ERROR] Inference test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n[TEST] All checks completed!")

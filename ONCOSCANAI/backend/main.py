
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import torchvision.models as models
import ultralytics  # Required for torch.load to deserialize YOLO models
import tensorflow as tf
from tensorflow import keras
import numpy as np

import os
import json
import io
import tempfile
from typing import Dict
from datetime import datetime
from utils import preprocess_medical_image

# Custom Keras layers for loading oncoscan_combined.h5
from tensorflow.keras.layers import Layer, Conv2D, Dropout, MaxPool2D, UpSampling2D, Concatenate, Multiply, Conv2DTranspose, BatchNormalization, Activation, Add

# Custom Dense layer to handle quantization_config
class CustomDense(tf.keras.layers.Dense):
    def __init__(self, quantization_config=None, **kwargs):
        # Remove quantization_config if present
        kwargs.pop('quantization_config', None)
        super().__init__(**kwargs)

def concat_func(x=None, **kwargs):
    """Custom function for Lambda layer concatenation"""
    if x is None:
        x = kwargs.get('x')
    if x is None:
        raise ValueError("concat_func requires input tensor")
    return tf.concat(x, axis=-1)

class EncoderBlock(Layer):
    def __init__(self, filters, rate, pooling=True, **kwargs):
        super(EncoderBlock, self).__init__(**kwargs)
        self.filters = filters
        self.rate = rate
        self.pooling = pooling

        self.c1 = Conv2D(
            filters,
            kernel_size=3,
            strides=1,
            padding="same",
            activation="relu",
            kernel_initializer="he_normal",
        )
        self.drop = Dropout(rate)
        self.c2 = Conv2D(
            filters,
            kernel_size=3,
            strides=1,
            padding="same",
            activation="relu",
            kernel_initializer="he_normal",
        )
        self.pool = MaxPool2D()

    def call(self, X):
        x = self.c1(X)
        x = self.drop(x)
        x = self.c2(x)

        if self.pooling:
            y = self.pool(x)
            return y, x  # pooled output + skip connection tensor
        else:
            return x

    def get_config(self):
        config = super().get_config()
        config.update({
            "filters": self.filters,
            "rate": self.rate,
            "pooling": self.pooling,
        })
        return config

class DecoderBlock(Layer):
    def __init__(self, filters, rate, **kwargs):
        super(DecoderBlock, self).__init__(**kwargs)
        self.filters = filters
        self.rate = rate
        self.up = UpSampling2D()
        self.net = EncoderBlock(filters, rate, pooling=False)

    def call(self, X):
        X, skip_X = X
        x = self.up(X)
        c_ = tf.concat([x, skip_X], axis=-1)
        x = self.net(c_)
        return x

    def get_config(self):
        config = super().get_config()
        config.update({
            "filters": self.filters,
            "rate": self.rate,
        })
        return config

class AttentionGate(Layer):
    def __init__(self, filters, bn, **kwargs):
        super(AttentionGate, self).__init__(**kwargs)
        self.filters = filters
        self.bn = bn

        self.normal = Conv2D(filters, kernel_size=3, padding='same',
                             activation='relu', kernel_initializer='he_normal')
        self.down = Conv2D(filters, kernel_size=3, strides=2, padding='same',
                           activation='relu', kernel_initializer='he_normal')
        self.learn = Conv2D(1, kernel_size=1, padding='same',
                            activation='sigmoid')
        self.resample = UpSampling2D()
        self.BN = BatchNormalization()

    def call(self, X):
        X, skip_X = X
        x = self.normal(X)
        skip = self.down(skip_X)
        x = Add()([x, skip])
        x = self.learn(x)
        x = self.resample(x)
        f = Multiply()([x, skip_X])

        if self.bn:
            return self.BN(f)
        else:
            return f

    def get_config(self):
        config = super().get_config()
        config.update({
            "filters": self.filters,
            "bn": self.bn
        })
        return config

class SimpleBreastAIModel(nn.Module):
    def __init__(self):
        super(SimpleBreastAIModel, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.AdaptiveAvgPool2d((7, 7)),
            nn.Flatten(),
            nn.Linear(128 * 7 * 7, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 2)  # Binary classification
        )

    def forward(self, x):
        return self.features(x)


def is_ultralytics_yolo(obj) -> bool:
    try:
        return obj is not None and obj.__class__.__module__.startswith("ultralytics") and hasattr(obj, "predict")
    except Exception:
        return False


def extract_state_dict(loaded_obj):
    if isinstance(loaded_obj, dict):
        for key in ("state_dict", "model_state_dict", "model"):
            if key in loaded_obj and isinstance(loaded_obj[key], dict):
                return loaded_obj[key]
    return loaded_obj


def infer_num_classes_from_state_dict(state_dict):
    if not isinstance(state_dict, dict):
        return None

    preferred_keys = (
        "classifier.1.weight",
        "classifier.weight",
        "fc.weight",
        "head.fc.weight",
        "head.classifier.weight",
    )
    for key in preferred_keys:
        if key in state_dict:
            try:
                return int(state_dict[key].shape[0])
            except Exception:
                pass

    candidates = []
    for key, value in state_dict.items():
        try:
            if hasattr(value, "shape") and len(value.shape) == 2:
                out_features = int(value.shape[0])
                if 2 <= out_features <= 10:
                    candidates.append((out_features, key))
        except Exception:
            continue

    if candidates:
        for out_features, _ in candidates:
            if out_features == 3:
                return 3
        candidates.sort(key=lambda x: x[0])
        return candidates[0][0]

    return None


def build_alexnet_for_state_dict(state_dict, fallback_num_classes=2):
    num_classes = fallback_num_classes
    if isinstance(state_dict, dict):
        final_layer = state_dict.get("classifier.6.weight")
        if hasattr(final_layer, "shape") and len(final_layer.shape) > 0:
            num_classes = int(final_layer.shape[0])
        else:
            num_classes = infer_num_classes_from_state_dict(state_dict) or fallback_num_classes
    model = models.alexnet(weights=None)
    if hasattr(model, "classifier") and len(model.classifier) >= 7:
        in_features = model.classifier[6].in_features
        model.classifier[6] = nn.Linear(in_features, int(num_classes))
    return model, int(num_classes)


def build_efficientnet_b0_for_state_dict(state_dict, fallback_num_classes=2):
    num_classes = fallback_num_classes
    if isinstance(state_dict, dict):
        final_layer = state_dict.get("classifier.1.weight")
        if hasattr(final_layer, "shape") and len(final_layer.shape) > 0:
            num_classes = int(final_layer.shape[0])
        else:
            num_classes = infer_num_classes_from_state_dict(state_dict) or fallback_num_classes
    model = models.efficientnet_b0(weights=None)
    if hasattr(model, "classifier") and len(model.classifier) >= 2:
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, int(num_classes))
    return model, int(num_classes)


ULTRASOUND_CLASS_ORDER = [c.strip().lower() for c in os.environ.get("ULTRASOUND_CLASS_ORDER", "normal,benign,malignant").split(",") if c.strip()]
MASTER_HISTO_CLASS_LABELS = {
    0: "adenosis",
    1: "ductal_carcinoma",
    2: "fibroadenoma",
    3: "lobular_carcinoma",
    4: "mucinous_carcinoma",
    5: "papillary_carcinoma",
    6: "phyllodes_tumor",
    7: "tubular_adenoma",
}
MASTER_HISTO_DIAGNOSIS_BY_LABEL = {
    "adenosis": "benign",
    "ductal_carcinoma": "malignant",
    "fibroadenoma": "benign",
    "lobular_carcinoma": "malignant",
    "mucinous_carcinoma": "malignant",
    "papillary_carcinoma": "malignant",
    "phyllodes_tumor": "benign",
    "tubular_adenoma": "benign",
}

def normalize_label(label):
    if label is None:
        return ""
    if isinstance(label, str):
        return label.strip().lower()
    return str(label).strip().lower()

def class_id_from_label(label):
    label = normalize_label(label)
    if not label:
        return None
    try:
        return ULTRASOUND_CLASS_ORDER.index(label)
    except ValueError:
        return None


def resolve_model_name(model_names, idx):
    try:
        if isinstance(model_names, dict):
            return model_names.get(idx)
        if isinstance(model_names, (list, tuple)) and 0 <= idx < len(model_names):
            return model_names[idx]
    except Exception:
        return None


def get_engine_label_names(engine):
    try:
        names = getattr(engine, "names", None)
        if isinstance(names, dict):
            return [normalize_label(names[k]) for k in sorted(names.keys())]
        if isinstance(names, (list, tuple)):
            return [normalize_label(name) for name in names]
    except Exception:
        pass
    return []


def get_engine_num_classes(engine):
    try:
        names = get_engine_label_names(engine)
        if names:
            return len(names)
    except Exception:
        pass

    try:
        classifier = getattr(engine, "classifier", None)
        if isinstance(classifier, nn.Sequential) and len(classifier) > 0:
            for layer in reversed(classifier):
                out_features = getattr(layer, "out_features", None)
                if out_features is not None:
                    return int(out_features)
        out_features = getattr(classifier, "out_features", None)
        if out_features is not None:
            return int(out_features)
    except Exception:
        pass

    try:
        fc = getattr(engine, "fc", None)
        out_features = getattr(fc, "out_features", None)
        if out_features is not None:
            return int(out_features)
    except Exception:
        pass

    return None


def is_three_class_ultrasound_engine(engine):
    expected_labels = {"normal", "benign", "malignant"}
    names = set(get_engine_label_names(engine))
    if expected_labels.issubset(names):
        return True

    num_classes = get_engine_num_classes(engine)
    return num_classes == 3
    return None


def preprocess_master_histo_image(content: bytes) -> np.ndarray:
    """
    Apply the master model preprocessing path exactly as provided:
    load_img(path, target_size=(224, 224)) -> img_to_array -> expand_dims.
    """
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        image = tf.keras.utils.load_img(temp_path, target_size=(224, 224))
        img_array = tf.keras.utils.img_to_array(image)
        return np.expand_dims(img_array, axis=0)
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def to_probability_vector(raw_output) -> np.ndarray:
    """Convert model output into a stable 1D probability vector."""
    probs = np.array(raw_output, dtype=np.float32).squeeze()
    if probs.ndim == 0:
        scalar = float(probs)
        probs = np.array([1.0 - scalar, scalar], dtype=np.float32)
    if probs.ndim != 1:
        probs = probs.reshape(-1)

    if probs.size == 0:
        raise ValueError("Model returned an empty prediction vector")

    if np.any(probs < 0.0) or np.any(probs > 1.0) or not np.isclose(float(np.sum(probs)), 1.0, atol=1e-3):
        shifted = probs - np.max(probs)
        exp_scores = np.exp(shifted)
        total = np.sum(exp_scores)
        if total == 0:
            raise ValueError("Could not normalize prediction scores")
        probs = exp_scores / total

    return probs


def classify_master_pathology_group(class_id: int):
    """Derive benign vs malignant from the predicted subtype class."""
    result_label = MASTER_HISTO_CLASS_LABELS.get(class_id, "")
    return MASTER_HISTO_DIAGNOSIS_BY_LABEL.get(result_label, "unknown")


def summarize_master_histo_prediction(probabilities: np.ndarray):
    """Pick the top subtype first, then derive its pathology group."""
    probs = np.array(probabilities, dtype=np.float32).reshape(-1)
    if probs.size != len(MASTER_HISTO_CLASS_LABELS):
        raise ValueError(f"Expected {len(MASTER_HISTO_CLASS_LABELS)} master classes, got {probs.size}")

    class_id = int(np.argmax(probs))
    confidence = float(probs[class_id])
    result_label = MASTER_HISTO_CLASS_LABELS.get(class_id, f"unknown_{class_id}")
    pathology_group = classify_master_pathology_group(class_id)
    diagnosis_confidence = float(np.sum([
        probs[idx]
        for idx, label in MASTER_HISTO_CLASS_LABELS.items()
        if MASTER_HISTO_DIAGNOSIS_BY_LABEL.get(label) == pathology_group
    ]))
    return class_id, confidence, result_label, pathology_group, diagnosis_confidence

def resolve_yolo_task(yolo_model):
    task = getattr(yolo_model, "task", None)
    if task is None:
        task = getattr(getattr(yolo_model, "model", None), "args", {}).get("task")
    if task is None and hasattr(yolo_model, "model"):
        task = getattr(yolo_model.model, "task", None)
    return str(task).lower() if task else None


app = FastAPI(title="OncoDetect Pro - Neural Engine")

# CORS setup for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# This registry stores the actual loaded models (PyTorch and Keras)
engines: Dict[str, any] = {}

# Use an absolute models path (based on this file) so restarting from other CWDs still finds models
BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "models")
CONFIG_FILE = os.path.join(BASE_DIR, ".modelconfig")

print(f"[INIT] Using MODELS_DIR: {MODELS_DIR}")
print(f"[INIT] Using CONFIG_FILE: {CONFIG_FILE}")
print(f"[INIT] Workspace root: {BASE_DIR}")

def load_clinical_models():
    """
    Scans the models folder for alexnet.pth and yolov11.pth.
    Loads them into memory as operational inference engines.
    Models persist and are reloaded on each startup.
    """
    global engines
    
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
        print(f"[INIT] Created models directory at {MODELS_DIR}. Please place your .pth files here.")
        return

    files = [f for f in os.listdir(MODELS_DIR) if f.endswith(('.pth', '.pt', '.h5'))]
    
    if not files:
        print(f"[WARN] No model files found in {MODELS_DIR}")
        return
    
    print(f"\n{'='*60}")
    print(f"[STARTUP] Model Loading - Persistence Check")
    print(f"{'='*60}")
    print(f"[INFO] Found {len(files)} model file(s): {files}")
    
    for f in files:
        filename_base = os.path.splitext(f)[0].lower()
        supported_engine = (
            filename_base in ('alexnet', 'efficient_net', 'best_model', 'best', 'oncoscanai_master_model')
            or 'alex' in filename_base
            or 'efficient' in filename_base
            or 'yolo' in filename_base
            or 'yolov' in filename_base
            or 'oncoscan' in filename_base
            or 'master' in filename_base
        )
        if not supported_engine:
            print(f"[INFO] Skipping unsupported model file {f}")
            continue
        # Map filenames to the expected frontend keys ('alexnet', 'yolo', 'breast_ai_combined')
        if 'yolo' in filename_base:
            engine_key = 'yolo'
        elif 'alex' in filename_base:
            engine_key = 'alexnet'
        elif 'efficient' in filename_base:
            engine_key = 'efficient_net'
        elif filename_base == 'best_model':
            engine_key = 'best_model'
        elif filename_base == 'best':
            engine_key = 'best_seg'
        elif 'oncoscan_combined' in filename_base:
            engine_key = 'breast_ai_combined'  # Map original model to expected frontend key
        elif 'oncoscan' in filename_base or 'master' in filename_base:
            engine_key = 'master'
        else:
            engine_key = filename_base

        if engine_key in engines:
            print(f"[INFO] Skipping {f} because '{engine_key}' is already loaded")
            continue

        path = os.path.join(MODELS_DIR, f)
        path_ext = os.path.splitext(path)[1].lower()
        yolo_path = path
        if path_ext == ".pth":
            # Ultralytics YOLO expects .pt; prefer a sibling .pt if available
            candidate_pt = os.path.splitext(path)[0] + ".pt"
            if os.path.exists(candidate_pt):
                yolo_path = candidate_pt
            else:
                yolo_path = None



        try:
            # Handle .h5 files (Keras models)
            if f.endswith('.h5'):
                print(f"[DEBUG] Loading Keras model {f}...")
                try:
                    # Try loading without custom objects first
                    loaded = keras.models.load_model(path)
                    print(f"[DEBUG] Loaded {f} without custom objects, type: {type(loaded).__name__}")
                    engines[engine_key] = loaded
                    print(f"[OK] {engine_key.upper()} - Keras model loaded from {f}")
                except Exception as e1:
                    print(f"[WARN] Loading {f} without custom objects failed: {str(e1)}")
                    try:
                        custom_objects = {
                            'EncoderBlock': EncoderBlock,
                            'DecoderBlock': DecoderBlock,
                            'AttentionGate': AttentionGate,
                            'concat_func': concat_func,
                            'Dense': CustomDense,  # Handle quantization_config
                        }
                        loaded = keras.models.load_model(path, custom_objects=custom_objects)
                        print(f"[DEBUG] Loaded {f} with custom objects, type: {type(loaded).__name__}")
                        engines[engine_key] = loaded
                        print(f"[OK] {engine_key.upper()} - Keras model loaded from {f}")
                    except Exception as e2:
                        print(f"[ERROR] {engine_key.upper()} - Loading failed even with custom objects: {str(e2)}")
                        print(f"[WARN] Skipping {f} due to loading error")
            else:
                # Prefer Ultralytics YOLO loader for YOLO segmentation/classification files
                if engine_key in ('yolo', 'best_seg') or 'yolo' in filename_base or filename_base == 'best':
                    try:
                        from ultralytics import YOLO
                        if yolo_path is None:
                            print(f"[WARN] {engine_key.upper()} - {f} has .pth suffix; Ultralytics expects .pt. Rename to .pt or provide a .pt copy.")
                        else:
                            yolo_model = YOLO(yolo_path)
                            task = resolve_yolo_task(yolo_model)
                            resolved_key = engine_key

                            if task == 'classify' and engine_key == 'yolo':
                                resolved_key = 'yolo_cls'
                            elif task == 'segment' and engine_key == 'best_seg':
                                resolved_key = 'best_seg'

                            if resolved_key in engines:
                                print(f"[INFO] Skipping {f} because '{resolved_key}' is already loaded")
                            else:
                                engines[resolved_key] = yolo_model
                                task_label = task if task else 'unknown'
                                print(f"[OK] {resolved_key.upper()} - Ultralytics YOLO loaded from {os.path.basename(yolo_path)} (task={task_label})")
                            continue
                    except Exception as e:
                        print(f"[WARN] {engine_key.upper()} - Ultralytics YOLO load failed for {f}: {e}")

                # loading with torch.load for .pth/.pt files
                print(f"[DEBUG] Loading {f}...")
                loaded = torch.load(path, map_location='cpu', weights_only=False)
                print(f"[DEBUG] Loaded {f}, type: {type(loaded).__name__}")

                # Handle Ultralytics YOLO models FIRST
                if hasattr(loaded, '__class__') and 'YOLO' in loaded.__class__.__name__:
                    print(f"[DEBUG] Detected YOLO model in {f}")
                    if hasattr(loaded, 'eval'):
                        loaded.eval()
                    engines[engine_key] = loaded
                    print(f"[OK] {engine_key.upper()} - Ultralytics YOLOv11 loaded from {f}")
                # Additional check for YOLO models that might not have the class name check
                elif 'yolo' in engine_key and hasattr(loaded, 'predict'):
                    print(f"[DEBUG] Detected YOLO model via predict method in {f}")
                    engines[engine_key] = loaded
                    print(f"[OK] {engine_key.upper()} - YOLO model loaded from {f}")
                # Handle state dict classifier checkpoints
                elif isinstance(loaded, dict):
                    if 'alexnet' in engine_key:
                        try:
                            # Check if it's custom format with 'architecture', 'num_classes', 'state_dict'
                            if 'architecture' in loaded and 'num_classes' in loaded and 'state_dict' in loaded:
                                state_dict = loaded['state_dict']
                                num_classes = int(loaded['num_classes'])
                                model, inferred_num_classes = build_alexnet_for_state_dict(state_dict, fallback_num_classes=num_classes)
                                model.load_state_dict(state_dict)
                                model.eval()
                                engines[engine_key] = model
                                print(f"[OK] {engine_key.upper()} - Custom format, {inferred_num_classes} classes, from {f}")
                            else:
                                # Standard state dict
                                state_dict = extract_state_dict(loaded)
                                model, num_classes = build_alexnet_for_state_dict(state_dict)
                                model.load_state_dict(state_dict)
                                model.eval()
                                engines[engine_key] = model
                                print(f"[OK] {engine_key.upper()} - State dict reconstructed from {f} ({num_classes} classes)")
                        except RuntimeError as re:
                            print(f"[ERROR] {engine_key.upper()} - Architecture mismatch: {str(re)[:60]}")
                    elif engine_key in ('efficient_net', 'best_model'):
                        try:
                            state_dict = extract_state_dict(loaded)
                            num_classes = None
                            if isinstance(loaded, dict):
                                num_classes = loaded.get("num_classes")
                            if num_classes is None:
                                num_classes = infer_num_classes_from_state_dict(state_dict)
                            if num_classes is None:
                                num_classes = 2
                            print(f"[INFO] {engine_key.upper()} - inferred num_classes={num_classes}")

                            model_loaded = False

                            try:
                                model, inferred_num_classes = build_efficientnet_b0_for_state_dict(state_dict, fallback_num_classes=int(num_classes))
                                missing_keys, unexpected_keys = model.load_state_dict(state_dict, strict=False)
                                if len(unexpected_keys) == 0 and len(missing_keys) == 0:
                                    model.eval()
                                    engines[engine_key] = model
                                    print(f"[OK] {engine_key.upper()} - EFFICIENTNET_B0 loaded from {f} ({inferred_num_classes} classes)")
                                    model_loaded = True
                            except Exception as e:
                                print(f"[WARN] {engine_key.upper()} - EfficientNet-B0 direct load failed: {str(e)[:100]}")

                            if not model_loaded:
                                # Try ResNet50 as fallback
                                model = models.resnet50(weights=None, num_classes=int(num_classes))
                                missing_keys, unexpected_keys = model.load_state_dict(state_dict, strict=False)
                                if len(missing_keys) < 100:
                                    model.eval()
                                    engines[engine_key] = model
                                    print(f"[OK] {engine_key.upper()} - ResNet50 loaded (partial) from {f}, missing: {len(missing_keys)}, unexpected: {len(unexpected_keys)}")
                                    model_loaded = True

                            if not model_loaded:
                                print(f"[ERROR] {engine_key.upper()} - Unable to reconstruct model from {f}; no fallback will be used.")

                        except Exception as e:
                            print(f"[ERROR] {engine_key.upper()} - All loading attempts failed: {str(e)[:100]}")
                            print(f"[WARN] {engine_key.upper()} - Cannot reconstruct supported classifier checkpoint, skipping")
                    else:
                        print(f"[WARN] {engine_key.upper()} - Cannot reconstruct from state dict")
                elif isinstance(loaded, torch.nn.Module) or hasattr(loaded, 'forward'):
                    if hasattr(loaded, 'eval'):
                        loaded.eval()
                    engines[engine_key] = loaded
                    print(f"[OK] {engine_key.upper()} - Module loaded from {f}")
                else:
                    print(f"[WARN] {engine_key.upper()} - Unknown format: {type(loaded).__name__}")

        except Exception as e:
            print(f"[ERROR] {engine_key.upper()} - Loading failed: {str(e)[:80]}")

    
    print(f"[OK] {len(engines)} model(s) loaded and active: {list(engines.keys())}")
    print(f"{'='*60}\n")
    
    # Update config file with timestamp
    update_model_config()



def update_model_config():
    """Update the model config file with current status and timestamp."""
    try:
        config = {
            "models": {
                "alexnet": {
                    "file": "alexnet.pth",
                    "type": "alexnet_classifier",
                    "num_classes": 2,
                    "active": "alexnet" in engines,
                    "engine_key": "alexnet"
                },
                "efficient_net": {
                    "file": "efficient_net.pth",
                    "type": "efficientnet_b0",
                    "num_classes": 2,
                    "active": "efficient_net" in engines,
                    "engine_key": "efficient_net"
                },
                "yolo": {
                    "file": "yolov11.pth",
                    "type": "ultralytics",
                    "active": "yolo" in engines,
                    "engine_key": "yolo"
                }
            },
            "last_loaded": datetime.now().isoformat(),
            "persistence": "enabled",
            "active_count": len(engines),
            "models_loaded": True if len(engines) > 0 else False
        }

        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"[INFO] Model config saved: {len(engines)} active")
    except Exception as e:
        print(f"[WARN] Could not update config: {e}")

def save_model_state():
    """Save model state to disk for persistence across restarts."""
    try:
        state_file = os.path.join(BASE_DIR, ".modelstate")
        state = {
            "engines_loaded": list(engines.keys()),
            "timestamp": datetime.now().isoformat(),
            "model_files": [f for f in os.listdir(MODELS_DIR) if f.endswith(('.pth', '.pt'))] if os.path.exists(MODELS_DIR) else []
        }
        with open(state_file, 'w') as f:
            json.dump(state, f, indent=2)
        print(f"[INFO] Model state saved to {state_file}")
    except Exception as e:
        print(f"[WARN] Could not save model state: {e}")

def load_model_state():
    """Load model state from disk."""
    try:
        state_file = os.path.join(BASE_DIR, ".modelstate")
        if os.path.exists(state_file):
            with open(state_file, 'r') as f:
                state = json.load(f)
            print(f"[INFO] Loaded previous model state: {state.get('engines_loaded', [])}")
            return state
    except Exception as e:
        print(f"[WARN] Could not load model state: {e}")
    return None


def ensure_models_loaded():
    """Ensure models are loaded into `engines`. Safe to call repeatedly."""
    global engines
    if len(engines) == 0:
        print("[INIT] No engines loaded, attempting to load models now...")
        try:
            load_clinical_models()
        except Exception as e:
            print(f"[ERROR] ensure_models_loaded failed: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"[OK] Models already in memory: {list(engines.keys())}")


def get_histo_model_keys():
    ensure_models_loaded()
    return [key for key in ("alexnet", "efficient_net", "yolo", "master") if key in engines]


def get_ultrasound_model_keys():
    ensure_models_loaded()
    return [key for key in ("best_model", "best_seg") if key in engines]


@app.on_event("startup")
async def startup_event():
    global engines
    try:
        print(f"\n{'='*60}")
        print(f"[STARTUP] OncoDetect Pro Neural Engine")
        print(f"[STARTUP] Time: {datetime.now().isoformat()}")
        print(f"{'='*60}")

        # Load previous model state if available
        prev_state = load_model_state()
        if prev_state:
            print(f"[INFO] Previous state found: {prev_state.get('engines_loaded', [])} models were active")

        # Verify model files exist
        print(f"\n[CHECK] Verifying model files...")
        files_found = os.listdir(MODELS_DIR) if os.path.exists(MODELS_DIR) else []
        pth_files = [f for f in files_found if f.endswith(('.pth', '.pt'))]
        print(f"[CHECK] Model files in {MODELS_DIR}: {pth_files}")

        if not pth_files:
            print(f"[WARN] No model files found! Expected: alexnet.pth, yolov11.pth")

        # Load models with persistence check
        print(f"\n[LOAD] Loading persisted models...")
        ensure_models_loaded()

        # Verify models are active
        if len(engines) > 0:
            print(f"[OK] Startup complete - {len(engines)} model(s) loaded and active")
            print(f"[OK] Active models: {list(engines.keys())}")
            # Save state after successful loading
            save_model_state()
        else:
            print(f"[WARN] No models loaded during startup")

        print(f"{'='*60}\n")

    except Exception as e:
        print(f"[ERROR] Startup failed: {e}")
        import traceback
        traceback.print_exc()


@app.get("/models")
async def get_active_models():
    ensure_models_loaded()
    return {
        "active_models": list(engines.keys()),
        "histo_models": get_histo_model_keys(),
        "ultrasound_models": get_ultrasound_model_keys(),
    }

def run_inference_from_bytes(model_name: str, content: bytes):
    """Shared inference routine for API endpoints that already have the upload bytes."""
    ensure_models_loaded()
    target = model_name.lower()
    engine = engines.get(target)

    if not engine:
        raise HTTPException(
            status_code=404,
            detail=f"Neural engine '{target}' is not loaded. Ensure '{target}.pth' is in backend/models/"
        )

    try:
        # Handle Keras models
        if isinstance(engine, tf.keras.Model):
            if target == "master":
                input_array = preprocess_master_histo_image(content)
                predictions = engine.predict(input_array, verbose=0)
                probs = to_probability_vector(predictions[0])
                class_id, confidence, result_label, pathology_group, pathology_confidence = summarize_master_histo_prediction(probs)
                response = {
                    "subclass": result_label,
                    "subclass_prediction": result_label,
                    "result": result_label,
                    "confidence": confidence,
                    "class_id": class_id,
                    "pathology_group": pathology_group,
                    "pathology_confidence": pathology_confidence,
                    "diagnosis": pathology_group,
                    "diagnosis_prediction": pathology_group,
                    "insight": f"Master model predicted subclass {result_label} with {confidence:.1%} confidence and classified it as {pathology_group}"
                }
                return response
            else:
                from PIL import Image
                image = Image.open(io.BytesIO(content)).convert('RGB')
                img_array = tf.keras.preprocessing.image.img_to_array(image)
                img_array = tf.image.resize(img_array, (224, 224))
                img_array = np.expand_dims(img_array, axis=0)
                predictions = engine.predict(img_array, verbose=0)
                if predictions.shape[-1] == 2:
                    class_id = int(np.argmax(predictions[0]))
                    confidence = float(predictions[0][class_id])
                    result_label = ['benign', 'malignant'][class_id]
                else:
                    prob = float(tf.sigmoid(predictions[0][0]).numpy())
                    class_id = 1 if prob > 0.5 else 0
                    confidence = prob if class_id == 1 else 1 - prob
                    result_label = 'malignant' if class_id == 1 else 'benign'
            response = {
                "result": result_label,
                "confidence": confidence,
                "class_id": class_id,
                "insight": f"Master model predicted {result_label} with {confidence:.1%} confidence"
            }
            return response

        def run_ultralytics_inference(yolo_engine):
            from PIL import Image
            import base64

            image = Image.open(io.BytesIO(content)).convert('RGB')
            img_np = np.array(image)

            results = yolo_engine(img_np)
            if results is None or len(results) == 0:
                print("[WARN] YOLO engine returned no results")
                return None

            res = results[0]

            # Prepare default classification fallback
            result_label = 'normal'
            confidence = 0.0
            raw_class_id = None

            # Extract class + confidence from YOLO detections if available
            try:
                model_names = getattr(res, 'names', None)
                fallback_names = {0: 'normal', 1: 'benign', 2: 'malignant'}
                # Classification models expose res.probs
                if getattr(res, 'probs', None) is not None:
                    try:
                        top1 = int(res.probs.top1)
                        conf = float(res.probs.top1conf)
                        confidence = conf
                        raw_class_id = top1
                        name = resolve_model_name(model_names, top1)
                        result_label = name if name is not None else fallback_names.get(top1, f'class_{top1}')
                    except Exception as e:
                        print(f"[WARN] Could not extract class/confidence from YOLO probs: {e}")
                elif hasattr(res, 'boxes') and getattr(res.boxes, 'conf', None) is not None and getattr(res.boxes, 'cls', None) is not None:
                    # Convert conf and cls to numpy arrays where possible
                    try:
                        confs = res.boxes.conf.cpu().numpy()
                    except Exception:
                        confs = np.array(res.boxes.conf)
                    try:
                        cls_idxs = res.boxes.cls.cpu().numpy().astype(int)
                    except Exception:
                        cls_idxs = np.array(res.boxes.cls).astype(int)

                    if confs.size > 0:
                        top = int(np.argmax(confs))
                        confidence = float(confs[top])
                        raw_class_id = int(cls_idxs[top])
                        name = resolve_model_name(model_names, raw_class_id)
                        result_label = name if name is not None else fallback_names.get(raw_class_id, f'class_{raw_class_id}')
            except Exception as e:
                print(f"[WARN] Could not extract class/confidence from YOLO results: {e}")

            label_lower = normalize_label(result_label)
            class_id = class_id_from_label(label_lower)
            if class_id is None and raw_class_id is not None:
                class_id = int(raw_class_id)

            # Extract masks if present (only relevant for segmentation models)
            mask_base64 = None
            mask_pixel_count = None
            mask_area_mm2 = None

            try:
                if hasattr(res, 'masks') and getattr(res.masks, 'data', None) is not None:
                    masks_data = res.masks.data
                    try:
                        masks_np = masks_data.cpu().numpy()
                    except Exception:
                        masks_np = np.array(masks_data)

                    # Combine multiple masks into a single binary mask
                    if masks_np.ndim == 3:
                        combined = np.any(masks_np > 0.5, axis=0).astype(np.uint8)
                    elif masks_np.ndim == 2:
                        combined = (masks_np > 0.5).astype(np.uint8)
                    else:
                        combined = (masks_np > 0.5).astype(np.uint8)

                    mask_pixel_count = int(np.sum(combined))

                    try:
                        PIXEL_TO_MM = float(os.environ.get('PIXEL_TO_MM', '0.2'))
                    except Exception:
                        PIXEL_TO_MM = 0.2

                    mask_area_mm2 = float(mask_pixel_count * (PIXEL_TO_MM ** 2))

                    # Create RGBA overlay image (red overlay for mask regions)
                    h, w = combined.shape
                    overlay = np.zeros((h, w, 4), dtype=np.uint8)
                    overlay[combined == 1] = [255, 0, 0, 128]

                    overlay_img = Image.fromarray(overlay, mode='RGBA')
                    buf = io.BytesIO()
                    overlay_img.save(buf, format='PNG')
                    mask_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
                else:
                    # Only warn when this is expected to be a segmentation model
                    if getattr(res, 'probs', None) is None:
                        print("[WARN] YOLO results contain no masks")
            except Exception as e:
                print(f"[WARN] Mask extraction failed for YOLO inference: {e}")

            insights_local = {
                "benign": "Well-circumscribed margins with standard cellular distribution. Recommend follow-up in 6 months.",
                "malignant": "Analysis reveals high cellular atypia and irregular borders. Priority surgical consultation recommended.",
                "normal": "No abnormal structural deviations or oncological indicators detected in this sample."
            }

            response = {
                "class": result_label,
                "result": result_label,
                "confidence": float(confidence),
                "insight": insights_local.get(result_label.lower(), "Atypical findings detected. Clinical correlation required."),
                "engine": model_name.upper(),
                "timestamp": "Live Neural Inference"
            }

            if class_id is not None:
                response["class_id"] = int(class_id)

            if mask_base64 is not None:
                response["segmentation_mask"] = f"data:image/png;base64,{mask_base64}"
            if mask_pixel_count is not None:
                response["mask_pixel_count"] = int(mask_pixel_count)
            if mask_area_mm2 is not None:
                response["mask_area_mm2"] = float(mask_area_mm2)

            return response

        # Generic YOLO inference path
        if is_ultralytics_yolo(engine):
            yolo_response = run_ultralytics_inference(engine)
            if yolo_response is not None:
                return yolo_response

        # Check if this is a Keras model
        if hasattr(engine, 'predict') and not hasattr(engine, 'forward'):  # Keras model
            # Preprocess for Keras (numpy array)
            from PIL import Image
            image = Image.open(io.BytesIO(content)).convert('RGB')
            image = image.resize((224, 224))
            input_array = np.array(image) / 255.0  # Normalize to [0,1]
            input_array = np.expand_dims(input_array, axis=0)  # Add batch dimension

            # Keras model prediction
            output = engine.predict(input_array, verbose=0)
            print(f"[DEBUG] Keras output shape: {output.shape}")

            # Handle segmentation model output
            if len(output.shape) == 4:  # Segmentation mask output [batch, height, width, channels]
                mask = output[0]  # Remove batch dimension

                # Process segmentation mask for visualization
                import base64
                from PIL import Image

                # For binary segmentation, threshold the mask
                if mask.shape[-1] == 1:  # Single channel mask
                    binary_mask = (mask > 0.5).astype(np.uint8)
                    tumor_pixels = np.sum(binary_mask)
                    total_pixels = binary_mask.size

                    # Calculate tumor ratio for classification
                    tumor_ratio = tumor_pixels / total_pixels
                    confidence = min(tumor_ratio * 2, 1.0)  # Scale confidence

                    # Classify based on tumor presence and size
                    if tumor_ratio > 0.05:  # If more than 5% of image has tumor
                        result_label = "malignant"
                        confidence = max(confidence, 0.7)  # Minimum confidence for malignant
                    elif tumor_ratio < 0.01:  # Very low tumor ratio indicates normal
                        result_label = "normal"
                        confidence = max(1 - tumor_ratio, 0.8)  # High confidence for normal
                    else:
                        result_label = "benign"
                        confidence = max(1 - tumor_ratio, 0.6)  # Higher confidence for benign

                    # Create overlay mask for visualization (red overlay for tumor regions)
                    overlay_mask = np.zeros((*binary_mask.shape, 4), dtype=np.uint8)
                    overlay_mask[binary_mask == 1] = [255, 0, 0, 128]  # Red with transparency

                else:  # Multi-class segmentation (assuming 3 classes: background, benign, malignant)
                    # Take argmax across channels for each pixel
                    predicted_mask = np.argmax(mask, axis=-1)
                    unique_classes = np.unique(predicted_mask)

                    # Check for malignant class (assuming class 2 is malignant, 1 is benign, 0 is background)
                    malignant_pixels = np.sum(predicted_mask == 2)
                    benign_pixels = np.sum(predicted_mask == 1)
                    total_pixels = predicted_mask.size

                    malignant_ratio = malignant_pixels / total_pixels
                    benign_ratio = benign_pixels / total_pixels

                    # Determine primary classification
                    if malignant_ratio > benign_ratio and malignant_ratio > 0.02:
                        result_label = "malignant"
                        confidence = min(malignant_ratio * 3, 0.95)
                    elif benign_ratio > malignant_ratio and benign_ratio > 0.02:
                        result_label = "benign"
                        confidence = min(benign_ratio * 2, 0.9)
                    else:
                        result_label = "normal"
                        confidence = max(1 - (malignant_ratio + benign_ratio), 0.7)

                    # Create overlay mask for visualization
                    overlay_mask = np.zeros((*predicted_mask.shape, 4), dtype=np.uint8)
                    overlay_mask[predicted_mask == 1] = [0, 255, 0, 128]  # Green for benign
                    overlay_mask[predicted_mask == 2] = [255, 0, 0, 128]  # Red for malignant

                # Convert overlay mask to base64 for frontend visualization
                overlay_img = Image.fromarray(overlay_mask, mode='RGBA')
                buffer = io.BytesIO()
                overlay_img.save(buffer, format='PNG')
                mask_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            else:  # Classification model output
                # Assume binary classification for ultrasound
                if output.shape[1] == 2:  # [batch, 2]
                    probs = output[0]  # Remove batch dimension
                    predicted_idx = np.argmax(probs)
                    confidence = probs[predicted_idx]
                    class_names = {0: "benign", 1: "malignant"}
                    result_label = class_names.get(predicted_idx, f"unknown_{predicted_idx}")
                else:
                    # Single output, assume sigmoid for binary
                    prob_malignant = float(output[0][0])
                    confidence = max(prob_malignant, 1 - prob_malignant)
                    result_label = "malignant" if prob_malignant > 0.5 else "benign"

            print(f"[INFO] Keras Prediction: {result_label}, confidence={confidence:.4f}")

        else:
            # PyTorch model
            # Preprocess to 224x224 (Standard for AlexNet/YOLO)
            input_tensor = preprocess_medical_image(content, model_type=target)

            with torch.no_grad():
                output = engine(input_tensor)

            # YOLOv11 returns a list of Results objects
            if isinstance(output, list) and len(output) > 0:
                output = output[0]

            print(f"[DEBUG] Output type: {type(output)}, has probs: {hasattr(output, 'probs')}")

            # Handle YOLOv11 Results object (from Ultralytics)
            if hasattr(output, 'probs'):
                # Prefer using the model-provided names mapping when available
                model_names = getattr(output, 'names', None)

                # Raw probability tensor (may be per-class or per-detection depending on model)
                probs = output.probs.data

                print(f"[DEBUG] Model names: {model_names}")
                print(f"[DEBUG] Raw probs tensor shape: {tuple(probs.shape)}")

                # Build a safe class name mapping fallback (0=benign, 1=malignant)
                if model_names and len(model_names) >= 2:
                    class_names = model_names
                else:
                    class_names = {0: "benign", 1: "malignant"}

                # If probs is a per-class 1D tensor, use argmax
                try:
                    if probs.dim() == 1 or (probs.dim() == 2 and probs.size(0) == 1):
                        # Flatten to 1D if needed
                        probs_1d = probs.flatten()
                        predicted_idx = torch.argmax(probs_1d)
                        confidence = float(probs_1d[predicted_idx].item())
                        result_label = class_names.get(predicted_idx.item(), f"unknown_{predicted_idx.item()}")
                    else:
                        # Fallback: aggregate detections if available (boxes.cls)
                        if hasattr(output, 'boxes') and hasattr(output.boxes, 'cls'):
                            cls_tensor = output.boxes.cls
                            try:
                                cls_idxs = cls_tensor.cpu().numpy().astype(int)
                                from collections import Counter
                                if len(cls_idxs) > 0:
                                    most_common = Counter(cls_idxs).most_common(1)[0][0]
                                    result_label = class_names.get(int(most_common), f"unknown_{most_common}")
                                    # Heuristic confidence from detection confidences if available
                                    if hasattr(output.boxes, 'conf'):
                                        confs = output.boxes.conf.cpu().numpy()
                                        confidence = float(confs.mean()) if len(confs) > 0 else 0.0
                                    else:
                                        confidence = 0.5
                                else:
                                    result_label = "normal"
                                    confidence = 0.0
                            except Exception:
                                result_label = "normal"
                                confidence = 0.0
                        else:
                            # Last-resort: take first class index
                            predicted_idx = int(torch.argmax(probs.view(-1)).item())
                            result_label = class_names.get(predicted_idx, f"unknown_{predicted_idx}")
                            confidence = float(torch.max(probs).item())

                except Exception as e:
                    print(f"[WARN] YOLO probabilities handling failed: {e}")
                    result_label = "normal"
                    confidence = 0.0

                # Debug output
                try:
                    if isinstance(class_names, dict):
                        name0 = class_names.get(0, 'unknown')
                        name1 = class_names.get(1, 'unknown')
                    else:
                        name0 = class_names[0] if len(class_names) > 0 else 'unknown'
                        name1 = class_names[1] if len(class_names) > 1 else 'unknown'
                    print(f"[INFO] Prediction: class={result_label}, confidence={confidence:.4f}, mapping[0]={name0}, mapping[1]={name1}")
                except Exception:
                    print(f"[INFO] Prediction: class={result_label}, confidence={confidence}")

            elif isinstance(output, torch.Tensor):
                print(f"[DEBUG] Detected PyTorch Tensor output with shape {output.shape}")
                # Handle tensor outputs from AlexNet
                if output.dim() == 2:  # [batch, classes]
                    raw_logits = output[0]  # Remove batch dimension -> [classes]
                elif output.dim() == 4:  # [batch, classes, h, w]
                    output = output[0]  # Remove batch
                    raw_logits = output.mean(dim=[1, 2])  # Average over spatial dims -> [classes]
                elif output.dim() == 3:  # [classes, h, w]
                    raw_logits = output.mean(dim=[1, 2])  # Average over spatial dims -> [classes]
                else:
                    raw_logits = output.flatten()

                print(f"[DEBUG] Raw logits: {raw_logits}")

                # Now output should be 1D tensor of class scores
                probs = torch.nn.functional.softmax(raw_logits, dim=0)
                print(f"[DEBUG] Probabilities: {probs}")

                max_result = torch.max(probs, dim=0)
                # torch.max returns a named tuple with .values and .indices
                confidence = max_result.values if hasattr(max_result, 'values') else max_result[0]
                predicted_idx = max_result.indices if hasattr(max_result, 'indices') else max_result[1]

                num_classes = int(probs.numel())

                if num_classes == 2:
                    classes = ["Benign", "Malignant"]
                elif num_classes == 3:
                    classes = ["Normal", "Benign", "Malignant"]
                else:
                    classes = [f"Class_{i}" for i in range(num_classes)]

                result_label = classes[predicted_idx.item()] if predicted_idx.item() < len(classes) else f"Variant_{predicted_idx.item()}"
                print(f"[DEBUG] Predicted class {predicted_idx.item()}: {result_label} with confidence {float(confidence):.4f}")
            else:
                print(f"[DEBUG] Unknown output type: {type(output)}")
                raise ValueError(f"Unexpected model output type: {type(output)}")
        
        # Dynamic Clinical Insights based on real result
        insights = {
            "benign": "Well-circumscribed margins with standard cellular distribution. Recommend follow-up in 6 months.",
            "malignant": "Analysis reveals high cellular atypia and irregular borders. Priority surgical consultation recommended.",
            "normal": "No abnormal structural deviations or oncological indicators detected in this sample."
        }

        # Attempt to extract segmentation masks from Ultralytics Results (PyTorch) if available
        # and produce a standardized overlay + pixel counts + area in mm^2.
        try:
            # Case A: Ultralytics Results with .masks.data
            if 'output' in locals() and hasattr(output, 'masks') and getattr(output.masks, 'data', None) is not None:
                import base64
                from PIL import Image

                masks_data = output.masks.data
                try:
                    masks_np = masks_data.cpu().numpy()
                except Exception:
                    masks_np = np.array(masks_data)

                # masks_np expected shape: (n_masks, H, W) or (H, W)
                if masks_np.ndim == 3:
                    combined = np.any(masks_np > 0.5, axis=0).astype(np.uint8)
                elif masks_np.ndim == 2:
                    combined = (masks_np > 0.5).astype(np.uint8)
                else:
                    combined = (masks_np > 0.5).astype(np.uint8)

                mask_pixel_count = int(np.sum(combined))

                # Authoritative pixel-to-mm factor (default 0.2 mm per pixel) - overridable via env var
                try:
                    PIXEL_TO_MM = float(os.environ.get('PIXEL_TO_MM', '0.2'))
                except Exception:
                    PIXEL_TO_MM = 0.2

                mask_area_mm2 = float(mask_pixel_count * (PIXEL_TO_MM ** 2))

                # Create RGBA overlay (red with semi-transparency for masked regions)
                h, w = combined.shape
                overlay = np.zeros((h, w, 4), dtype=np.uint8)
                overlay[combined == 1] = [255, 0, 0, 128]

                overlay_img = Image.fromarray(overlay, mode='RGBA')
                buf = io.BytesIO()
                overlay_img.save(buf, format='PNG')
                mask_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

            # Case B: Raw torch.Tensor segmentation output producing [B,C,H,W], [C,H,W], or [H,W]
            elif 'output' in locals() and isinstance(output, torch.Tensor):
                import base64
                from PIL import Image

                tensor = output
                # Classification logits like [B, C] or [C] are not segmentation masks.
                if tensor.dim() <= 2:
                    tensor = None

                if tensor is None:
                    combined = None
                else:
                    # If batch dim present, remove it when batch==1
                    if tensor.dim() == 4 and tensor.size(0) == 1:
                        tensor = tensor[0]

                    # Now tensor can be [C,H,W] or [H,W]
                    if tensor.dim() == 3:
                        C, H, W = tensor.shape
                        if C == 1:
                            probs = torch.sigmoid(tensor[0])
                            combined = (probs.cpu().numpy() > 0.5).astype(np.uint8)
                        else:
                            # multiclass segmentation: take argmax across channel dim
                            preds = torch.argmax(tensor, dim=0).cpu().numpy()
                            combined = (preds > 0).astype(np.uint8)
                    elif tensor.dim() == 2:
                        combined = (tensor.cpu().numpy() > 0.5).astype(np.uint8)
                    else:
                        combined = None

                if combined is not None:
                    mask_pixel_count = int(np.sum(combined))

                    try:
                        PIXEL_TO_MM = float(os.environ.get('PIXEL_TO_MM', '0.2'))
                    except Exception:
                        PIXEL_TO_MM = 0.2

                    mask_area_mm2 = float(mask_pixel_count * (PIXEL_TO_MM ** 2))

                    h, w = combined.shape
                    overlay = np.zeros((h, w, 4), dtype=np.uint8)
                    overlay[combined == 1] = [255, 0, 0, 128]

                    overlay_img = Image.fromarray(overlay, mode='RGBA')
                    buf = io.BytesIO()
                    overlay_img.save(buf, format='PNG')
                    mask_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

        except Exception as e:
            print(f"[WARN] Mask extraction failed: {e}")

        # Prepare response with segmentation data if available
        label_lower = normalize_label(result_label)
        class_id = class_id_from_label(label_lower)
        if class_id is None and 'predicted_idx' in locals():
            try:
                class_id = int(predicted_idx.item())
            except Exception:
                try:
                    class_id = int(predicted_idx)
                except Exception:
                    class_id = None

        response = {
            "result": result_label,
            "confidence": float(confidence.item()) if hasattr(confidence, 'item') else float(confidence),
            "insight": insights.get(result_label.lower(), "Atypical findings detected. Clinical correlation required."),
            "engine": model_name.upper(),
            "timestamp": "Live Neural Inference"
        }

        if class_id is not None:
            response["class_id"] = int(class_id)

        # Add segmentation mask data for visualization and numeric outputs
        if 'mask_base64' in locals():
            response["segmentation_mask"] = f"data:image/png;base64,{mask_base64}"
            response["mask_type"] = "overlay"
        if 'mask_pixel_count' in locals():
            response["mask_pixel_count"] = int(mask_pixel_count)
        if 'mask_area_mm2' in locals():
            response["mask_area_mm2"] = float(mask_area_mm2)

        return response
            
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Inference Error for {model_name}: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Inference Pipeline Error: {error_msg}")


@app.post("/predict/histo/{model_name}")
async def run_inference(model_name: str, file: UploadFile = File(...)):
    """
    Route used by both VisionWorkbench and HistoAnalysis.
    Performs real inference using the local .pth files.
    """
    content = await file.read()
    return run_inference_from_bytes(model_name, content)



def pick_ultrasound_classifier():
    ensure_models_loaded()
    preferred_keys = ("best_model", "efficient_net", "yolo_cls", "best_seg", "yolo")

    for key in preferred_keys:
        engine = engines.get(key)
        if engine is not None and is_three_class_ultrasound_engine(engine):
            return key

    for key in preferred_keys:
        if key in engines:
            return key
    return None


def pick_ultrasound_segmenter():
    ensure_models_loaded()
    for key in ("best_seg", "yolo"):
        if key in engines:
            return key
    return None


@app.post("/predict/ultrasound/segment")
async def run_ultrasound_segment(file: UploadFile = File(...)):
    """
    Ultrasound segmentation endpoint.
    """
    model_key = pick_ultrasound_segmenter()
    if not model_key:
        raise HTTPException(status_code=404, detail="No ultrasound segmentation model loaded")
    response = await run_inference(model_key, file)
    response["segmentation_engine"] = model_key.upper()
    return response


@app.post("/predict/ultrasound/classify")
async def run_ultrasound_classify(file: UploadFile = File(...)):
    """
    Ultrasound classification endpoint (prefers YOLO classifier if available).
    """
    model_key = pick_ultrasound_classifier()
    if not model_key:
        raise HTTPException(status_code=404, detail="No ultrasound classification model loaded")
    response = await run_inference(model_key, file)
    response["classification_engine"] = model_key.upper()
    return response


@app.post("/predict/ultrasound/combined")
async def run_ultrasound_combined(file: UploadFile = File(...)):
    """
    Ultrasound combined endpoint using the dedicated classifier for
    result/confidence/insight and the dedicated segmenter for mask outputs.
    """
    classifier_key = pick_ultrasound_classifier()
    segmenter_key = pick_ultrasound_segmenter()

    if not classifier_key:
        raise HTTPException(status_code=404, detail="No ultrasound model loaded")
    if not segmenter_key:
        raise HTTPException(status_code=404, detail="No ultrasound segmentation model loaded")

    content = await file.read()
    classification_response = run_inference_from_bytes(classifier_key, content)
    segmentation_response = run_inference_from_bytes(segmenter_key, content)

    combined_response = dict(classification_response)
    combined_response["engine"] = f"{classifier_key.upper()} + {segmenter_key.upper()}"
    combined_response["classification_engine"] = classifier_key.upper()
    combined_response["segmentation_engine"] = segmenter_key.upper()

    for key in ("segmentation_mask", "mask_pixel_count", "mask_area_mm2", "mask_type"):
        if key in segmentation_response:
            combined_response[key] = segmentation_response[key]

    return combined_response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)

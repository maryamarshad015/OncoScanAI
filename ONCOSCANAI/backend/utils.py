
import io
import torch
from PIL import Image
from torchvision import transforms

def preprocess_medical_image(image_bytes: bytes, target_size=(224, 224), model_type='alexnet') -> torch.Tensor:
    """
    Standardizes clinical imaging data for neural inference.
    Applies appropriate preprocessing based on model type.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        if model_type.lower() == 'yolo':
            # YOLO models expect [0,1] range without ImageNet normalization
            preprocess = transforms.Compose([
                transforms.Resize(target_size),
                transforms.CenterCrop(target_size),
                transforms.ToTensor(),  # Converts to [0, 1] range
            ])
        else:
            # ImageNet normalization for AlexNet and other CNNs
            preprocess = transforms.Compose([
                transforms.Resize(target_size),
                transforms.CenterCrop(target_size),
                transforms.ToTensor(),  # Converts PIL Image to tensor in range [0, 1]
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],  # ImageNet mean
                    std=[0.229, 0.224, 0.225]    # ImageNet std
                )
            ])

        return preprocess(image).unsqueeze(0)  # Add batch dimension [1, 3, 224, 224]
    except Exception as e:
        raise ValueError(f"Preprocessing failure: {e}")

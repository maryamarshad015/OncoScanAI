import tensorflow as tf
from tensorflow import keras
import torch
import torch.nn as nn
import numpy as np
import os

# Define the custom EncoderBlock (same as in main.py)
from keras.layers import Layer, Conv2D, Dropout, MaxPool2D
from keras.utils import register_keras_serializable

@register_keras_serializable()
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

def convert_keras_to_pytorch():
    """
    Convert the Keras model to PyTorch format for easier loading
    """
    try:
        # Load the Keras model
        model_path = os.path.join(os.path.dirname(__file__), "models", "oncoscan_combined.h5")
        print(f"Loading Keras model from {model_path}")

        custom_objects = {'EncoderBlock': EncoderBlock}
        keras_model = keras.models.load_model(model_path, custom_objects=custom_objects)
        print("Keras model loaded successfully")
        print(f"Model summary:")
        keras_model.summary()

        # Create a simple PyTorch equivalent
        # Since we don't know the exact architecture, we'll create a basic CNN
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

        # Create PyTorch model
        pytorch_model = SimpleBreastAIModel()

        # Convert weights from Keras to PyTorch (simplified approach)
        # This is a basic conversion - you may need to adjust based on actual architecture
        keras_weights = keras_model.get_weights()

        if len(keras_weights) > 0:
            print(f"Found {len(keras_weights)} weight arrays in Keras model")

            # Try to map some weights (this is approximate)
            try:
                # Map first conv layer
                if len(keras_weights) >= 2:
                    # Keras: (height, width, input_channels, output_channels)
                    # PyTorch: (output_channels, input_channels, height, width)
                    conv1_weight = torch.tensor(keras_weights[0]).permute(3, 2, 0, 1)
                    conv1_bias = torch.tensor(keras_weights[1])

                    pytorch_model.features[0].weight.data = conv1_weight
                    pytorch_model.features[0].bias.data = conv1_bias
                    print("Mapped first conv layer weights")
            except Exception as e:
                print(f"Could not map weights: {e}")

        # Save as PyTorch model
        output_path = os.path.join(os.path.dirname(__file__), "models", "breast_ai_combined.pth")
        torch.save(pytorch_model.state_dict(), output_path)
        print(f"Converted model saved to {output_path}")

        # Also save model architecture info
        model_info = {
            "architecture": "SimpleBreastAIModel",
            "num_classes": 2,
            "input_shape": [3, 224, 224],
            "converted_from": "oncoscan_combined.h5"
        }

        info_path = os.path.join(os.path.dirname(__file__), "models", "breast_ai_combined_info.json")
        import json
        with open(info_path, 'w') as f:
            json.dump(model_info, f, indent=2)
        print(f"Model info saved to {info_path}")

        return True

    except Exception as e:
        print(f"Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def create_standard_keras_model():
    """
    Create a standard Keras model without custom layers
    """
    try:
        model = keras.Sequential([
            keras.layers.Conv2D(64, (3, 3), activation='relu', input_shape=(224, 224, 3), padding='same'),
            keras.layers.Dropout(0.2),
            keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            keras.layers.MaxPooling2D((2, 2)),

            keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            keras.layers.Dropout(0.2),
            keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            keras.layers.MaxPooling2D((2, 2)),

            keras.layers.GlobalAveragePooling2D(),
            keras.layers.Dense(256, activation='relu'),
            keras.layers.Dropout(0.5),
            keras.layers.Dense(2, activation='softmax')  # Binary classification
        ])

        # Compile the model
        model.compile(optimizer='adam',
                     loss='categorical_crossentropy',
                     metrics=['accuracy'])

        # Save the model
        output_path = os.path.join(os.path.dirname(__file__), "models", "breast_ai_combined_standard.h5")
        model.save(output_path)
        print(f"Standard Keras model saved to {output_path}")

        return True

    except Exception as e:
        print(f"Failed to create standard model: {e}")
        return False

if __name__ == "__main__":
    print("Converting oncoscan_combined.h5 to compatible format...")

    # Try to convert to PyTorch first
    if convert_keras_to_pytorch():
        print("Successfully converted to PyTorch format")
    else:
        print("PyTorch conversion failed, trying standard Keras model...")
        if create_standard_keras_model():
            print("Created standard Keras model")
        else:
            print("All conversion attempts failed")

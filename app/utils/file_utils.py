import base64
import os
import uuid
from io import BytesIO
from PIL import Image
from app.config import settings

def save_image_from_base64(image_data: str) -> Image.Image:
    """Convert base64 image data to PIL Image"""
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        image = Image.open(BytesIO(base64.b64decode(image_data)))
        return image.convert('RGBA')
    except Exception as e:
        raise ValueError(f"Invalid image data: {e}")

def generate_file_path(file_type: str = 'glb') -> str:
    """Generate unique file path"""
    filename = f"{uuid.uuid4()}.{file_type}"
    return os.path.join(settings.save_dir, filename)

def cleanup_old_files(max_files: int = 100):
    """Clean up old files to prevent disk space issues"""
    try:
        files = [os.path.join(settings.save_dir, f) for f in os.listdir(settings.save_dir)]
        files.sort(key=os.path.getctime)
        
        if len(files) > max_files:
            for file_to_remove in files[:-max_files]:
                os.remove(file_to_remove)
    except Exception as e:
        print(f"Error cleaning up files: {e}")
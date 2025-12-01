import os
from typing import Optional

class Settings:
    def __init__(self):
        self.host: str = os.getenv('HOST', '0.0.0.0')
        self.port: int = int(os.getenv('PORT', '8081'))
        self.device: str = os.getenv('DEVICE', 'cuda')

        # model paths
        self.model_path: str = os.getenv('MODEL_PATH', 'tencent/Hunyuan3D-2mini')
        self.subfolder: str = os.getenv('SUBFOLDER', 'hunyuan3d-dit-v2-mini-turbo')
        self.tex_model_path: str = os.getenv('TEX_MODEL_PATH', 'tencent/Hunyuan3D-2')
        
        # feature flags
        self.enable_t23d: bool = os.getenv('ENABLE_T23D', 'true').lower() == 'true'
        self.enable_flashvdm: bool = os.getenv('ENABLE_FLASHVDM', 'false').lower() == 'true'
        self.low_vram_mode: bool = os.getenv('LOW_VRAM_MODE', 'false').lower() == 'true'

        # paths
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.save_dir = os.path.join(self.base_dir, 'outputs')
        self.log_dir = os.path.join(self.base_dir, 'logs')
        self.template_dir = os.path.join(self.base_dir, 'templates')
        self.static_dir = os.path.join(self.base_dir, 'static')

        # create dir
        os.makedirs(self.save_dir, exist_ok=True)
        os.makedirs(self.log_dir, exist_ok=True)
        os.makedirs(self.template_dir, exist_ok=True)
        os.makedirs(self.static_dir, exist_ok=True)

settings = Settings()

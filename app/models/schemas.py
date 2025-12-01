from typing import Optional
from pydantic import BaseModel

class TextTo3DRequest(BaseModel):
    prompt: str
    seed: Optional[int] = 0
    octree_resolution: Optional[int] = 380
    num_inference_steps: Optional[int] = 50
    num_chunks: Optional[int] = 20000
    output_type: Optional[str] = 'trimesh'
    enable_texture: Optional[bool] = True

class ImageTo3DRequest(BaseModel):
    seed: Optional[int] = 0
    octree_resolution: Optional[int] = 380
    num_inference_steps: Optional[int] = 50
    num_chunks: Optional[int] = 20000
    output_type: Optional[str] = 'trimesh'
    enable_texture: Optional[bool] = True

class GenerationStatus(BaseModel):
    status: str
    message: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None

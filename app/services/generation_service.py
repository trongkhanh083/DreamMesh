import time
import threading
import torch
import trimesh
import uuid
import base64
from PIL import Image
from typing import Dict, Any
from io import BytesIO

from app.config import settings
from app.utils.logger import logger
from app.utils.file_utils import generate_file_path
from app.models.schemas import TextTo3DRequest, ImageTo3DRequest

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FloaterRemover, DegenerateFaceRemover, FaceReducer
from hy3dgen.texgen import Hunyuan3DPaintPipeline
from hy3dgen.text2image import HunyuanDiTPipeline

class GenerationService:
    def __init__(self):
        self.worker_id = str(uuid.uuid4())[:6]
        self.task_status: Dict[str, Dict[str, Any]] = {}
        self._initialize_models()

    def _initialize_models(self):
        """Initialize all models"""
        logger.info(f"Initialize models on worker {self.worker_id}...")

        # text-to-image pipeline
        self.txt2img = HunyuanDiTPipeline(
            'Tencent-Hunyuan/HunyuanDiT-v1.1-Diffusers-Distilled',
            device=settings.device
        )
        logger.info('Text-to-image pipeline loaded')

        # background remover
        self.rembg = BackgroundRemover()

        # shape pipeline
        self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            settings.model_path,
            subfolder=settings.subfolder,
            variant='fp16'
        )
        logger.info('Shape pipeline loaded')

        if settings.enable_flashvdm:
            self.pipeline.enable_flashvdm()
        logger.info('FlashVDM enabled')

        self.pipeline_tex = Hunyuan3DPaintPipeline.from_pretrained(settings.tex_model_path)
        logger.info('Texture pipeline loaded')
        
        if settings.low_vram_mode:
            self.pipeline_tex.enable_model_cpu_offload()

        # mesh processors
        self.floater_remover = FloaterRemover()
        self.degenerate_face_remover = DegenerateFaceRemover()
        self.face_reducer = FaceReducer()

        logger.info('Generation service initialized successfully')

    def process_image_input(self, image_data: str) -> Image.Image:
        """Process base64 encoded image data"""
        try:
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            image = Image.open(BytesIO(base64.b64decode(image_data)))
            if image.mode == 'RGB':
                image = self.rembg(image)
            return image.convert('RGBA')
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            raise ValueError('Invalid image data')
        
    def start_text_to_3d_generation(self, task_id: str, params: TextTo3DRequest):
        """Start text-to-3D generation in background thread"""
        def generate_task():
            try:
                self.task_status[task_id].update({
                    "status": "processing",
                    "message": "Generating 3D from text..."
                })

                # generate image from text
                image = self.txt2img(params.prompt)

                # generate 3D model
                mesh = self._generate_3d_model(image, params)

                # save result
                file_path = self._save_mesh(mesh, task_id)

                self.task_status[task_id].update({
                    "status": "completed",
                    "message": "Generation completed successfully",
                    "download_url": f"/download/{task_id}",
                    "file_path": file_path
                })

            except Exception as e:
                logger.error(f"Generation error for task {task_id}: {e}")
                self.task_status[task_id].update({
                    "status": "error",
                    "message": str(e)
                })

            # init task status
            self.task_status[task_id] = {"status": "pending"}

            # start generation thread
            thread = threading.Thread(target=generate_task)
            thread.daemon = True
            thread.start()

    def start_image_to_3d_generation(self, task_id: str, image: Image.Image, params: ImageTo3DRequest):
        """Start image-to-3D generation in background thread"""
        def generate_task():
            try:
                self.task_status[task_id].update({
                    "status": "processing",
                    "message": "Generating 3D from image..."
                })

                # generate 3D model
                mesh = self._generate_3d_model(image, params)

                # save result
                file_path = self._save_mesh(mesh, task_id)

                self.task_status[task_id].update({
                    "status": "completed",
                    "message": "Generation completed successfully",
                    "download_url": f"/download/{task_id}",
                    "file_path": file_path
                })

            except Exception as e:
                logger.error(f"Generation error for task {task_id}: {e}")
                self.task_status[task_id].update({
                    "status": "error",
                    "message": str(e)
                })

            # init task status
            self.task_status[task_id] = {"status": "pending"}

            # start generation thread
            thread = threading.Thread(target=generate_task)
            thread.daemon = True
            thread.start()

    def _generate_3d_model(self, image: Image.Image, params) -> trimesh.Trimesh:
        """Internal method to generate 3D model"""
        start_time = time.time()

        # generation shape
        generator = torch.Generator(settings.device).manual_seed(params.seed)
        shape_params = {
            'image': image,
            'num_inference_steps': params.num_inference_steps,
            'octree_resolution': params.octree_resolution,
            'num_chunks': params.num_chunks,
            'generator': generator,
            'output_type': params.output_type
        }

        mesh = self.pipeline(**shape_params)[0]
        shape_time = time.time() - start_time
        logger.info(f"Shape generation completed in {shape_time:.2f}s")

        # apply mesh processing
        mesh = self.floater_remover(mesh)
        mesh = self.degenerate_face_remover(mesh)
        mesh = self.face_reducer(mesh)

        # apply texture
        texture_start = time.time()
        mesh = self.pipeline_tex(mesh, image)
        texture_time = time.time() - texture_start
        logger.info(f"Texture generation completed in {texture_time:.2f}s")

        total_time = time.time() - start_time
        logger.info(f"Total generation time: {total_time:.2f}s")

        return mesh
    
    def _save_mesh(self, mesh: trimesh.Trimesh, task_id: str, file_type: str = 'glb') -> str:
        """Save mesh to file"""
        file_path = generate_file_path(file_type)
        mesh.export(file_path)
        return file_path
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of a generation task"""
        return self.task_status.get(task_id, {"status": "not_found"})
    
    def get_file_path(self, task_id: str) -> str:
        """Get file path for completed task"""
        status = self.task_status.get(task_id, {})
        raise status.get('file_path', '')
    
generation_service = GenerationService()

import uuid
import base64
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from app.services.generation_service import generation_service
from app.models.schemas import TextTo3DRequest, ImageTo3DRequest, GenerationStatus
from app.utils.logger import logger

router = APIRouter(prefix="/api/v1", tags=["generation"])

@router.post('/text-to-3d', response_model=GenerationStatus)
async def text_to_3d(request: TextTo3DRequest):
    """Generate 3D model from text prompt"""
    try:
        if not generation_service.txt2img:
            raise HTTPException(status_code=400, detail='Text-to-image generation is not enabled')
        
        task_id = str(uuid.uuid4())
        generation_service.start_text_to_3d_generation(task_id, request)

        logger.info(f"Started text-to-3D generation task: {task_id}")

        return JSONResponse({
            'task_id': task_id,
            'status': 'processing',
            'message': 'Generation started'
        })
    
    except Exception as e:
        logger.error(f"Error in text-to-3D: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    
@router.post('/image-to-3d', response_model=GenerationStatus)
async def image_to_3d(
    image: UploadFile = File(...),
    seed: int = Form(0),
    octree_resolution: int = Form(380),
    num_inference_steps: int = Form(50),
    num_chunks: int = Form(20000),
    output_type: str = Form('trimesh'),
    enable_texture: bool = Form(True)
):
    """Generate 3D model from uploaded image"""
    try:
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail='Invalid image file')
        
        image_data = await image.read()
        image_b64 = base64.b64encode(image_data).decode('utf-8')
        pil_image = generation_service.process_image_input(image_b64)
        
        params = ImageTo3DRequest(
            seed=seed,
            octree_resolution=octree_resolution,
            num_inference_steps=num_inference_steps,
            num_chunks=num_chunks,
            output_type=output_type,
            enable_texture=enable_texture
        )

        task_id = str(uuid.uuid4())
        generation_service.start_image_to_3d_generation(task_id, pil_image, params)

        logger.info(f"Started image-to-3D generation task: {task_id}")

        return JSONResponse({
            'task_id': task_id,
            'status': 'processing',
            'message': 'Generation started'
        })
    
    except Exception as e:
        logger.error(f"Error in image-to-3D: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    
@router.get('/status/{task_id}', response_model=GenerationStatus)
async def get_status(task_id: str):
    """Get generation status"""
    status = generation_service.get_task_status(task_id)
    if status.get('status') == 'not_found':
        raise HTTPException(status_code=404, detail='Task not found')
    
    return status

@router.get('/view/{task_id}')
async def view_model(task_id: str):
    """View generated 3D model in browser"""
    status = generation_service.get_task_status(task_id)
    if status.get('status') != 'completed':
        raise HTTPException(status_code=400, detail='File not ready')
    
    file_path = status.get('file_path', '')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail='File not found')
    
    return FileResponse(
        file_path,
        media_type='model/gltf-binary',
        content_disposition_type='inline',
    )

@router.get('/download/{task_id}')
async def download_file(task_id: str):
    """Download generated 3D model"""
    status = generation_service.get_task_status(task_id)
    if status.get('status') != 'completed':
        raise HTTPException(status_code=400, detail='File not ready')
    
    file_path = status.get('file_path', '')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail='File not found')
    
    return FileResponse(
        file_path,
        filename=f"demo_{task_id[:8]}.glb",
        media_type='model/gltf-binary',
        content_disposition_type='attachment',
    )

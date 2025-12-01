import time

import torch
from PIL import Image

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
from hy3dgen.texgen import Hunyuan3DPaintPipeline

image_path = 'assets/demo.png'
image = Image.open(image_path).convert("RGBA")
if image.mode == 'RGB':
    rembg = BackgroundRemover()
    image = rembg(image)

# Load shape pipeline
pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    'tencent/Hunyuan3D-2mini',
    subfolder='hunyuan3d-dit-v2-mini-turbo',
    variant='fp16'
)
# Load texture pipeline
pipeline_texgen = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2')

start_time = time.time()
print("Shape generation...")
mesh = pipeline(
    image=image,
    num_inference_steps=50,
    octree_resolution=380,
    num_chunks=20000,
    generator=torch.manual_seed(12345),
    output_type='trimesh'
)[0]
# mesh.export(f'demo_mini.glb')

print("Texture generation...")
mesh = pipeline_texgen(
    mesh, 
    image=image
)
mesh.export('demo_textured_mini.glb')
print("--- %s seconds ---" % (time.time() - start_time))

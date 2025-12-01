import time

import torch
from PIL import Image
import argparse

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.text2image import HunyuanDiTPipeline
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
from hy3dgen.texgen import Hunyuan3DPaintPipeline

def parse_args():
    parser = argparse.ArgumentParser(description="Generate 3D model from image or text")

    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument('--image-path', type=str, help='Path to input image file')
    input_group.add_argument('--enable_t23d', action='store_true', help='Enable text-to-image generation')

    parser.add_argument('--prompt', type=str, default='a fantasy dragon', help='Text prompt if --enable_t23d is used')
    parser.add_argument('--seed', type=int, default=0, help='Random seed for reproducible generation')
    parser.add_argument('--output', type=str, default='demo_textured.glb', help='Output filename of 3D model')
    parser.add_argument('--enable_flashvdm', action='store_true', help='Enable FlashVDM acceleration')
    parser.add_argument('--low_vram_mode', action='store_true', help='Enable low VRAM mode')
    parser.add_argument('--device', type=str, default='cuda', help='Device to run')

    return parser.parse_args()

def get_input_image(args):
    """Get input image either from text or from file"""
    if args.enable_t23d:
        # Load txt2img pipeline
        txt2img = HunyuanDiTPipeline(
            'Tencent-Hunyuan/HunyuanDiT-v1.1-Diffusers-Distilled', 
            device=args.device
        )
        image = txt2img(prompt=args.prompt)
        image.save(f"{args.seed}.png")
    else:
        # Load image directly
        image = Image.open(args.image_path).convert("RGBA")

    # Remove background
    if image.mode == 'RGB':
        rembg = BackgroundRemover()
        image = rembg(image)
    return image

def main():
    args = parse_args()

    if args.enable_t23d and not args.prompt:
        raise ValueError("--prompt is required when using --enable_t23d")
    
    image = get_input_image(args)

    # Load shape pipeline
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        'tencent/Hunyuan3D-2mini',
        subfolder='hunyuan3d-dit-v2-mini-turbo',
        variant='fp16'
    )

    if args.enable_flashvdm:
        pipeline.enable_flashvdm()

    # Load texture pipeline
    pipeline_texgen = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2')

    if args.low_vram_mode:
        pipeline_texgen.enable_model_cpu_offload()

    start_time = time.time()
    print("Shape generation...")
    mesh = pipeline(
        image=image,
        num_inference_steps=5 if args.enable_flashvdm else 50,
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
    mesh.export(args.output)

    if args.low_vram_mode and args.device == 'cuda':
        torch.cuda.empty_cache()

    print("--- Total time: %s seconds ---" % (time.time() - start_time))

if __name__ == "__main__":
    main()
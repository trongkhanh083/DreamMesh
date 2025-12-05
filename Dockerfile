# Base image
FROM pytorch/pytorch:2.9.1-cuda12.8-cudnn9-devel

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    TORCH_CUDA_ARCH_LIST="8.9" \
    CUDA_HOME=/usr/local/cuda

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ocl-icd-opencl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -U pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Install the hy3dgen package
RUN pip install -e .

# Verify CUDA is accessible before building custom extensions
RUN python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda)" && \
    which nvcc && nvcc --version

# Compile custom_rasterizer
RUN cd hy3dgen/texgen/custom_rasterizer && pip install . --no-build-isolation

# Compile differentiable_renderer
RUN cd hy3dgen/texgen/differentiable_renderer && pip install . --no-build-isolation

# Create necessary directories
RUN mkdir -p outputs logs static/css static/js templates

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Run the application
CMD ["python", "run.py"]
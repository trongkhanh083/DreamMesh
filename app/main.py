from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.endpoints import router as api_router
from app.utils.logger import logger

app = FastAPI(
    title='DreamMesh API',
    description='Generate 3D models from text or images',
    version='1.0.0',
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# mount static files
app.mount('/static', StaticFiles(directory=settings.static_dir), name='static')
templates = Jinja2Templates(directory=settings.template_dir)

# include API router
app.include_router(api_router)

@app.get('/', response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the main web interface"""
    return templates.TemplateResponse('index.html', {'request': request})

@app.get('/health', response_class=JSONResponse)
async def health_check():
    """Health check endpoint"""
    return {'status': 'API is running'}

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    """Serve favicon"""
    return FileResponse('static/icons8-3d-16.png')

@app.on_event('startup')
async def startup_event():
    """Initialize services on startup"""
    logger.info('DreamMesh API server starting up...')
    logger.info(f"Server running on {settings.host}:{settings.port}")

@app.on_event('shutdown')
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info('DreamMesh API server shutting down...')
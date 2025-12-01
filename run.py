import uvicorn
from app.config import settings
from app.utils.logger import logger

if __name__ == '__main__':
    logger.info(f"Starting Hunyuan3D-2 API server on {settings.host}:{settings.port}")
    uvicorn.run(
        'app.main:app',
        host=settings.host,
        port=settings.port,
        log_level='info',
        reload=True
    )
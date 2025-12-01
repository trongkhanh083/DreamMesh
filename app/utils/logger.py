import logging
import logging.handlers
import os
import sys
from app.config import settings

class StreamToLogger:
    def __init__(self, logger, log_level=logging.INFO):
        self.terminal = sys.stdout
        self.logger = logger
        self.log_level = log_level
        self.linebuf = ''

    def __getattr__(self, attr):
        return getattr(self.terminal, attr)

    def write(self, buf):
        temp_linebuf = self.linebuf + buf
        self.linebuf = ''
        for line in temp_linebuf.splitlines(True):
            if line[-1] == '\n':
                self.logger.log(self.log_level, line.rstrip())
            else:
                self.linebuf += line

    def flush(self):
        if self.linebuf != '':
            self.logger.log(self.log_level, self.linebuf.rstrip())
        self.linebuf = ''

def setup_logger(name: str, filename: str) -> logging.Logger:
    """Setup logger with file and stream handlers"""
    
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Root logger setup
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(name)s | %(message)s')

    # Get specific logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # File handler
    log_file = os.path.join(settings.log_dir, filename)
    file_handler = logging.handlers.TimedRotatingFileHandler(
        log_file, when='D', utc=True, encoding='UTF-8'
    )
    file_handler.setFormatter(formatter)
    
    # Avoid duplicate handlers
    if not logger.handlers:
        logger.addHandler(file_handler)

    return logger

# Create main application logger
logger = setup_logger("hunyuan3d_api", "api_server.log")
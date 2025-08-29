import logging
import logging.handlers
import os
from datetime import datetime
from pathlib import Path

def setup_file_logging(log_dir: str = "/mnt/01D7E79FEB78AE50/Projects/MyPdfWrapper/logs"):
    """
    Set up comprehensive file logging for the backend.
    
    Creates separate log files for:
    - General application logs (app.log)
    - Annotation processing logs (annotations.log) 
    - Coordinate processing logs (coordinates.log)
    - Error logs (errors.log)
    """
    
    # Create log directory
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)
    
    # Create timestamp for this session
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler (keep existing console output)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler for general application logs
    app_log_file = log_path / f"app_{timestamp}.log"
    app_handler = logging.handlers.RotatingFileHandler(
        app_log_file, maxBytes=10*1024*1024, backupCount=5
    )
    app_handler.setLevel(logging.DEBUG)
    app_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    app_handler.setFormatter(app_formatter)
    root_logger.addHandler(app_handler)
    
    # Specific logger for annotation processing
    annotation_logger = logging.getLogger('annotation_processing')
    annotation_log_file = log_path / f"annotations_{timestamp}.log"
    annotation_handler = logging.FileHandler(annotation_log_file)
    annotation_handler.setLevel(logging.DEBUG)
    annotation_formatter = logging.Formatter(
        '%(asctime)s - ANNOTATION - %(levelname)s - %(message)s'
    )
    annotation_handler.setFormatter(annotation_formatter)
    annotation_logger.addHandler(annotation_handler)
    annotation_logger.propagate = False  # Don't also log to root logger
    
    # Specific logger for coordinate processing
    coord_logger = logging.getLogger('coordinate_processing')
    coord_log_file = log_path / f"coordinates_{timestamp}.log"
    coord_handler = logging.FileHandler(coord_log_file)
    coord_handler.setLevel(logging.DEBUG)
    coord_formatter = logging.Formatter(
        '%(asctime)s - COORDINATES - %(levelname)s - %(message)s'
    )
    coord_handler.setFormatter(coord_formatter)
    coord_logger.addHandler(coord_handler)
    coord_logger.propagate = False
    
    # Error-only logger
    error_logger = logging.getLogger('errors')
    error_log_file = log_path / f"errors_{timestamp}.log"
    error_handler = logging.FileHandler(error_log_file)
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(
        '%(asctime)s - ERROR - %(name)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    error_handler.setFormatter(error_formatter)
    error_logger.addHandler(error_handler)
    error_logger.propagate = False
    
    # Log the setup completion
    logging.info(f"📁 File logging initialized:")
    logging.info(f"   General logs: {app_log_file}")
    logging.info(f"   Annotation logs: {annotation_log_file}")
    logging.info(f"   Coordinate logs: {coord_log_file}")
    logging.info(f"   Error logs: {error_log_file}")
    
    return {
        'app_log': str(app_log_file),
        'annotation_log': str(annotation_log_file),
        'coordinate_log': str(coord_log_file),
        'error_log': str(error_log_file)
    }

def get_annotation_logger():
    """Get the specialized annotation processing logger"""
    return logging.getLogger('annotation_processing')

def get_coordinate_logger():
    """Get the specialized coordinate processing logger"""
    return logging.getLogger('coordinate_processing')

def get_error_logger():
    """Get the specialized error logger"""
    return logging.getLogger('errors')

def log_annotation_data(message: str, data: dict = None):
    """Convenience function to log annotation data"""
    logger = get_annotation_logger()
    if data:
        logger.info(f"{message}: {data}")
    else:
        logger.info(message)

def log_coordinate_data(message: str, data: dict = None):
    """Convenience function to log coordinate data"""
    logger = get_coordinate_logger()
    if data:
        logger.info(f"{message}: {data}")
    else:
        logger.info(message)

def log_error(message: str, error: Exception = None, data: dict = None):
    """Convenience function to log errors with context"""
    logger = get_error_logger()
    error_msg = message
    if error:
        error_msg += f" - {str(error)}"
    if data:
        error_msg += f" - Context: {data}"
    logger.error(error_msg)
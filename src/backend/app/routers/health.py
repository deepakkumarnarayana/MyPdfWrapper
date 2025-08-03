from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings
import os

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Study PDF Reader API",
        "version": "1.0.0"
    }

@router.get("/health/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    
    # Check database connection
    try:
        await db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # Check storage directories using centralized settings
    pdf_storage_path = settings.actual_pdf_storage_path
    storage_status = "healthy" if os.path.exists(pdf_storage_path) else "missing storage directory"
    
    # Check environment variables using centralized settings
    claude_key = settings.claude_api_key.get_secret_value()
    claude_configured = claude_key and claude_key != "your_claude_api_key_here"
    env_status = "healthy" if claude_configured else "missing: CLAUDE_API_KEY"
    
    return {
        "status": "healthy" if all(status == "healthy" for status in [db_status, storage_status, env_status]) else "degraded",
        "service": "Study PDF Reader API",
        "version": "1.0.0",
        "checks": {
            "database": db_status,
            "storage": storage_status,
            "environment": env_status
        }
    }
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
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
    # Check database connection
    try:
        await db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # Check storage directories
    pdf_storage_path = os.getenv("PDF_STORAGE_PATH", "./storage/pdfs")
    storage_status = "healthy" if os.path.exists(pdf_storage_path) else "missing storage directory"
    
    # Check environment variables
    required_env_vars = ["CLAUDE_API_KEY"]
    missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
    env_status = "healthy" if not missing_env_vars else f"missing: {', '.join(missing_env_vars)}"
    
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
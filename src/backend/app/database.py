from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from development config
load_dotenv()  # Also load any local .env files
print("Environment variables loaded from .env files")
print(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")

# Get the project root directory (3 levels up from app/database.py)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()
print(f"Project root directory: {PROJECT_ROOT}")
STORAGE_DIR = PROJECT_ROOT / "data" / "storage"
DATABASE_DIR = STORAGE_DIR
print(f"Storage directory: {STORAGE_DIR}")
print(f"Database directory: {DATABASE_DIR}")
# Ensure storage directories exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

# Database configuration - use environment variable or default to new structure
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DATABASE_DIR}/database.db")
print(f"Database URL: {DATABASE_URL}")
# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create SessionLocal class
SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create Base class
Base = declarative_base()

# Dependency to get database session
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Create tables
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
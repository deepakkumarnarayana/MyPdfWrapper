from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Import modern settings configuration
from .config import get_settings

# Get settings instance
settings = get_settings()

# Use centralized configuration
DATABASE_URL = settings.actual_database_url

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
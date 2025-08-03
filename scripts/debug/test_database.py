#!/usr/bin/env python3
"""
Database Testing Script
=======================

This script tests database connectivity, table creation, and basic operations.

Usage:
    python scripts/debug/test_database.py
    ENV=staging python scripts/debug/test_database.py

Features:
    - Tests database connectivity
    - Verifies table structure
    - Tests basic CRUD operations
    - Shows database statistics
"""

import sys
import os
import asyncio
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

from app.config import get_settings
from app.database import engine, create_tables, get_db
from app.models import Base, User, PDF, Flashcard, StudySession
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import AsyncSession

async def test_database():
    print("="*60)
    print("DATABASE CONNECTIVITY TEST")
    print("="*60)
    
    settings = get_settings()
    
    print(f"Environment: {settings.environment}")
    print(f"Database URL: {settings.actual_database_url}")
    print(f"Database file path: {Path(settings.actual_database_url.replace('sqlite+aiosqlite:///', ''))}")
    print()
    
    # Test basic connectivity
    print("Testing Database Connectivity:")
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1 as test"))
            test_value = result.scalar()
            print(f"  ✅ Basic connectivity successful: {test_value}")
    except Exception as e:
        print(f"  ❌ Basic connectivity failed: {e}")
        return
    
    # Test table creation
    print("\nTesting Table Creation:")
    try:
        await create_tables()
        print("  ✅ Table creation completed successfully")
    except Exception as e:
        print(f"  ❌ Table creation failed: {e}")
        return
    
    # Inspect database schema
    print("\nInspecting Database Schema:")
    try:
        async with engine.begin() as conn:
            # Get table names
            result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [row[0] for row in result.fetchall()]
            
            print(f"  Tables found: {len(tables)}")
            for table in tables:
                print(f"    - {table}")
                
                # Get table info
                result = await conn.execute(text(f"PRAGMA table_info({table})"))
                columns = result.fetchall()
                print(f"      Columns: {len(columns)}")
                for col in columns:
                    print(f"        {col[1]} ({col[2]})")
    except Exception as e:
        print(f"  ❌ Schema inspection failed: {e}")
    
    # Test database session
    print("\nTesting Database Session:")
    try:
        async with AsyncSession(engine) as session:
            # Test basic query
            result = await session.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            
            result = await session.execute(text("SELECT COUNT(*) FROM pdfs"))
            pdf_count = result.scalar()
            
            result = await session.execute(text("SELECT COUNT(*) FROM flashcards"))
            flashcard_count = result.scalar()
            
            result = await session.execute(text("SELECT COUNT(*) FROM study_sessions"))
            session_count = result.scalar()
            
            print("  ✅ Database session successful")
            print(f"  Current data counts:")
            print(f"    Users: {user_count}")
            print(f"    PDFs: {pdf_count}")
            print(f"    Flashcards: {flashcard_count}")
            print(f"    Study Sessions: {session_count}")
            
    except Exception as e:
        print(f"  ❌ Database session failed: {e}")
    
    # Test database file stats
    print("\nDatabase File Statistics:")
    db_path = Path(settings.actual_database_url.replace('sqlite+aiosqlite:///', ''))
    if db_path.exists():
        stat = db_path.stat()
        print(f"  File size: {stat.st_size:,} bytes ({stat.st_size / 1024:.1f} KB)")
        print(f"  Last modified: {stat.st_mtime}")
        print(f"  Permissions: {oct(stat.st_mode)[-3:]}")
    else:
        print(f"  ❌ Database file not found: {db_path}")
    
    # Test with dependency injection (like FastAPI uses)
    print("\nTesting Dependency Injection:")
    try:
        async for session in get_db():
            result = await session.execute(text("SELECT 1"))
            test_value = result.scalar()
            print(f"  ✅ Dependency injection successful: {test_value}")
            break  # Only test first iteration
    except Exception as e:
        print(f"  ❌ Dependency injection failed: {e}")
    
    print("\n" + "="*60)

async def test_model_operations():
    """Test basic model operations"""
    print("TESTING MODEL OPERATIONS")
    print("="*60)
    
    try:
        async with AsyncSession(engine) as session:
            # Test User model
            from sqlalchemy import select
            
            print("Testing User model:")
            result = await session.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            if user:
                print(f"  Found user: {user.username}")
            else:
                print("  No users found in database")
            
            print("Testing PDF model:")
            result = await session.execute(select(PDF).limit(1))
            pdf = result.scalar_one_or_none()
            if pdf:
                print(f"  Found PDF: {pdf.title or pdf.filename}")
            else:
                print("  No PDFs found in database")
            
            print("Testing Flashcard model:")
            result = await session.execute(select(Flashcard).limit(1))
            flashcard = result.scalar_one_or_none()
            if flashcard:
                print(f"  Found flashcard: {flashcard.question[:50]}...")
            else:
                print("  No flashcards found in database")
                
            print("Testing StudySession model:")
            result = await session.execute(select(StudySession).limit(1))
            study_session = result.scalar_one_or_none()
            if study_session:
                print(f"  Found session: {study_session.id}")
            else:
                print("  No study sessions found in database")
            
    except Exception as e:
        print(f"❌ Model operations failed: {e}")
    
    print("="*60)

async def main():
    await test_database()
    await test_model_operations()

if __name__ == "__main__":
    asyncio.run(main())
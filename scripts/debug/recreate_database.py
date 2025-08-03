#!/usr/bin/env python3
"""
Database Recreation Script
==========================

This script recreates the database with proper ownership and permissions.
Use this if you're having permission issues with the existing database.

Usage:
    python scripts/debug/recreate_database.py

Features:
    - Backs up existing database (if any)
    - Creates new database with proper ownership
    - Recreates all tables
    - Verifies the new database works
"""

import sys
import os
import shutil
import asyncio
from pathlib import Path
from datetime import datetime

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

from app.config import get_settings
from app.database import create_tables, engine
from sqlalchemy import text

async def recreate_database():
    print("="*60)
    print("🗄️  DATABASE RECREATION")
    print("="*60)
    
    settings = get_settings()
    db_path = Path(settings.actual_database_url.replace('sqlite+aiosqlite:///', ''))
    
    print(f"Environment: {settings.environment}")
    print(f"Database path: {db_path}")
    print(f"Current user: {os.getenv('USER', 'unknown')}")
    print()
    
    # Check if database exists
    if db_path.exists():
        print("📋 Current database info:")
        stat = db_path.stat()
        print(f"  Size: {stat.st_size:,} bytes")
        print(f"  Owner UID: {stat.st_uid}")
        print(f"  Owner GID: {stat.st_gid}")
        print(f"  Permissions: {oct(stat.st_mode)[-3:]}")
        print()
        
        # Create backup
        backup_name = f"database_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        backup_path = db_path.parent / backup_name
        
        try:
            shutil.copy2(db_path, backup_path)
            print(f"✅ Backup created: {backup_path}")
        except Exception as e:
            print(f"⚠️  Warning: Could not create backup: {e}")
        
        # Remove old database
        try:
            db_path.unlink()
            print("🗑️  Old database removed")
        except Exception as e:
            print(f"❌ Could not remove old database: {e}")
            print("You may need to run: sudo rm {db_path}")
            return
    else:
        print("ℹ️  No existing database found")
    
    # Ensure storage directory exists with proper ownership
    storage_dir = db_path.parent
    storage_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Storage directory ready: {storage_dir}")
    
    # Create new database
    print("🔨 Creating new database...")
    try:
        await create_tables()
        print("✅ Database and tables created successfully")
    except Exception as e:
        print(f"❌ Failed to create database: {e}")
        return
    
    # Verify new database
    print("🔍 Verifying new database...")
    try:
        async with engine.begin() as conn:
            # Test basic connectivity
            result = await conn.execute(text("SELECT 1"))
            test_value = result.scalar()
            print(f"  ✅ Connectivity test: {test_value}")
            
            # List tables
            result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [row[0] for row in result.fetchall()]
            print(f"  ✅ Tables created: {len(tables)} ({', '.join(tables)})")
            
    except Exception as e:
        print(f"  ❌ Verification failed: {e}")
        return
    
    # Check new file ownership
    if db_path.exists():
        stat = db_path.stat()
        print("📋 New database info:")
        print(f"  Size: {stat.st_size:,} bytes")
        print(f"  Owner UID: {stat.st_uid}")
        print(f"  Owner GID: {stat.st_gid}")
        print(f"  Permissions: {oct(stat.st_mode)[-3:]}")
        print(f"  Accessible by current user: {os.access(db_path, os.R_OK | os.W_OK)}")
    
    print("\n✅ Database recreation completed successfully!")
    print("🎉 You should now be able to open the database in VS Code")

if __name__ == "__main__":
    asyncio.run(recreate_database())
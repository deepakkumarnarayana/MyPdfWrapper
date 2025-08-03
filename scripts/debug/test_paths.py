#!/usr/bin/env python3
"""
Path Resolution Testing Script
=============================

This script tests all path computations and storage configurations.
Useful for debugging storage issues and path inconsistencies.

Usage:
    python scripts/debug/test_paths.py
    ENV=staging python scripts/debug/test_paths.py

Features:
    - Tests all computed path fields
    - Checks directory existence
    - Validates storage configuration
    - Shows path calculations
"""

import sys
import os
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

from app.config import get_settings

def test_paths():
    print("="*60)
    print("PATH RESOLUTION TEST")
    print("="*60)
    
    settings = get_settings()
    
    print(f"Environment: {settings.environment}")
    print()
    
    # Test computed path fields
    print("Computed Paths:")
    print(f"  project_root: {settings.project_root}")
    print(f"    Type: {type(settings.project_root)}")
    print(f"    Exists: {settings.project_root.exists()}")
    print(f"    Is absolute: {settings.project_root.is_absolute()}")
    print()
    
    print(f"  storage_dir: {settings.storage_dir}")
    print(f"    Type: {type(settings.storage_dir)}")
    print(f"    Exists: {settings.storage_dir.exists()}")
    print(f"    Parent exists: {settings.storage_dir.parent.exists()}")
    print()
    
    print(f"  pdf_storage_dir: {settings.pdf_storage_dir}")
    print(f"    Type: {type(settings.pdf_storage_dir)}")
    print(f"    Exists: {settings.pdf_storage_dir.exists()}")
    print()
    
    # Test actual paths used
    print("Actual Paths Used:")
    print(f"  actual_pdf_storage_path: {settings.actual_pdf_storage_path}")
    print(f"    Type: {type(settings.actual_pdf_storage_path)}")
    print(f"    Exists: {Path(settings.actual_pdf_storage_path).exists()}")
    print(f"    Custom path: {bool(settings.pdf_storage_path)}")
    if settings.pdf_storage_path:
        print(f"    Custom value: {settings.pdf_storage_path}")
    print()
    
    print(f"  actual_database_url: {settings.actual_database_url}")
    print(f"    Type: {type(settings.actual_database_url)}")
    print(f"    Custom URL: {bool(settings.database_url)}")
    if settings.database_url:
        print(f"    Custom value: {settings.database_url}")
    print()
    
    # Test list computations
    print("Computed Lists:")
    print(f"  allowed_origins_list: {settings.allowed_origins_list}")
    print(f"    Type: {type(settings.allowed_origins_list)}")
    print(f"    Count: {len(settings.allowed_origins_list)}")
    print()
    
    print(f"  allowed_hosts_list: {settings.allowed_hosts_list}")
    print(f"    Type: {type(settings.allowed_hosts_list)}")
    print(f"    Count: {len(settings.allowed_hosts_list)}")
    print()
    
    # Test directory creation
    print("Directory Creation Test:")
    try:
        settings.setup_directories()
        print("  ✅ setup_directories() completed successfully")
        
        # Verify directories were created
        if settings.storage_dir.exists():
            print(f"  ✅ Storage directory exists: {settings.storage_dir}")
        else:
            print(f"  ❌ Storage directory missing: {settings.storage_dir}")
            
        if settings.pdf_storage_dir.exists():
            print(f"  ✅ PDF storage directory exists: {settings.pdf_storage_dir}")
        else:
            print(f"  ❌ PDF storage directory missing: {settings.pdf_storage_dir}")
            
    except Exception as e:
        print(f"  ❌ Error in setup_directories(): {e}")
    
    print("="*60)

if __name__ == "__main__":
    test_paths()
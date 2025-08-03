#!/usr/bin/env python3
"""
Service Configuration Validation Script
=======================================

This script validates that all services are using centralized settings correctly
and no os.getenv() calls remain in the codebase.

Usage:
    python scripts/debug/validate_services.py

Features:
    - Tests all service configurations
    - Validates centralized settings usage
    - Checks for remaining os.getenv() calls
    - Verifies service initialization
"""

import sys
import os
from pathlib import Path
import subprocess

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

def validate_services():
    print("="*70)
    print("SERVICE CONFIGURATION VALIDATION")
    print("="*70)
    
    # Test service imports and initialization
    print("Testing Service Imports:")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        print("  ✅ Settings import successful")
    except Exception as e:
        print(f"  ❌ Settings import failed: {e}")
        return
    
    try:
        from app.services.pdf_service import PDFService
        pdf_service = PDFService()
        print(f"  ✅ PDFService initialized: {pdf_service.storage_path}")
    except Exception as e:
        print(f"  ❌ PDFService failed: {e}")
    
    try:
        from app.services.flashcard_service import FlashcardService
        flashcard_service = FlashcardService()
        print("  ✅ FlashcardService initialized")
    except Exception as e:
        print(f"  ❌ FlashcardService failed: {e}")
    
    try:
        from app.services.storage_service import PDFStorageService
        storage_service = PDFStorageService()
        print(f"  ✅ PDFStorageService initialized: {storage_service.config.local_path}")
    except Exception as e:
        print(f"  ❌ PDFStorageService failed: {e}")
    
    print()
    
    # Check for remaining os.getenv() calls
    print("Checking for Remaining os.getenv() Calls:")
    backend_path = project_root / 'src' / 'backend'
    
    try:
        result = subprocess.run(
            ['grep', '-r', 'os.getenv', str(backend_path), '--include=*.py', '--exclude-dir=venv'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            config_lines = [line for line in lines if 'config.py' in line]
            other_lines = [line for line in lines if 'config.py' not in line]
            
            print(f"  Found {len(lines)} total os.getenv() calls")
            print(f"  In config.py (expected): {len(config_lines)}")
            print(f"  In other files (should be 0): {len(other_lines)}")
            
            if other_lines:
                print("  ❌ Unexpected os.getenv() calls found:")
                for line in other_lines:
                    print(f"    {line}")
            else:
                print("  ✅ No unexpected os.getenv() calls found")
        else:
            print("  ✅ No os.getenv() calls found (grep returned non-zero)")
            
    except Exception as e:
        print(f"  ⚠️  Could not check for os.getenv() calls: {e}")
    
    print()
    
    # Test router imports
    print("Testing Router Imports:")
    
    routers = ['system', 'health', 'ai_providers']
    for router_name in routers:
        try:
            module = __import__(f'app.routers.{router_name}', fromlist=[router_name])
            print(f"  ✅ {router_name} router imported successfully")
        except Exception as e:
            print(f"  ❌ {router_name} router failed: {e}")
    
    print()
    
    # Test configuration consistency
    print("Testing Configuration Consistency:")
    
    # Check if all environments have consistent settings structure
    env_files = [
        '.env.development',
        '.env.staging', 
        '.env.production'
    ]
    
    base_keys = set()
    for env_file in env_files:
        env_path = project_root / env_file
        if env_path.exists():
            content = env_path.read_text()
            keys = set()
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key = line.split('=')[0].strip()
                    keys.add(key)
            
            if not base_keys:
                base_keys = keys
            
            missing = base_keys - keys
            extra = keys - base_keys
            
            print(f"  {env_file}:")
            print(f"    Keys: {len(keys)}")
            if missing:
                print(f"    Missing: {missing}")
            if extra:
                print(f"    Extra: {extra}")
            if not missing and not extra:
                print(f"    ✅ Consistent with other environments")
        else:
            print(f"  ❌ {env_file}: File not found")
    
    print("="*70)

if __name__ == "__main__":
    validate_services()
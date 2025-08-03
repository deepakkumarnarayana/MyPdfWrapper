#!/usr/bin/env python3
"""
Environment Loading Debug Script
================================

This script helps debug environment file loading issues and Pydantic Settings configuration.

Usage:
    python scripts/debug/debug_env_loading.py
    ENV=staging python scripts/debug/debug_env_loading.py
    ENV=production python scripts/debug/debug_env_loading.py

Features:
    - Shows which environment files exist
    - Displays file loading order
    - Shows actual values loaded
    - Helps troubleshoot configuration issues
"""

import os
import sys
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

def debug_env_loading():
    print("="*70)
    print("ENVIRONMENT LOADING DEBUG")
    print("="*70)
    
    print(f"Current working directory: {os.getcwd()}")
    print(f"Project root: {project_root}")
    print(f"ENV variable: {os.getenv('ENV', 'not-set')}")
    print()
    
    # Check file paths
    env_name = os.getenv('ENV', 'development')
    general_env = project_root / ".env"
    specific_env = project_root / f".env.{env_name}"
    
    print("Environment Files:")
    print(f"  General .env: {general_env}")
    print(f"    Exists: {general_env.exists()}")
    if general_env.exists():
        print(f"    Size: {general_env.stat().st_size} bytes")
    
    print(f"  Specific .env.{env_name}: {specific_env}")
    print(f"    Exists: {specific_env.exists()}")
    if specific_env.exists():
        print(f"    Size: {specific_env.stat().st_size} bytes")
    print()
    
    # Show loading order
    print("Pydantic Loading Order (later files override earlier):")
    print(f"  1. {general_env} (general settings)")
    print(f"  2. {specific_env} (environment-specific overrides)")
    print()
    
    # Show file contents
    if general_env.exists():
        print("General .env file contents (first 200 chars):")
        content = general_env.read_text()[:200]
        print(f"  {content.replace(chr(10), chr(10) + '  ')}")
        print("  ...")
        print()
    
    if specific_env.exists():
        print(f"Environment-specific .env.{env_name} contents (first 300 chars):")
        content = specific_env.read_text()[:300]
        print(f"  {content.replace(chr(10), chr(10) + '  ')}")
        print("  ...")
        print()
    
    # Test Settings loading
    print("="*70)
    print("TESTING SETTINGS LOADING")
    print("="*70)
    
    from app.config import Settings
    settings = Settings()
    
    print("Key Settings Values:")
    print(f"  environment: {settings.environment}")
    print(f"  app_name: {settings.app_name}")
    print(f"  debug: {settings.debug}")
    print(f"  log_level: {settings.log_level}")
    print(f"  api_port: {settings.api_port}")
    print(f"  enable_hsts: {settings.enable_hsts}")
    print(f"  allowed_origins: {settings.allowed_origins}")
    print()
    
    # Check for common issues
    print("Troubleshooting:")
    if settings.environment != env_name:
        print(f"  ⚠️  WARNING: Expected environment '{env_name}' but loaded '{settings.environment}'")
        print(f"      This might indicate the environment-specific file isn't being loaded properly.")
    else:
        print(f"  ✅ Environment correctly loaded: {settings.environment}")
    
    if not specific_env.exists():
        print(f"  ⚠️  WARNING: Environment file .env.{env_name} doesn't exist")
        print(f"      Create it or use an existing environment (development, staging, production)")
    
    print("="*70)

if __name__ == "__main__":
    debug_env_loading()
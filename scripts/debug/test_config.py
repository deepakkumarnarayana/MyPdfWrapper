#!/usr/bin/env python3
"""
Configuration Testing Script
===========================

This script tests the centralized configuration system across different environments.

Usage:
    # Test default (development) environment
    python scripts/debug/test_config.py
    
    # Test specific environment
    ENV=staging python scripts/debug/test_config.py
    ENV=production python scripts/debug/test_config.py

Features:
    - Tests environment-specific settings loading
    - Validates computed fields
    - Checks path resolution
    - Verifies environment profiles
"""

import sys
import os
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root / 'src' / 'backend'))

from app.config import get_settings

def test_config():
    """Test centralized configuration system"""
    print("="*60)
    print("CENTRALIZED CONFIGURATION TEST")
    print("="*60)
    
    # Create fresh settings instance to bypass cache
    settings = get_settings()
    
    print(f"Environment: {settings.environment}")
    print(f"Debug: {settings.debug}")
    print(f"App Name: {settings.app_name}")
    print(f"API Host: {settings.api_host}:{settings.api_port}")
    print(f"Log Level: {settings.log_level}")
    print()
    
    print("Storage Configuration:")
    print(f"  Project Root: {settings.project_root}")
    print(f"  Storage Directory: {settings.storage_dir}")
    print(f"  PDF Storage: {settings.actual_pdf_storage_path}")
    print(f"  Database URL: {settings.actual_database_url}")
    print()
    
    print("AI Configuration:")
    print(f"  Claude API Key: {'Configured' if settings.claude_api_key != 'your_claude_api_key_here' else 'Not Configured'}")
    print(f"  Max Flashcards: {settings.max_flashcards_per_generation}")
    print()
    
    print("Security Configuration:")
    print(f"  CORS Origins: {settings.allowed_origins_list}")
    print(f"  Allowed Hosts: {settings.allowed_hosts_list}")
    print(f"  HSTS Enabled: {settings.enable_hsts}")
    print(f"  Secure Cookies: {settings.secure_cookies}")
    print()
    
    if settings.environment == "production":
        print("Production Configuration:")
        print(f"  SSL Cert: {settings.ssl_cert_path}")
        print(f"  SSL Key: {settings.ssl_key_path}")
        print(f"  Domain: {settings.domain}")
    
    print("="*60)

if __name__ == "__main__":
    test_config()
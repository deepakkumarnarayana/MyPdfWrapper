#!/usr/bin/env python3
"""
Setup script for Study PDF Reader Backend

This script sets up the Python virtual environment and installs dependencies.
"""

import os
import sys
import subprocess
import venv
from pathlib import Path

def run_command(command, cwd=None, shell=True):
    """Run a command and handle errors."""
    try:
        result = subprocess.run(
            command, 
            shell=shell, 
            check=True, 
            cwd=cwd,
            capture_output=True,
            text=True
        )
        print(f"✅ {' '.join(command) if isinstance(command, list) else command}")
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running command: {' '.join(command) if isinstance(command, list) else command}")
        print(f"   Error: {e.stderr}")
        return None

def create_virtual_environment():
    """Create a Python virtual environment."""
    backend_dir = Path(__file__).parent
    venv_dir = backend_dir / "venv"
    
    if venv_dir.exists():
        print("📁 Virtual environment already exists")
        return venv_dir
    
    print("🔧 Creating virtual environment...")
    venv.create(venv_dir, with_pip=True)
    print(f"✅ Virtual environment created at {venv_dir}")
    return venv_dir

def get_pip_command(venv_dir):
    """Get the pip command for the virtual environment."""
    if sys.platform == "win32":
        return str(venv_dir / "Scripts" / "pip")
    else:
        return str(venv_dir / "bin" / "pip")

def install_dependencies(venv_dir):
    """Install Python dependencies in the virtual environment."""
    backend_dir = Path(__file__).parent
    requirements_file = backend_dir / "requirements.txt"
    
    if not requirements_file.exists():
        print("❌ requirements.txt not found")
        return False
    
    pip_cmd = get_pip_command(venv_dir)
    
    print("📦 Upgrading pip...")
    if not run_command(f"{pip_cmd} install --upgrade pip"):
        return False
    
    print("📦 Installing dependencies...")
    if not run_command(f"{pip_cmd} install -r {requirements_file}"):
        return False
    
    return True

def main():
    """Main setup function."""
    print("🚀 Setting up Study PDF Reader Backend")
    print("=" * 50)
    
    # Check Python version
    if sys.version_info < (3, 9):
        print("❌ Python 3.9 or higher is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version.split()[0]} detected")
    
    # Create virtual environment
    venv_dir = create_virtual_environment()
    if not venv_dir:
        print("❌ Failed to create virtual environment")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies(venv_dir):
        print("❌ Failed to install dependencies")
        sys.exit(1)
    
    print("\n🎉 Backend setup complete!")
    print("\nTo activate the virtual environment:")
    
    if sys.platform == "win32":
        print(f"   venv\\Scripts\\activate")
    else:
        print(f"   source venv/bin/activate")
    
    print("\nTo start the development server:")
    print("   uvicorn main:app --reload")

if __name__ == "__main__":
    main()
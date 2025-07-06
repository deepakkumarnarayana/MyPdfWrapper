#!/bin/bash
# Activation script for Study PDF Reader Backend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found. Please run setup first:"
    echo "   python setup.py"
    exit 1
fi

echo "🔧 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

echo "✅ Virtual environment activated!"
echo "📍 Current directory: $(pwd)"
echo "🐍 Python: $(which python)"
echo "📦 Pip: $(which pip)"

echo ""
echo "Available commands:"
echo "  uvicorn main:app --reload    # Start development server"
echo "  pytest                       # Run tests"
echo "  ruff check .                 # Lint code"
echo "  black .                      # Format code"
echo "  deactivate                   # Exit virtual environment"

# Keep the shell active
exec "$SHELL"
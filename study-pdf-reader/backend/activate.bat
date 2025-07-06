@echo off
REM Activation script for Study PDF Reader Backend (Windows)

set SCRIPT_DIR=%~dp0
set VENV_DIR=%SCRIPT_DIR%venv

if not exist "%VENV_DIR%" (
    echo ❌ Virtual environment not found. Please run setup first:
    echo    python setup.py
    exit /b 1
)

echo 🔧 Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

echo ✅ Virtual environment activated!
echo 📍 Current directory: %CD%
echo 🐍 Python: %~dp0venv\Scripts\python.exe
echo 📦 Pip: %~dp0venv\Scripts\pip.exe

echo.
echo Available commands:
echo   uvicorn main:app --reload    # Start development server
echo   pytest                       # Run tests
echo   ruff check .                 # Lint code
echo   black .                      # Format code
echo   deactivate                   # Exit virtual environment

REM Keep the command prompt open
cmd /k
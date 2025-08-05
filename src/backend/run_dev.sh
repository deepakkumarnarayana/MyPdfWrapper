#!/bin/bash
#
# Development Runner for the Backend Service
#
# This script provides a consistent way to run the backend server locally.
# It loads the required environment configuration files before starting Uvicorn.
# This ensures that the local development environment behaves just like the
# containerized production environment.
#
# Usage: From the 'src/backend' directory, run: ./run_dev.sh
#

# Exit immediately if a command exits with a non-zero status.
set -e

# Get the script's directory to reliably navigate to the project root.
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_ROOT="$SCRIPT_DIR/../../"

# Change to the project root to source the environment files.
cd "$PROJECT_ROOT"

# Load the environment variables from the config files.
# The 'set -a' command exports all variables defined from this point on,
# making them available to the Uvicorn process.
echo "▶️ Loading configuration from config/environments/..."
set -a
source ./config/environments/.env.development
source ./config/environments/.env.backend
set +a
echo "✅ Configuration loaded."

# Change back to the backend directory to run the server.
cd "$SCRIPT_DIR"

echo "🚀 Starting Uvicorn server with auto-reload..."
echo "   Visit http://localhost:8000"
echo "   Press CTRL+C to stop."

# Execute the Uvicorn server.
# The 'exec' command replaces the shell process with the Uvicorn process,
# which is a good practice for process management.
exec uvicorn main:app --reload --host 0.0.0.0

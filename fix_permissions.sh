#!/bin/bash
#
# Permission Fix Script
# ====================
# This script fixes ownership issues with the data directory and database files.
# Run this script to resolve VS Code database access issues.
#
# Usage: bash fix_permissions.sh
#

echo "🔧 Fixing data directory permissions..."

# Get current user
CURRENT_USER=$(whoami)
echo "Current user: $CURRENT_USER"

# Check if data directory exists
DATA_DIR="/mnt/01D7E79FEB78AE50/Projects/MyPdfWrapper/data"
if [ ! -d "$DATA_DIR" ]; then
    echo "❌ Data directory not found: $DATA_DIR"
    exit 1
fi

echo "📁 Data directory found: $DATA_DIR"

# Show current ownership
echo "📋 Current ownership:"
ls -la "$DATA_DIR"

# Fix ownership (this will require sudo)
echo "🔧 Attempting to fix ownership..."
echo "Note: This may require your password for sudo access"

# Change ownership recursively
sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR"

if [ $? -eq 0 ]; then
    echo "✅ Ownership fixed successfully!"
    echo "📋 New ownership:"
    ls -la "$DATA_DIR"
    ls -la "$DATA_DIR/storage/"
else
    echo "❌ Failed to fix ownership. You may need to run this manually:"
    echo "sudo chown -R $CURRENT_USER:$CURRENT_USER $DATA_DIR"
fi

echo "🏁 Done!"
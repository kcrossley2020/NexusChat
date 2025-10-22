#!/bin/bash
# Restore Videxa logo assets from backup/source

echo "Restoring Videxa logo assets..."

# Check if temp-logos directory exists
if [ -d "temp-logos" ]; then
    echo "✓ Found temp-logos directory with source files"

    # Copy Videxa logos to assets
    cp temp-logos/logo.svg client/public/assets/
    cp temp-logos/favicon-16x16.png client/public/assets/
    cp temp-logos/favicon-32x32.png client/public/assets/
    cp temp-logos/apple-touch-icon-180x180.png client/public/assets/
    cp temp-logos/icon-192x192.png client/public/assets/
    cp temp-logos/maskable-icon.png client/public/assets/

    echo "✓ All Videxa logos restored"
else
    echo "✗ Error: temp-logos directory not found!"
    echo "  Please regenerate logos using: cd temp-logos && python create_videxa_logos.py"
    exit 1
fi

echo ""
echo "Logo restoration complete!"
echo "Verify with: git status"

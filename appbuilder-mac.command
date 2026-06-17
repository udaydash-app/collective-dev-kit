#!/bin/bash
# Global Market POS - macOS App Builder
# Double-click this file in Finder, or run:  bash appbuilder-mac.command
set -e

cd "$(dirname "$0")"

echo "============================================"
echo "  Global Market POS - macOS App Builder"
echo "============================================"

# 1. Clean previous artifacts
echo "[1/5] Cleaning previous build artifacts..."
rm -rf dist release

# 2. Install deps if missing
echo "[2/5] Checking node_modules..."
if [ ! -d node_modules ]; then
  npm install --legacy-peer-deps
fi

# 3. Build env
echo "[3/5] Setting build environment..."
export BUILD_TARGET=electron
# Disable code-signing so unsigned builds don't fail the build step.
export CSC_IDENTITY_AUTO_DISCOVERY=false

# 4. Vite build
echo "[4/5] Building frontend..."
npx vite build

# 5. Package mac (dmg + zip for arm64 + x64)
echo "[5/5] Packaging macOS app (unsigned)..."
npx electron-builder --mac --arm64 --x64

# 6. Strip Apple quarantine attributes from every produced artifact so
#    Gatekeeper does not block the .app / .dmg / .zip on first launch.
echo "Stripping macOS quarantine attributes from release artifacts..."
if [ -d release ]; then
  find release -type d -name "*.app" -print -exec xattr -cr {} \; || true
  find release -type f \( -name "*.dmg" -o -name "*.zip" \) -print -exec xattr -cr {} \; || true
  xattr -cr release || true
fi

echo ""
echo "============================================"
echo "  Build Complete!"
echo "============================================"
echo "Output: ./release"
ls -1 release 2>/dev/null || echo "No release folder found."
echo ""
echo "IMPORTANT - install on a fresh Mac:"
echo "  After copying the .app to /Applications, run once in Terminal:"
echo "    sudo xattr -cr \"/Applications/Global Market POS.app\""
echo "  This removes the 'app is damaged' / 'unidentified developer' block."
echo ""
#!/bin/bash
# =====================================================
#  Global Market POS - Full Release Script (macOS)
# =====================================================
#  - Pulls latest code from git
#  - Bumps version in package.json (patch by default)
#  - Installs dependencies
#  - Builds frontend (Vite)
#  - Packages Windows + macOS apps (unsigned)
#  - Strips macOS quarantine (bypass verification)
#  - Commits + tags + pushes the new version
#
#  Usage:
#    bash release.command              # auto-bump patch (1.1.45 -> 1.1.46)
#    bash release.command 1.2.0        # set explicit version
# =====================================================

set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  Global Market POS - Release Builder"
echo "============================================"

# -------- 1. Pull latest code --------
echo ""
echo "[1/7] Pulling latest code from git..."
if [ -d .git ]; then
  git fetch --all
  # Auto-commit any local uncommitted changes so the rebase can proceed
  if [ -n "$(git status --porcelain)" ]; then
    echo "Uncommitted changes detected - auto-committing before pull..."
    git add -A
    git commit -m "chore: auto-commit local changes before release" || echo "Nothing to commit"
  fi
  git pull --rebase || { echo "git pull failed - resolve conflicts and retry"; exit 1; }
else
  echo "WARNING: not a git repo - skipping pull"
fi

# -------- 2. Bump version in package.json --------
echo ""
echo "[2/7] Updating version in package.json..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

if [ -n "$1" ]; then
  NEW_VERSION="$1"
  echo "Using provided version: $NEW_VERSION"
else
  NEW_VERSION=$(node -e "const v='$CURRENT_VERSION'.split('.'); v[2]=parseInt(v[2])+1; console.log(v.join('.'))")
  echo "Auto-bumped version: $NEW_VERSION"
fi

node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.version='$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');
console.log('package.json updated -> $NEW_VERSION');
"

# -------- 3. Clean previous build artifacts --------
echo ""
echo "[3/7] Cleaning previous build artifacts..."
rm -rf dist release

# -------- 4. Install dependencies --------
echo ""
echo "[4/7] Installing dependencies..."
if [ ! -d node_modules ]; then
  npm install
else
  npm install --no-audit --no-fund
fi

# -------- 5. Build frontend --------
echo ""
echo "[5/7] Building frontend (Vite)..."
export BUILD_TARGET=electron
npx vite build

# -------- 6. Package desktop apps (Win + Mac) --------
echo ""
echo "[6/7] Packaging Windows + macOS apps (unsigned)..."

# Workaround: electron-builder scans optional native dependencies listed in
# package-lock.json, even when npm skipped those platform folders for this OS.
node scripts/create-electron-builder-optional-stubs.mjs

export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --mac --win --arm64 --x64

echo ""
echo "Stripping macOS quarantine attributes from built artifacts..."
if [ -d release ]; then
  find release -name "*.app" -exec xattr -cr {} \; 2>/dev/null || true
  find release -name "*.dmg" -exec xattr -cr {} \; 2>/dev/null || true
  find release -name "*.zip" -exec xattr -cr {} \; 2>/dev/null || true
fi

# -------- 7. Commit + tag + push --------
echo ""
echo "[7/7] Committing version bump and tagging release..."
if [ -d .git ]; then
  git add package.json
  git commit -m "chore: release v$NEW_VERSION" || echo "Nothing to commit"
  git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION" || echo "Tag already exists"
  git push origin HEAD || echo "WARNING: git push failed"
  git push origin "v$NEW_VERSION" || echo "WARNING: tag push failed"
fi

echo ""
echo "============================================"
echo "  Release v$NEW_VERSION built successfully"
echo "============================================"
echo ""
echo "Output files in: ./release/"
ls -la release/ 2>/dev/null | grep -E "\.(dmg|zip|exe)$" || true
echo ""
echo "If macOS blocks the installed app, run:"
echo "  sudo xattr -cr \"/Applications/Global Market POS.app\""
echo ""
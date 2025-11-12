# Deploy Offline Update - PowerShell Commands

## Overview
This guide provides the exact PowerShell commands to sync your changes to GitHub and build the updated Windows EXE with enhanced offline capabilities.

## Prerequisites
- Git installed on your system
- Node.js 18+ installed
- GitHub repository configured
- Write access to the repository

## Step-by-Step Deployment

### 1. Check Current Status
```powershell
# Navigate to your project directory
cd "C:\path\to\your\project"

# Check current branch and status
git status
git branch
```

### 2. Pull Latest Changes from GitHub
```powershell
# Fetch all changes from remote
git fetch origin

# Pull latest changes from main branch (or your default branch)
git pull origin main
```

### 3. Stage All New Changes
```powershell
# Add all modified and new files
git add .

# Or add specific files:
git add src/lib/cacheData.ts
git add src/hooks/useOfflineSync.ts
git add src/components/OfflineCacheManager.tsx
git add src/pages/admin/Settings.tsx
git add src/App.tsx
git add OFFLINE_SETUP.md
git add DEPLOY_UPDATE.md
```

### 4. Commit Changes
```powershell
# Commit with descriptive message
git commit -m "Enhanced offline capabilities: comprehensive data caching and auto-sync

- Expanded cacheData.ts to cache products, variants, stores, categories, customers, POS users, and combo offers
- Added cache staleness checking (24-hour expiration)
- Created OfflineCacheManager component for cache status and manual refresh
- Updated useOfflineSync to auto-refresh stale cache
- Enhanced App.tsx initialization for first-time setup and cache management
- Added cache management UI in Settings page
- Created comprehensive OFFLINE_SETUP.md documentation"
```

### 5. Push to GitHub
```powershell
# Push to main branch (or your default branch)
git push origin main

# If you're on a different branch:
# git push origin your-branch-name
```

### 6. Verify Push Success
```powershell
# Check remote status
git remote -v
git log --oneline -n 5
```

## Building the Windows EXE

### 1. Install/Update Dependencies
```powershell
# Install all dependencies
npm install

# Or if using Bun:
# bun install
```

### 2. Build Web Application
```powershell
# Build the web app (required before Electron build)
npm run build
```

### 3. Build Windows EXE
```powershell
# Build Electron app for Windows
npm run electron:build
```

### 4. Locate Output Files
```powershell
# The built files will be in:
# ./release/

# List all built files
dir release
```

The output will include:
- `Global Market Setup X.X.X.exe` - Installer version
- `Global Market X.X.X.exe` - Portable version

### 5. Test the Built EXE
```powershell
# Run the portable version to test
./release/"Global Market X.X.X.exe"
```

## Testing Offline Functionality

### Test Checklist
1. **Online First Launch**
   ```powershell
   # Launch app with internet connected
   # Watch console for "Initial data cache completed"
   ```

2. **Verify Cache**
   - Login as admin
   - Go to Settings
   - Check "Offline Data Cache" shows recent timestamp

3. **Test Offline**
   - Disconnect internet
   - Restart app
   - Login with POS PIN
   - Complete a test transaction
   - Check offline indicator shows pending transaction

4. **Test Sync**
   - Reconnect internet
   - Wait 30 seconds or click "Sync Now"
   - Verify transaction appears in admin panel
   - Check offline indicator shows 0 pending

## Alternative: Using GitHub Desktop

If you prefer a GUI instead of command line:

1. Open GitHub Desktop
2. Select your repository
3. Review changes in the Changes tab
4. Write commit message in bottom-left
5. Click "Commit to main"
6. Click "Push origin" button

Then continue with the build steps above.

## Troubleshooting

### Git Push Fails (Authentication)
```powershell
# Configure Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# For GitHub, you may need a Personal Access Token
# Generate one at: https://github.com/settings/tokens
# Use the token as password when prompted
```

### Build Fails
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install

# Clear build cache
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force release

# Try building again
npm run build
npm run electron:build
```

### Electron Build Issues
```powershell
# Install electron-builder globally
npm install -g electron-builder

# Clear electron cache
Remove-Item -Recurse -Force "$env:APPDATA\electron-builder"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder"

# Rebuild
npm run electron:build
```

## Quick Commands Summary

```powershell
# Complete update and build process
cd "C:\path\to\your\project"
git status
git pull origin main
git add .
git commit -m "Your commit message"
git push origin main
npm install
npm run build
npm run electron:build

# Test the app
./release/"Global Market X.X.X.exe"
```

## Distribution

### Option 1: Direct Distribution
- Copy the `.exe` files from `release/` folder
- Share with end users
- Users can run portable version or install with setup

### Option 2: GitHub Releases
```powershell
# Create a new release on GitHub
# Upload the .exe files as release assets
# Users can download from GitHub Releases page
```

### Option 3: Auto-Update
- The built app includes electron-updater
- Configure GitHub releases for automatic updates
- Users will be prompted to update when new version is available

## Post-Deployment

1. **Document the update**
   - Update version number in `package.json`
   - Add release notes
   - Update CHANGELOG.md

2. **Notify users**
   - Announce the offline capability
   - Share OFFLINE_SETUP.md guide
   - Provide training on cache management

3. **Monitor**
   - Watch for sync issues
   - Check cache performance
   - Gather user feedback

## Support

For issues or questions:
- Check OFFLINE_SETUP.md for troubleshooting
- Review console logs for errors
- Check IndexedDB in DevTools
- Verify network connectivity

# Auto-Update Setup Guide

## Overview
The Windows app now supports automatic updates! Users will be notified when updates are available and can install them with one click.

## How It Works
1. **On App Startup**: Checks for updates automatically after 3 seconds
2. **Manual Check**: Users can check for updates anytime
3. **Download**: When update is available, user clicks "Download"
4. **Install**: After download, user clicks "Restart Now" to install

## Setup Instructions

### 1. Connect to GitHub
1. In Lovable, click the GitHub button (top right)
2. Click "Connect to GitHub"
3. Authorize and create a repository
4. Note your GitHub username and repository name

### 2. Update electron-builder.json
Open `electron-builder.json` and update:
```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "YOUR_REPO_NAME"
}
```

### 3. Create a GitHub Release
After making changes:

```bash
# Build the app locally
npm run build
npm run electron:build

# Create a git tag
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Action will automatically:
- Build the Windows installer
- Create a GitHub release
- Upload the installer and update manifest

### 4. Future Updates
For each new version:

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Push the new tag
git push origin --tags
```

The GitHub Action automatically builds and publishes the release!

## How Users Update

### Automatic (Recommended)
- App checks for updates on startup
- User sees a dialog: "Update Available"
- Click "Download" → Click "Restart Now"
- Done! ✅

### Manual Check
- Add a "Check for Updates" menu item in your app
- Call: `window.electron.checkForUpdates()`

## Important Notes

### Code Signing (Optional but Recommended)
Windows may show warnings for unsigned apps. To remove warnings:

1. Get a code signing certificate
2. Add to electron-builder.json:
```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "your-password"
}
```

### First Installation
Users must manually install v1.0.0. After that, all updates are automatic!

### Update Server
Updates are served from GitHub Releases for free. No additional hosting needed!

## Testing Updates

1. Build and install v1.0.0 on your Windows machine
2. Make changes and create v1.0.1
3. Open the installed app
4. Wait 3 seconds or manually check for updates
5. You should see "Update Available" dialog!

## Troubleshooting

### "No updates available" but new version exists
- Check GitHub releases are public
- Verify electron-builder.json has correct owner/repo
- Check app version in package.json is lower than release version

### Download fails
- Check internet connection
- Verify GitHub token permissions
- Check if latest.yml exists in GitHub release

### Manual update check not working
Make sure to expose the IPC handler in preload.cjs:
```javascript
contextBridge.exposeInMainWorld('electron', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
});
```

## Cost
GitHub Releases = **FREE** ✅
No additional hosting or CDN costs!

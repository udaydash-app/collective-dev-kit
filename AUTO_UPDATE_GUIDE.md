# Auto-Update Setup Guide

## Overview

The auto-updater is now properly configured with enhanced logging and error handling. This guide explains how to set up GitHub releases so that installed apps can automatically update.

## How Auto-Update Works

1. **On App Startup**: The app checks for updates 5 seconds after launch (production only)
2. **Manual Check**: Users can click "Check for Updates" button in the app
3. **Update Detection**: The app compares the current version with the latest GitHub release
4. **Download**: If an update is available, users can choose to download it
5. **Installation**: After download, users can restart the app to install the update

## Current Configuration

- **Repository**: `udaydash-app/collective-dev-kit`
- **Current Version**: `1.1.10` (from package.json)
- **Auto-download**: Disabled (users must confirm download)
- **Auto-install on quit**: Enabled (installs when app closes)

## Setting Up GitHub Releases for Auto-Update

### Step 1: Build Your Application

```bash
# Build the application
npm run electron:build
```

This creates installers in the `release/` directory.

### Step 2: Create a GitHub Release

1. Go to your GitHub repository: `https://github.com/udaydash-app/collective-dev-kit`
2. Click on "Releases" (right sidebar)
3. Click "Create a new release"
4. **Tag version**: Enter version from package.json (e.g., `v1.1.10`)
   - ⚠️ IMPORTANT: Tag must match package.json version with 'v' prefix
5. **Release title**: `Version 1.1.10` (or whatever version)
6. **Description**: Add release notes (what's new, bug fixes, etc.)
7. **Attach files**: Upload the installers from `release/` folder:
   - For Windows: 
     - `Global Market POS-1.1.10-x64.exe` (installer)
     - `Global Market POS-1.1.10-ia32.exe` (32-bit installer)
     - `Global Market POS-1.1.10-Portable.exe` (portable)
   - For macOS:
     - `Global Market POS-1.1.10-arm64.dmg` (Apple Silicon)
     - `Global Market POS-1.1.10-x64.dmg` (Intel Mac)
     - Corresponding `.zip` files

8. Click "Publish release"

### Step 3: Update Version for Next Release

After publishing a release, update version in `package.json`:

```json
{
  "version": "1.1.11"  // Increment version
}
```

### Step 4: Verify Auto-Update Works

1. Install the app from the release (older version if testing)
2. Launch the app
3. Check console logs (if running from terminal) or wait for update dialog
4. App should detect the newer version and offer to update

## Important Notes

### Version Format

- Package.json: `"version": "1.1.10"`
- Git tag: `v1.1.10` (must have 'v' prefix)
- Release title: Can be anything, but `Version 1.1.10` is recommended

### Release Artifacts

The auto-updater looks for specific file patterns:
- Windows NSIS: `*.exe`
- Windows Portable: `*-Portable.exe`
- macOS DMG: `*.dmg`
- macOS ZIP: `*.zip`

Make sure your release includes the appropriate files for your target platforms.

### Private Repository

If your repository is private:
1. Set the `GH_TOKEN` environment variable with a GitHub Personal Access Token
2. The token needs `repo` scope to access private releases
3. Add to your environment or build script:
   ```bash
   export GH_TOKEN="your_github_personal_access_token"
   ```

### Debugging Auto-Update

The app now includes enhanced logging. To see auto-update logs:

**On Windows:**
- Run app from command prompt: `"C:\Program Files\Global Market POS\Global Market POS.exe"`
- Logs will appear in the console

**On macOS:**
- Run app from terminal: `/Applications/Global Market POS.app/Contents/MacOS/Global Market POS`
- Logs will appear in the console

**Log format:**
```
[AUTO-UPDATE] ====================================
[AUTO-UPDATE] Checking for updates...
[AUTO-UPDATE] Current version: 1.1.10
[AUTO-UPDATE] Platform: win32
[AUTO-UPDATE] Architecture: x64
[AUTO-UPDATE] Feed URL: https://api.github.com/repos/udaydash-app/collective-dev-kit/releases
[AUTO-UPDATE] ====================================
```

## Common Issues

### Issue: "No updates available" (but newer version exists)

**Possible causes:**
1. Tag doesn't match version format (missing 'v' prefix)
2. Release is a draft (not published)
3. Release is marked as pre-release (auto-updater ignores by default)
4. Required installer files not attached to release

**Solution:**
- Ensure tag is `v1.1.10` format
- Publish the release (not draft)
- Don't mark as pre-release
- Upload all installer files

### Issue: "404 Not Found"

**Causes:**
1. No releases exist yet
2. Repository is private and no GH_TOKEN provided
3. Wrong repository owner/name in electron-builder.json

**Solution:**
- Create at least one release
- Add GH_TOKEN for private repos
- Verify repository settings

### Issue: Download fails

**Causes:**
1. File size too large (GitHub API limitations)
2. Network issues
3. Installer file corrupted

**Solution:**
- Ensure stable internet connection
- Re-download installer from release
- Try again later

## Testing Auto-Update

### Test Scenario 1: First Release
1. Build version 1.1.10
2. Create release v1.1.10 on GitHub
3. Install app
4. App should show "No updates available"

### Test Scenario 2: Update Available
1. Install version 1.1.10
2. Update package.json to 1.1.11
3. Build and create release v1.1.11
4. Launch older app (1.1.10)
5. App should detect update to 1.1.11

### Test Scenario 3: Manual Check
1. Launch app
2. Click "Check for Updates" button
3. Should check immediately and show result

## Monitoring

The auto-updater sends status updates to the renderer process:

```javascript
// In renderer process
window.electron?.onUpdateStatus((status) => {
  console.log('Update status:', status);
  // status can be: 'checking', 'available', 'not-available', 'error'
});
```

You can use this to show custom UI indicators for update status.

## Security

- All downloads are verified using signatures
- electron-updater checks file integrity
- Only releases from your GitHub repository are used
- HTTPS is enforced for all update checks

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify release configuration on GitHub
3. Test with a simple version increment
4. Ensure all release files are properly uploaded

## Additional Resources

- [electron-updater documentation](https://www.electron.build/auto-update)
- [GitHub Releases documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Semantic Versioning](https://semver.org/)

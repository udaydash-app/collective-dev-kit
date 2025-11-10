# Build Cross-Platform Installers - Complete Instructions

## Your Project Location
Mac: `~/collective-dev-kit` or your project path
Windows: `C:\collective-dev-kit`

## Automated Builds (Recommended)

The easiest way to build both Mac and Windows installers is through **GitHub Actions**:

1. **Make your changes** in Lovable (auto-syncs to GitHub)
2. **Create a new version tag**:
   ```bash
   npm version patch  # or 'minor' or 'major'
   ```
3. **Push the tag to GitHub**:
   ```bash
   git push origin --tags
   ```
4. **GitHub Actions automatically builds**:
   - Windows EXE (x64, ia32, portable)
   - Mac DMG and ZIP (Apple Silicon arm64, Intel x64)
5. **Download installers** from GitHub Releases page

This happens automatically in the cloud - no need for Windows or Mac machines!

## Manual Local Builds

### Mac (macOS)

**Commands:**
```bash
# Navigate to project
cd ~/collective-dev-kit  # or your project path

# Install dependencies (first time only)
npm install --legacy-peer-deps

# Build the app
npm run build && npm run electron:build
```

**Output files in `release/` folder:**
- `Global Market POS-{version}-arm64.dmg` - Apple Silicon Mac
- `Global Market POS-{version}-x64.dmg` - Intel Mac
- ZIP files for both architectures

### Windows

**Commands (PowerShell or CMD):**
```bash
# Navigate to project
cd C:\collective-dev-kit

# Install dependencies (first time only)
npm install --legacy-peer-deps

# Build the app
npm run build
npm run electron:build
```

**Output files in `release\` folder:**
- `Global Market POS-{version}-x64.exe` - 64-bit installer
- `Global Market POS-{version}-ia32.exe` - 32-bit installer  
- `Global Market POS-{version}-Portable.exe` - Portable (no install)

## How Updates Work

After users install your app:
1. You make changes in Lovable (syncs to GitHub)
2. Create new version: `npm version patch`
3. Push tag: `git push origin --tags`
4. GitHub Actions builds both platforms automatically
5. Apps check for updates and prompt users to download

## Troubleshooting

### If build fails with "command not found"
Make sure you're in the correct directory:
```bash
cd C:\collective-dev-kit
```

### If you get module errors
Reinstall dependencies:
```bash
npm install --legacy-peer-deps
```

### If electron-builder fails
Make sure the `dist` folder exists:
```bash
npm run build
```
Then try electron:build again.

## Quick Build (All Steps Combined)

```bash
cd C:\collective-dev-kit
npm run build && npm run electron:build
```

This builds everything in one command.

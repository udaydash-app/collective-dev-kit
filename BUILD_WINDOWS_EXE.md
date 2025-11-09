# Building Windows EXE for Global Market POS

This guide explains how to build a Windows executable (.exe) for the Global Market POS application.

## Two-Way Sync Already Implemented ✅

Your application already has two-way synchronization:

1. **Local → Cloud Sync**: Offline transactions are synced to Supabase when internet is available
   - Implemented in `src/lib/syncService.ts`
   - Automatically syncs every 5 minutes when online
   - Manual sync available via sync button

2. **Cloud → Local Sync**: Real-time updates from Supabase are received instantly
   - Implemented in `src/hooks/useRealtimeSync.ts`
   - Updates products, orders, transactions, purchases in real-time
   - Works across all devices/windows simultaneously

## Prerequisites

Before building, ensure you have:
- Node.js installed (v18 or higher)
- Windows OS (for building Windows executables)
- At least 2GB free disk space

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Build the Application

Build the web application first:

```bash
npm run build
```

## Step 3: Build Windows EXE

Build the Windows executable (both installer and portable):

```bash
npm run electron:build
```

This will create:
- **Installer**: `release/Global Market POS-{version}-x64.exe` (recommended)
- **Portable**: `release/Global Market POS-{version}-Portable.exe` (no installation needed)

## Step 4: Test Before Building

You can test the Electron app before building:

```bash
# Start the development server
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

## Output Files

After building, you'll find the executables in the `release/` folder:

- **NSIS Installer** (64-bit): For installation on 64-bit Windows systems
- **NSIS Installer** (32-bit): For installation on 32-bit Windows systems  
- **Portable EXE**: Standalone executable that doesn't require installation

## Distribution

### Installer Version (Recommended)
- Users can install to Program Files
- Creates desktop and start menu shortcuts
- Includes uninstaller
- Better for permanent installations

### Portable Version
- No installation required
- Can run from USB drive
- Good for testing or temporary use
- All data stored in app directory

## Important Notes

### Internet Connection
- The app requires internet for Supabase sync
- Offline mode stores transactions locally
- Auto-syncs when connection is restored

### Database Configuration
- The app connects to your existing Supabase instance
- Connection details are in `src/integrations/supabase/client.ts`
- All POS features work identically to web version

### Multi-Device Sync
- Install on multiple Windows computers
- All devices sync through Supabase
- Real-time inventory and order updates
- Shared customer and product database

## Troubleshooting

### Build Fails
```bash
# Clean build artifacts and try again
rm -rf dist release
npm run build
npm run electron:build
```

### App Won't Start
- Check Windows Defender isn't blocking it
- Try running as Administrator
- Check antivirus settings

### Sync Issues
- Verify internet connection
- Check Supabase connection in the app
- Review console logs (press F12 in the app)

## Security

- All communications with Supabase use HTTPS
- Authentication tokens stored securely
- Row-level security enforced by Supabase
- No sensitive data stored in the EXE

## Updates

To update the app:
1. Pull latest code from your repository
2. Update version in `package.json`
3. Rebuild: `npm run build && npm run electron:build`
4. Distribute new EXE to users

## Advanced Configuration

### Custom Icons
Replace icons in `public/` folder:
- `icon-192x192.png`
- `icon-512x512.png`

### App Details
Edit `electron-builder.json`:
- Change `appId` for your organization
- Modify `productName`
- Adjust window size in `electron/main.cjs`

### Packaging Options
Modify `electron-builder.json` to:
- Add code signing (requires certificate)
- Enable auto-updates
- Change output formats (zip, 7z, etc.)

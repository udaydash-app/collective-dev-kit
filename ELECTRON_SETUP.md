# Complete Windows EXE Setup Instructions

## Your Two-Way Sync is Already Working! ✅

Your application already has complete two-way synchronization:

### 1. Local → Cloud (Offline → Online Sync)
- **File**: `src/lib/syncService.ts`
- **What it does**: Syncs offline POS transactions to Supabase when internet returns
- **Features**:
  - Automatic sync every 5 minutes
  - Manual sync button available
  - Retry logic for failed syncs
  - Toast notifications for sync status

### 2. Cloud → Local (Real-time Updates)
- **File**: `src/hooks/useRealtimeSync.ts`  
- **What it does**: Receives instant updates from Supabase across all devices
- **Features**:
  - Real-time product updates
  - Real-time order notifications
  - Real-time transaction sync
  - Instant inventory updates
  - Purchase and contact sync

**Result**: Multiple Windows computers can run the POS simultaneously with perfect sync!

---

## Step-by-Step Setup

### Step 1: Update package.json

Since package.json is read-only in this environment, you need to manually add these scripts after exporting your project:

Open your `package.json` and add these lines to the `"scripts"` section:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "electron:dev": "concurrently \"cross-env ELECTRON_DEV=true electron electron/main.cjs\" \"npm run dev\"",
  "electron:build": "npm run build && electron-builder"
}
```

Also add this line at the root level of package.json (outside of scripts):

```json
"main": "electron/main.cjs"
```

### Step 2: Install Additional Dependency (Windows)

If you're on Windows, you'll also need cross-env for the dev script:

```bash
npm install --save-dev cross-env
```

### Step 3: Build the Windows EXE

Now you can build your Windows executable:

```bash
# First, build the web app
npm run build

# Then, create the Windows EXE
npm run electron:build
```

This creates two versions in the `release/` folder:

1. **Installer EXE** (recommended): `Global Market POS-{version}-x64.exe`
   - Professional installation experience
   - Creates Start Menu and Desktop shortcuts
   - Includes uninstaller
   - Best for permanent installation

2. **Portable EXE**: `Global Market POS-{version}-Portable.exe`
   - No installation required
   - Run from anywhere (USB drive, network folder)
   - Great for testing
   - All data stays with the executable

---

## Testing Before Building

Test the Electron app without building:

```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron in dev mode
npm run electron:dev
```

This opens the app in a desktop window while maintaining hot-reload.

---

## What You Get

### Desktop Features
✅ Native Windows application  
✅ System tray icon  
✅ Desktop and Start Menu shortcuts  
✅ Offline-capable with auto-sync  
✅ Real-time updates across devices  
✅ Better performance than browser  
✅ No browser interface/controls  
✅ Professional appearance  

### Sync Features (Already Working!)
✅ Works offline - queues transactions locally  
✅ Auto-syncs when internet available  
✅ Real-time updates from cloud  
✅ Multi-device synchronization  
✅ Conflict-free merging  
✅ Toast notifications for sync status  

---

## Multi-Device Setup

### Scenario: 3 Cashier Stations

1. Build the Windows EXE once
2. Install on all 3 computers
3. Each logs in with their cashier account
4. All devices sync through Supabase in real-time

**Benefits**:
- Shared inventory (one sells, all see update)
- Shared customer database
- Combined sales reporting
- No network file sharing needed
- Works over internet, not just LAN

---

## File Locations

After building, find your executables here:

```
project/
├── release/
│   ├── Global Market POS-1.0.0-x64.exe        (Installer)
│   ├── Global Market POS-1.0.0-ia32.exe       (32-bit Installer)
│   ├── Global Market POS-1.0.0-Portable.exe   (No install)
│   └── win-unpacked/                          (Unpacked files)
```

---

## Distribution

### For Internal Use (Your Store)
- Use the **Installer version**
- Install on each POS terminal
- All connect to same Supabase database
- Perfect sync across all stations

### For Clients/Customers
- Use the **Portable version** for demos
- Use the **Installer version** for deployment
- Optionally add code signing (requires certificate)
- Can enable auto-updates in future

---

## Technical Details

### How Sync Works

**Offline Mode**:
1. User makes sale → Saved to IndexedDB
2. Internet unavailable → Transaction queued
3. App shows "Offline" indicator
4. Count of unsynced transactions shown

**Coming Online**:
1. Internet detected → Auto-sync triggered
2. Queued transactions sent to Supabase
3. Success toast shown
4. Unsynced count returns to 0

**Real-time Mode**:
1. Any device makes change → Supabase updated
2. Supabase broadcasts to all connected devices
3. Local cache invalidated
4. UI auto-refreshes with new data
5. No page reload needed

### Database Schema
- Products and inventory layers (FIFO)
- POS transactions with COGS tracking
- Purchases with supplier ledgers
- Contacts (customers/suppliers)
- Accounts and journal entries
- Cash sessions per register

---

## Troubleshooting

### Build Fails
```bash
# Clean everything and rebuild
rm -rf node_modules dist release
npm install
npm run build
npm run electron:build
```

### App Won't Open After Install
- Check Windows Defender / Antivirus
- Right-click → "Run as Administrator"
- Check if port 8080 is available (for dev mode)

### Sync Not Working
- Verify internet connection
- Check Supabase credentials in `src/integrations/supabase/client.ts`
- Open DevTools (F12) to see console errors
- Check network tab for API calls

### Multiple Instances
- Each instance needs its own user/cashier login
- All share same database
- Each has own cash session

---

## Advanced: Code Signing (Optional)

To prevent Windows warnings, you can sign the EXE:

1. Get a code signing certificate
2. Install it on your Windows build machine
3. Add to `electron-builder.json`:

```json
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "your-password",
  "publisherName": "Your Company Name"
}
```

---

## Next Steps

1. Export your project to GitHub
2. Clone it locally on a Windows machine
3. Run `npm install`
4. Add the scripts to package.json as shown above
5. Run `npm run electron:build`
6. Distribute the EXE from `release/` folder

---

## Questions?

Common scenarios:

**Q: Can I run web and desktop versions together?**  
A: Yes! They sync perfectly through Supabase.

**Q: How many devices can sync?**  
A: Unlimited. All connected to same Supabase.

**Q: Does it work without internet?**  
A: Yes! Stores transactions offline and syncs when online.

**Q: Can I update the app remotely?**  
A: With electron-updater, yes. Requires additional setup.

**Q: Is data secure?**  
A: Yes. All traffic uses HTTPS. Row-level security in Supabase.

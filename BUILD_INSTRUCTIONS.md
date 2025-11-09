# Build Windows EXE - Complete Instructions

## Your Project Location
`C:\collective-dev-kit`

## Step 1: Required package.json Scripts

Your `package.json` needs these scripts in the `"scripts"` section:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "electron:dev": "cross-env ELECTRON_DEV=true electron electron/main.cjs",
  "electron:build": "npm run build && electron-builder"
}
```

**Note:** The `electron` and `electron-builder` packages are already installed, so you don't need to install them again.

## Step 2: Build Commands (Run in Order)

Open **Command Prompt** or **PowerShell** and run these commands:

### 1. Navigate to Your Project
```bash
cd C:\collective-dev-kit
```

### 2. Clean Previous Build (if any)
```bash
rmdir /s /q dist
rmdir /s /q release
```

### 3. Build the Web Application
```bash
npm run build
```
This creates the `dist` folder with your built application.

### 4. Build the Windows EXE
```bash
npm run electron:build
```

## Step 3: Find Your EXE Files

After successful build, find your executables in:
```
C:\collective-dev-kit\release\
```

You'll find:
- **Global Market POS-{version}-x64.exe** - 64-bit installer
- **Global Market POS-{version}-ia32.exe** - 32-bit installer  
- **Global Market POS-{version}-Portable.exe** - Portable version (no installation needed)

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

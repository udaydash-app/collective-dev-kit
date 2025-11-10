const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const isDev = process.env.ELECTRON_DEV || false;

// Try to load electron-updater, but don't crash if it's not available
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // If GH_TOKEN is set, use it for private repo access
  if (process.env.GH_TOKEN) {
    autoUpdater.requestHeaders = {
      'Authorization': `token ${process.env.GH_TOKEN}`
    };
    console.log('[AUTO-UPDATE] Using GitHub token for private repository access');
  }
} catch (error) {
  console.warn('electron-updater not available:', error.message);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/icon-512x512.png'),
    title: 'Global Market - POS System',
    backgroundColor: '#FFFFFF',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Set default zoom to 150% when window is maximized
    if (mainWindow.isMaximized()) {
      mainWindow.webContents.setZoomFactor(1.5);
    }
  });

  // Handle maximize/unmaximize events for zoom
  mainWindow.on('maximize', () => {
    mainWindow.webContents.setZoomFactor(1.5);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.setZoomFactor(1.0);
  });

  // Load the app
  if (process.env.ELECTRON_DEV) {
    // Development mode - connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent external links from opening in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App lifecycle
// Auto-updater event handlers (only if electron-updater is available)
if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AUTO-UPDATE] Checking for updates...');
    console.log('[AUTO-UPDATE] Current version:', app.getVersion());
    console.log('[AUTO-UPDATE] Update URL:', autoUpdater.getFeedURL());
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AUTO-UPDATE] Update available:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version ${info.version} is available. Do you want to download it now?`,
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AUTO-UPDATE] Starting download...');
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AUTO-UPDATE] No updates available. Current version:', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let message = `[AUTO-UPDATE] Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
    console.log(message);
    // Send progress to renderer if needed
    BrowserWindow.getAllWindows()[0]?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AUTO-UPDATE] Update downloaded:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart to install the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AUTO-UPDATE] Restarting to install...');
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AUTO-UPDATE] Error occurred:', err.message);
    console.error('[AUTO-UPDATE] Full error:', err);
    console.error('[AUTO-UPDATE] Stack:', err.stack);
    // Show error dialog for better debugging
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Check Error',
      message: `Failed to check for updates: ${err.message}`,
      buttons: ['OK']
    });
  });
}

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Auto-updater not available' };
  }
  
  if (!isDev) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: 'Updates disabled in development mode' };
  }
});

app.whenReady().then(() => {
  createWindow();

  // Check for updates on startup (only in production)
  if (!isDev && autoUpdater) {
    console.log('[AUTO-UPDATE] App started in PRODUCTION mode');
    console.log('[AUTO-UPDATE] Will check for updates in 3 seconds...');
    setTimeout(() => {
      console.log('[AUTO-UPDATE] Starting update check...');
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[AUTO-UPDATE] Check failed:', err);
      });
    }, 3000); // Check after 3 seconds
  } else {
    console.log('[AUTO-UPDATE] App started in DEVELOPMENT mode - updates disabled');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for future desktop-specific features
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (event, name) => {
  return app.getPath(name);
});

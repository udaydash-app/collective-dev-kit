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
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version ${info.version} is available. Do you want to download it now?`,
      buttons: ['Download', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    console.log(message);
    // Send progress to renderer if needed
    BrowserWindow.getAllWindows()[0]?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart to install the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    dialog.showErrorBox('Update Error', `Error checking for updates: ${err.message}`);
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
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000); // Check after 3 seconds
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

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
    console.log('[AUTO-UPDATE] Feed URL:', autoUpdater.getFeedURL());
    console.log('[AUTO-UPDATE] Looking for releases at: https://github.com/udaydash-app/collective-dev-kit/releases');
  });

  let downloadProgressWindow = null;

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
        
        // Show download progress dialog
        downloadProgressWindow = new BrowserWindow({
          width: 400,
          height: 150,
          frame: false,
          resizable: false,
          alwaysOnTop: true,
          center: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          }
        });

        downloadProgressWindow.loadURL(`data:text/html;charset=utf-8,
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: Arial, sans-serif;
                  background: #f5f5f5;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  height: 100vh;
                }
                .container {
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                h3 { margin: 0 0 15px 0; color: #333; }
                .progress-bar {
                  width: 100%;
                  height: 24px;
                  background: #e0e0e0;
                  border-radius: 12px;
                  overflow: hidden;
                }
                .progress-fill {
                  height: 100%;
                  background: linear-gradient(90deg, #22C55E, #16A34A);
                  transition: width 0.3s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: 12px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h3>Downloading Update...</h3>
                <div class="progress-bar">
                  <div class="progress-fill" id="progress" style="width: 0%">0%</div>
                </div>
              </div>
            </body>
          </html>
        `);

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
    
    // Update progress window
    if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
      const percent = Math.round(progressObj.percent);
      downloadProgressWindow.webContents.executeJavaScript(`
        document.getElementById('progress').style.width = '${percent}%';
        document.getElementById('progress').textContent = '${percent}%';
      `);
    }
    BrowserWindow.getAllWindows()[0]?.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AUTO-UPDATE] Update downloaded:', info.version);
    
    // Close progress window
    if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
      downloadProgressWindow.close();
      downloadProgressWindow = null;
    }
    
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
    console.error('[AUTO-UPDATE] Error code:', err.code);
    console.error('[AUTO-UPDATE] Full error:', err);
    
    // If it's a 404, it means no releases exist yet
    if (err.message.includes('404')) {
      console.log('[AUTO-UPDATE] No releases found on GitHub yet. Please create a release first.');
      console.log('[AUTO-UPDATE] Visit: https://github.com/udaydash-app/collective-dev-kit/releases');
      // Don't show error dialog for 404 - it's expected when no releases exist
      return;
    }
    
    // Show error dialog only for unexpected errors
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

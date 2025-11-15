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
          width: 500,
          height: 220,
          frame: false,
          resizable: false,
          alwaysOnTop: true,
          center: true,
          transparent: false,
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
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  margin: 0;
                  padding: 0;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  background: #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                }
                .container {
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  padding: 30px;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  position: relative;
                }
                .content {
                  background: white;
                  padding: 25px;
                  border-radius: 12px;
                  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                h3 { 
                  margin: 0 0 8px 0; 
                  color: #1a1a1a;
                  font-size: 18px;
                  font-weight: 600;
                }
                .status { 
                  margin: 0 0 20px 0; 
                  color: #666;
                  font-size: 13px;
                }
                .progress-bar {
                  width: 100%;
                  height: 32px;
                  background: #f0f0f0;
                  border-radius: 16px;
                  overflow: hidden;
                  position: relative;
                  margin-bottom: 12px;
                }
                .progress-fill {
                  height: 100%;
                  background: linear-gradient(90deg, #22C55E, #16A34A);
                  transition: width 0.3s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: 600;
                  font-size: 13px;
                  min-width: 40px;
                }
                .details {
                  display: flex;
                  justify-content: space-between;
                  font-size: 12px;
                  color: #666;
                }
                .speed { font-weight: 500; }
                .cancel-btn {
                  position: absolute;
                  top: 15px;
                  right: 15px;
                  background: rgba(255,255,255,0.2);
                  border: none;
                  color: white;
                  width: 28px;
                  height: 28px;
                  border-radius: 14px;
                  cursor: pointer;
                  font-size: 18px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: background 0.2s;
                }
                .cancel-btn:hover {
                  background: rgba(255,255,255,0.3);
                }
              </style>
            </head>
            <body>
              <div class="container">
                <button class="cancel-btn" onclick="window.close()">×</button>
                <div class="content">
                  <h3>Downloading Update</h3>
                  <p class="status" id="status">Preparing download...</p>
                  <div class="progress-bar">
                    <div class="progress-fill" id="progress" style="width: 0%">0%</div>
                  </div>
                  <div class="details">
                    <span id="speed" class="speed">Speed: Calculating...</span>
                    <span id="transferred">0 MB / 0 MB</span>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);

        // Wait for the window to finish loading before starting the download
        downloadProgressWindow.webContents.once('did-finish-load', () => {
          console.log('[AUTO-UPDATE] Progress dialog loaded, starting download...');
          autoUpdater.downloadUpdate();
        });
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AUTO-UPDATE] No updates available. Current version:', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = progressObj.percent.toFixed(2);
    const speedMBps = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
    const transferredMB = (progressObj.transferred / 1024 / 1024).toFixed(2);
    const totalMB = (progressObj.total / 1024 / 1024).toFixed(2);
    
    console.log(`[AUTO-UPDATE] Download ${percent}% - Speed: ${speedMBps} MB/s - ${transferredMB}/${totalMB} MB`);
    
    // Update progress window
    if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
      const roundedPercent = Math.round(progressObj.percent);
      downloadProgressWindow.webContents.executeJavaScript(`
        document.getElementById('progress').style.width = '${roundedPercent}%';
        document.getElementById('progress').textContent = '${roundedPercent}%';
        document.getElementById('speed').textContent = 'Speed: ${speedMBps} MB/s';
        document.getElementById('transferred').textContent = '${transferredMB} MB / ${totalMB} MB';
        document.getElementById('status').textContent = 'Downloading... ${roundedPercent}% complete';
      `).catch(() => {
        // Window might be closed
      });
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
    
    // Close progress window if it's open
    if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
      downloadProgressWindow.close();
      downloadProgressWindow = null;
    }
    
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

// IPC handler for printing receipts
ipcMain.handle('print:receipt', async (event, html) => {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        { 
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' }
        },
        (success, errorType) => {
          if (!success) {
            console.error('Print failed:', errorType);
            reject(new Error(`Print failed: ${errorType}`));
          } else {
            console.log('Print successful');
            resolve();
          }
          printWindow.close();
        }
      );
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load print content:', errorDescription);
      reject(new Error(`Failed to load print content: ${errorDescription}`));
      printWindow.close();
    });
  });
});

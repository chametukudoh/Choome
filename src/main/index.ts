import { app, BrowserWindow, session, desktopCapturer, systemPreferences, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/handlers';
import { getPreferredDisplaySourceId } from './services/DisplayMediaService';
import { ShortcutsService } from './services/ShortcutsService';
import { setShortcutsService } from './services/ShortcutsManager';
import { getStorageService } from './services/StorageService';
import { getFFmpegService } from './services/FFmpegService';
import { RecordingRecoveryService } from './services/RecordingRecoveryService';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let shortcutsService: ShortcutsService | null = null;
const shouldOpenDevTools = process.env.CHOOME_DEVTOOLS === 'true';

const createWindow = async () => {
  // Request screen capture permissions on macOS (Windows doesn't need this)
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log('Screen capture permission status:', status);
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless for custom title bar
    backgroundColor: '#0f172a', // dark-900
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Set permission request handler
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'display-capture', 'mediaKeySystem'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Set permission check handler - always allow media permissions
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'display-capture', 'mediaKeySystem'];
    return allowedPermissions.includes(permission);
  });

  // Set up display media request handler for screen capture
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      console.log('Display media requested');
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
      });
      console.log('Found sources for display media:', sources.length);

      if (sources.length > 0) {
        const preferredSourceId = getPreferredDisplaySourceId();
        const preferredSource = preferredSourceId
          ? sources.find((source) => source.id === preferredSourceId)
          : null;
        const source = preferredSource ?? sources[0];
        callback({ video: source, audio: 'loopback' });
      } else {
        callback({});
      }
    } catch (error) {
      console.error('Display media request failed:', error);
      callback({});
    }
  });

  // Initialize keyboard shortcuts BEFORE registering IPC handlers
  shortcutsService = new ShortcutsService(mainWindow);
  setShortcutsService(shortcutsService);
  const storageService = getStorageService();
  const settings = storageService.getSettings();
  shortcutsService.registerShortcuts(settings);

  // Register IPC handlers (after shortcuts service is set)
  registerIpcHandlers(mainWindow);

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open DevTools only when explicitly requested
  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App lifecycle
app.on('ready', async () => {
  session.defaultSession.protocol.registerStreamProtocol('media', (request, callback) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    if (url.host) {
      if (/^[A-Za-z]$/.test(url.host)) {
        filePath = `${url.host}:${filePath}`;
      } else {
        filePath = `${url.host}${filePath}`;
      }
    }

    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    try {
      const stat = fs.statSync(filePath);
      const rangeHeader = request.headers?.Range || request.headers?.range;
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mkv': 'video/x-matroska',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
      };
      const contentType = mimeTypes[ext] ?? 'application/octet-stream';

      if (rangeHeader) {
        const range = rangeHeader.replace(/bytes=/, '').split('-');
        const start = Number(range[0]);
        const end = range[1] ? Number(range[1]) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });

        callback({
          statusCode: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
          },
          data: stream,
        });
        return;
      }

      const stream = fs.createReadStream(filePath);
      callback({
        statusCode: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Content-Type': contentType,
        },
        data: stream,
      });
    } catch (error) {
      console.error('Failed to stream media:', error);
      callback({ statusCode: 404 });
    }
  });

  // Test desktopCapturer at startup
  console.log('=== Testing desktopCapturer at startup ===');
  try {
    const testSources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log(`Startup test: Found ${testSources.length} screens`);
    testSources.forEach((s, i) => console.log(`  Screen ${i}: ${s.id} - ${s.name}`));
  } catch (err) {
    console.error('Startup desktopCapturer test failed:', err);
  }
  console.log('===========================================');

  const storageService = getStorageService();
  try {
    const ffmpegService = getFFmpegService();
    await storageService.repairRecordings(async (filePath) => {
      const metadata = await ffmpegService.getMetadata(filePath);
      return { duration: metadata.format?.duration };
    });
  } catch (error) {
    console.warn('Recording repair scan failed:', error);
  }

  try {
    const recoveryService = new RecordingRecoveryService(storageService);
    await recoveryService.recoverOrphaned();
  } catch (error) {
    console.warn('Recovery scan failed:', error);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  // Clean up shortcuts
  if (shortcutsService) {
    shortcutsService.unregisterAll();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

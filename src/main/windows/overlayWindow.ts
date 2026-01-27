import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

let overlayWindow: BrowserWindow | null = null;
const devToolsEnabled = process.env.CHOOME_DEVTOOLS === 'true';

export function createOverlayWindow(): BrowserWindow {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: devToolsEnabled,
    },
  });

  // Enable click-through by default (will be toggled when drawing)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the overlay page
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/overlay`);
  } else {
    overlayWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: '/overlay' }
    );
  }

  // Do not auto-open DevTools for the overlay window

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  overlayWindow = null;
}

export function setOverlayClickThrough(enabled: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  if (enabled) {
    // Make window click-through
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    // Make window interactive
    overlayWindow.setIgnoreMouseEvents(false);
  }
}

export function isOverlayVisible(): boolean {
  return overlayWindow !== null && !overlayWindow.isDestroyed();
}

import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { getStorageService } from '../services/StorageService';

let webcamWindow: BrowserWindow | null = null;
const devToolsEnabled = process.env.CHOOME_DEVTOOLS === 'true';

export interface WebcamConfig {
  size: 'small' | 'medium' | 'large';
  shape: 'circle' | 'rounded' | 'square';
  position: { x: number; y: number };
}

const SIZE_PRESETS = {
  small: { width: 150, height: 150 },
  medium: { width: 250, height: 250 },
  large: { width: 350, height: 350 },
};

export function createWebcamWindow(config?: Partial<WebcamConfig>): BrowserWindow {
  const storageService = getStorageService();
  const storedSettings = storageService.getSettings();
  const primaryDisplay = screen.getPrimaryDisplay();
  const displayKey = String(primaryDisplay.id);
  const storedDisplayPosition = storedSettings.webcam?.positionByDisplay?.[displayKey];
  const defaultConfig: WebcamConfig = {
    size: storedSettings.webcam?.size ?? 'medium',
    shape: storedSettings.webcam?.shape ?? 'circle',
    position: storedDisplayPosition ?? storedSettings.webcam?.position ?? { x: 100, y: 100 },
  };

  const finalConfig = { ...defaultConfig, ...config };
  const { width, height } = SIZE_PRESETS[finalConfig.size];

  // Get primary display to calculate default position
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Default position: bottom-right corner with 20px margin
  const defaultX = screenWidth - width - 20;
  const defaultY = screenHeight - height - 20;

  webcamWindow = new BrowserWindow({
    width,
    height,
    x: finalConfig.position.x || defaultX,
    y: finalConfig.position.y || defaultY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: devToolsEnabled,
    },
  });

  // Make window draggable
  webcamWindow.setIgnoreMouseEvents(false);

  // Load the webcam overlay page
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    webcamWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/webcam`);
  } else {
    webcamWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: '/webcam' }
    );
  }

  // Do not auto-open DevTools for the webcam window

  webcamWindow.on('closed', () => {
    webcamWindow = null;
  });

  webcamWindow.on('move', () => {
    const position = getWebcamPosition();
    if (!position) return;
    const settings = storageService.getSettings();
    const activeDisplay = screen.getDisplayNearestPoint({ x: position.x, y: position.y });
    storageService.setSettings({
      webcam: {
        ...settings.webcam,
        position: { x: position.x, y: position.y },
        positionByDisplay: {
          ...(settings.webcam?.positionByDisplay ?? {}),
          [String(activeDisplay.id)]: { x: position.x, y: position.y },
        },
      },
    });
  });

  return webcamWindow;
}

export function getWebcamWindow(): BrowserWindow | null {
  return webcamWindow;
}

export function closeWebcamWindow(): void {
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.close();
  }
  webcamWindow = null;
}

export function setWebcamVisible(visible: boolean): void {
  if (!webcamWindow || webcamWindow.isDestroyed()) return;
  if (visible) {
    webcamWindow.showInactive();
  } else {
    webcamWindow.hide();
  }
}

export function updateWebcamSize(size: 'small' | 'medium' | 'large'): void {
  if (!webcamWindow || webcamWindow.isDestroyed()) return;

  const { width, height } = SIZE_PRESETS[size];
  const [currentX, currentY] = webcamWindow.getPosition();

  // Keep the window centered on its current position
  const [currentWidth, currentHeight] = webcamWindow.getSize();
  const newX = currentX + (currentWidth - width) / 2;
  const newY = currentY + (currentHeight - height) / 2;

  webcamWindow.setBounds({ x: Math.round(newX), y: Math.round(newY), width, height });
}

export function getWebcamPosition(): { x: number; y: number; width: number; height: number } | null {
  if (!webcamWindow || webcamWindow.isDestroyed()) return null;

  const [x, y] = webcamWindow.getPosition();
  const [width, height] = webcamWindow.getSize();

  return { x, y, width, height };
}

export function setWebcamPosition(x: number, y: number): void {
  if (!webcamWindow || webcamWindow.isDestroyed()) return;
  webcamWindow.setPosition(x, y);
}

export function getWebcamOverlayConfig(displayId?: string): {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: WebcamConfig['shape'];
  displayWidth?: number;
  displayHeight?: number;
} | null {
  const settings = getStorageService().getSettings();
  const sizeKey = settings.webcam?.size ?? 'medium';
  const sizePreset = SIZE_PRESETS[sizeKey];
  const displays = screen.getAllDisplays();
  let targetDisplay = screen.getPrimaryDisplay();

  if (displayId) {
    const match = displays.find((display) => String(display.id) === String(displayId));
    if (match) {
      targetDisplay = match;
    }
  }

  const displayKey = displayId ? String(displayId) : null;
  const perDisplayPosition = displayKey
    ? settings.webcam?.positionByDisplay?.[displayKey]
    : undefined;
  const defaultPosition = {
    x: targetDisplay.bounds.x + Math.max(0, targetDisplay.bounds.width - sizePreset.width - 20),
    y: targetDisplay.bounds.y + Math.max(0, targetDisplay.bounds.height - sizePreset.height - 20),
  };
  const fallbackPosition = displayId
    ? defaultPosition
    : settings.webcam?.position ?? defaultPosition;
  const bounds = {
    x: perDisplayPosition?.x ?? fallbackPosition.x,
    y: perDisplayPosition?.y ?? fallbackPosition.y,
    width: sizePreset.width,
    height: sizePreset.height,
  };

  const scaleFactor = targetDisplay.scaleFactor || 1;
  const offsetX = bounds.x - targetDisplay.bounds.x;
  const offsetY = bounds.y - targetDisplay.bounds.y;

  return {
    x: Math.round(offsetX * scaleFactor),
    y: Math.round(offsetY * scaleFactor),
    width: Math.round(bounds.width * scaleFactor),
    height: Math.round(bounds.height * scaleFactor),
    shape: settings.webcam?.shape ?? 'circle',
    displayWidth: Math.round(targetDisplay.bounds.width * scaleFactor),
    displayHeight: Math.round(targetDisplay.bounds.height * scaleFactor),
  };
}

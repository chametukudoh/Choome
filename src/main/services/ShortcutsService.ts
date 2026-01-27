import { globalShortcut, BrowserWindow } from 'electron';
import type { AppSettings } from '../../shared/types';

export class ShortcutsService {
  private mainWindow: BrowserWindow;
  private registeredShortcuts: Set<string> = new Set();

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  registerShortcuts(settings: AppSettings): void {
    // Unregister all existing shortcuts first
    this.unregisterAll();

    // Register start/stop shortcut
    if (settings.shortcuts.startStop) {
      this.registerShortcut(settings.shortcuts.startStop, () => {
        this.mainWindow.webContents.send('shortcut:startStop');
      });
    }

    // Register pause shortcut
    if (settings.shortcuts.pause) {
      this.registerShortcut(settings.shortcuts.pause, () => {
        this.mainWindow.webContents.send('shortcut:pause');
      });
    }

    // Register drawing shortcut
    if (settings.shortcuts.drawing) {
      this.registerShortcut(settings.shortcuts.drawing, () => {
        this.mainWindow.webContents.send('shortcut:drawing');
      });
    }
  }

  private registerShortcut(accelerator: string, callback: () => void): void {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (success) {
        this.registeredShortcuts.add(accelerator);
        console.log(`Registered global shortcut: ${accelerator}`);
      } else {
        console.error(`Failed to register shortcut: ${accelerator}`);
      }
    } catch (error) {
      console.error(`Error registering shortcut ${accelerator}:`, error);
    }
  }

  unregisterAll(): void {
    this.registeredShortcuts.forEach((accelerator) => {
      globalShortcut.unregister(accelerator);
    });
    this.registeredShortcuts.clear();
    console.log('Unregistered all shortcuts');
  }

  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }
}

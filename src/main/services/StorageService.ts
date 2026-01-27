import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AppSettings, Recording } from '../../shared/types';

// Simple JSON file-based store (electron-store is ESM-only in v11+)
class SimpleStore<T extends Record<string, unknown>> {
  private filePath: string;
  private data: T;

  constructor(name: string, defaults: T) {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, `${name}.json`);
    this.data = this.load(defaults);
  }

  private load(defaults: T): T {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return { ...defaults, ...JSON.parse(content) };
      }
    } catch (error) {
      console.error('Failed to load store:', error);
    }
    return defaults;
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save store:', error);
    }
  }

  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
    return this.data[key] ?? defaultValue as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.save();
  }
}

// Schema for type safety
interface StoreSchema {
  settings: AppSettings;
  recordings: Recording[];
}

// Lazy initialization to avoid calling app.getPath before app is ready
let _storageService: StorageService | null = null;

export class StorageService {
  private store: SimpleStore<StoreSchema>;
  private defaultSettings: AppSettings;

  constructor() {
    this.defaultSettings = {
      quality: '1080p',
      frameRate: 60,
      videoBitrateKbps: 12000,
      storagePath: path.join(app.getPath('videos'), 'Choome'),
      shortcuts: {
        startStop: 'CommandOrControl+Shift+R',
        pause: 'CommandOrControl+Shift+P',
        drawing: 'CommandOrControl+Shift+D',
      },
      webcam: {
        shape: 'circle',
        size: 'medium',
        position: { x: 20, y: 20 },
        deviceId: null,
      },
    };

    this.migrateLegacyConfig();

    this.store = new SimpleStore<StoreSchema>('choome-config', {
      settings: this.defaultSettings,
      recordings: [],
    });

    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }

  private migrateLegacyConfig(): void {
    try {
      const userDataPath = app.getPath('userData');
      const legacyPath = path.join(userDataPath, 'loomy-config.json');
      const newPath = path.join(userDataPath, 'choome-config.json');

      if (!fs.existsSync(legacyPath) || fs.existsSync(newPath)) {
        return;
      }

      const legacyContent = fs.readFileSync(legacyPath, 'utf-8');
      const legacyData = JSON.parse(legacyContent) as Partial<StoreSchema>;
      const legacySettings = legacyData.settings ?? {};

      const legacyDefaultPath = path.join(app.getPath('videos'), 'Loomy');
      const migratedStoragePath =
        legacySettings.storagePath === legacyDefaultPath
          ? this.defaultSettings.storagePath
          : legacySettings.storagePath ?? this.defaultSettings.storagePath;

      const migratedSettings: AppSettings = {
        ...this.defaultSettings,
        ...legacySettings,
        storagePath: migratedStoragePath,
        shortcuts: {
          ...this.defaultSettings.shortcuts,
          ...(legacySettings.shortcuts ?? {}),
        },
        webcam: {
          ...this.defaultSettings.webcam,
          ...(legacySettings.webcam ?? {}),
          position: {
            ...this.defaultSettings.webcam.position,
            ...(legacySettings.webcam?.position ?? {}),
          },
        },
      };

      const migratedData: StoreSchema = {
        settings: migratedSettings,
        recordings: Array.isArray(legacyData.recordings) ? legacyData.recordings : [],
      };

      fs.writeFileSync(newPath, JSON.stringify(migratedData, null, 2));
    } catch (error) {
      console.error('Failed to migrate legacy config:', error);
    }
  }

  private ensureStorageDirectory(): void {
    const storagePath = this.getSettings().storagePath;
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  }

  // Settings methods
  getSettings(): AppSettings {
    return this.store.get('settings', this.defaultSettings);
  }

  setSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settings,
      shortcuts: {
        ...current.shortcuts,
        ...(settings.shortcuts ?? {}),
      },
      webcam: {
        ...current.webcam,
        ...(settings.webcam ?? {}),
        position: {
          ...current.webcam.position,
          ...(settings.webcam?.position ?? {}),
        },
      },
    };
    this.store.set('settings', updated);

    // If storage path changed, ensure new directory exists
    if (settings.storagePath) {
      this.ensureStorageDirectory();
    }
  }

  // Recordings methods
  getRecordings(): Recording[] {
    return this.store.get('recordings', []);
  }

  addRecording(recording: Recording): void {
    const recordings = this.getRecordings();
    recordings.unshift({ ...recording, deletedAt: recording.deletedAt ?? null }); // Add to beginning
    this.store.set('recordings', recordings);
  }

  updateRecording(id: string, updates: Partial<Recording>): void {
    const recordings = this.getRecordings();
    const index = recordings.findIndex((r) => r.id === id);
    if (index !== -1) {
      recordings[index] = { ...recordings[index], ...updates };
      this.store.set('recordings', recordings);
    }
  }

  deleteRecording(id: string): void {
    const recordings = this.getRecordings();
    const recording = recordings.find((r) => r.id === id);

    if (recording) {
      recording.deletedAt = new Date().toISOString();
      this.store.set('recordings', recordings);
    }
  }

  restoreRecording(id: string): void {
    const recordings = this.getRecordings();
    const recording = recordings.find((r) => r.id === id);
    if (recording) {
      recording.deletedAt = null;
      this.store.set('recordings', recordings);
    }
  }

  purgeRecording(id: string): void {
    const recordings = this.getRecordings();
    const recording = recordings.find((r) => r.id === id);
    if (!recording) return;

    if (fs.existsSync(recording.path)) {
      fs.unlinkSync(recording.path);
    }

    if (recording.thumbnailPath && fs.existsSync(recording.thumbnailPath)) {
      fs.unlinkSync(recording.thumbnailPath);
    }

    const filtered = recordings.filter((r) => r.id !== id);
    this.store.set('recordings', filtered);
  }

  getRecordingById(id: string): Recording | undefined {
    return this.getRecordings().find((r) => r.id === id);
  }

  async repairRecordings(getMetadata: (path: string) => Promise<{ duration?: number }>): Promise<void> {
    const settings = this.getSettings();
    const storagePath = settings.storagePath;
    if (!fs.existsSync(storagePath)) {
      return;
    }

    const supportedExts = new Set(['.webm', '.mp4', '.mov', '.mkv']);
    const files = fs.readdirSync(storagePath);
    const recordings = this.getRecordings();
    const byPath = new Map(recordings.map((r) => [r.path, r]));

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!supportedExts.has(ext)) continue;
      const fullPath = path.join(storagePath, file);
      if (byPath.has(fullPath)) continue;

      const stats = fs.statSync(fullPath);
      let duration = 0;
      try {
        const meta = await getMetadata(fullPath);
        duration = meta.duration ? Math.round(meta.duration) : 0;
      } catch {
        duration = 0;
      }

      const newRecording: Recording = {
        id: randomUUID(),
        name: path.basename(fullPath, ext),
        path: fullPath,
        duration,
        fileSize: stats.size,
        quality: settings.quality,
        createdAt: new Date(stats.mtimeMs).toISOString(),
        deletedAt: null,
      };
      recordings.unshift(newRecording);
    }

    // Mark missing files as deleted
    const fileSet = new Set(
      files
        .filter((file) => supportedExts.has(path.extname(file).toLowerCase()))
        .map((file) => path.join(storagePath, file))
    );
    recordings.forEach((recording) => {
      if (!fileSet.has(recording.path) && !recording.deletedAt) {
        recording.deletedAt = new Date().toISOString();
      }
    });

    this.store.set('recordings', recordings);
  }

  // Helper to generate unique filename
  generateRecordingPath(extension = 'mp4'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording-${timestamp}.${extension}`;
    return path.join(this.getSettings().storagePath, filename);
  }

  // Get temp directory for intermediate files
  getTempPath(): string {
    return path.join(app.getPath('temp'), 'choome');
  }
}

// Export getter function for lazy initialization
export function getStorageService(): StorageService {
  if (!_storageService) {
    _storageService = new StorageService();
  }
  return _storageService;
}

export default { getStorageService };

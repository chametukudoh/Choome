import { ipcMain, desktopCapturer, shell, dialog, BrowserWindow, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getStorageService } from '../services/StorageService';
import { getShortcutsService } from '../services/ShortcutsManager';
import { getFFmpegService } from '../services/FFmpegService';
import { setPreferredDisplaySourceId } from '../services/DisplayMediaService';
import type { WebcamOverlayConfig } from '../services/FFmpegService';
import type { Recording, RecordingSaveRequest, RecordingRegisterRequest } from '../../shared/types';
import { RecordingRecoveryService } from '../services/RecordingRecoveryService';
import {
  createWebcamWindow,
  closeWebcamWindow,
  setWebcamVisible,
  updateWebcamSize,
  getWebcamPosition,
  setWebcamPosition,
  getWebcamOverlayConfig,
} from '../windows/webcamWindow';
import {
  createOverlayWindow,
  closeOverlayWindow,
  setOverlayClickThrough,
  isOverlayVisible,
} from '../windows/overlayWindow';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  console.log('=== Registering IPC handlers ===');
  const storageService = getStorageService();
  const recoveryService = new RecordingRecoveryService(storageService);
  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window:moveOffDisplay', (_event, displayId?: number) => {
    const currentBounds = mainWindow.getBounds();
    const displays = screen.getAllDisplays();
    const target = typeof displayId === 'number'
      ? displays.find((display) => display.id !== displayId)
      : undefined;
    const capturedDisplay = typeof displayId === 'number'
      ? displays.find((display) => display.id === displayId)
      : undefined;

    if (target) {
      mainWindow.setBounds({
        ...currentBounds,
        x: target.workArea.x + 50,
        y: target.workArea.y + 50,
      });
      return currentBounds;
    }

    if (capturedDisplay) {
      mainWindow.setBounds({
        ...currentBounds,
        x: capturedDisplay.workArea.x + capturedDisplay.workArea.width + 50,
        y: capturedDisplay.workArea.y + 50,
      });
      return currentBounds;
    }

    return null;
  });

  ipcMain.handle('window:restoreBounds', (_event, bounds?: Electron.Rectangle | null) => {
    if (!bounds) return;
    mainWindow.setBounds(bounds);
  });

  // Screen sources - simplified to help diagnose issues
  ipcMain.handle('sources:get', async () => {
    const logs: string[] = [];
    const log = (msg: string) => {
      console.log(msg);
      logs.push(msg);
    };

    log('=== sources:get IPC handler called ===');
    log(`Platform: ${process.platform}`);
    log(`Electron version: ${process.versions.electron}`);
    log(`Chrome version: ${process.versions.chrome}`);

    try {
      // Try getting all sources at once first
      log('Requesting sources with types: ["screen", "window"]...');

      const startTime = Date.now();
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });
      const elapsed = Date.now() - startTime;

      log(`Got response in ${elapsed}ms`);
      log(`Found ${sources.length} sources`);

      // Log each source for debugging
      sources.forEach((source, i) => {
        log(`  [${i}] ${source.id}: ${source.name}`);
      });

      if (sources.length === 0) {
        log('WARNING: No sources found!');
        log('Possible causes:');
        log('  - Security software blocking screen capture');
        log('  - GPU/display driver issues');
        log('  - Electron desktopCapturer API issue');

        // Send logs back with the response so renderer can display them
        mainWindow.webContents.send('debug:log', logs.join('\n'));
      }

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon?.toDataURL(),
        display_id: source.display_id,
      }));
    } catch (error) {
      log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        log(`Stack: ${error.stack}`);
      }

      // Send error logs to renderer
      mainWindow.webContents.send('debug:log', logs.join('\n'));

      return [];
    }
  });

  ipcMain.handle('displays:get', () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display, index) => ({
      id: display.id,
      name: display.label || `Display ${index + 1}`,
      width: display.size.width,
      height: display.size.height,
      scaleFactor: display.scaleFactor,
      bounds: display.bounds,
      isPrimary: display.id === primaryId,
    }));
  });

  ipcMain.handle('sources:setPreferred', (_event, sourceId: string | null) => {
    setPreferredDisplaySourceId(sourceId);
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return storageService.getSettings();
  });

  ipcMain.handle('settings:set', (_event, settings) => {
    storageService.setSettings(settings);

    // Re-register shortcuts when settings change
    const shortcutsService = getShortcutsService();
    if (shortcutsService) {
      const updatedSettings = storageService.getSettings();
      shortcutsService.registerShortcuts(updatedSettings);
    }
  });

  // Storage
  ipcMain.handle('storage:getRecordings', () => {
    return storageService.getRecordings();
  });

  ipcMain.handle('storage:addRecording', async (_event, data: RecordingRegisterRequest) => {
    const { path: filePath, duration, quality, name } = data;
    if (!fs.existsSync(filePath)) {
      throw new Error('Recording file not found');
    }

    const stats = fs.statSync(filePath);
    const createdAt = new Date().toISOString();
    const recordingName = name ?? path.basename(filePath, path.extname(filePath));

    let thumbnailPath: string | undefined;
    try {
      const ffmpegService = getFFmpegService();
      const basePath = filePath.replace(/\.\w+$/, '');
      const thumbnailOutput = `${basePath}.jpg`;
      const safeTimestamp = duration > 1 ? 1 : undefined;
      await ffmpegService.generateThumbnail(filePath, thumbnailOutput, safeTimestamp);
      thumbnailPath = thumbnailOutput;
    } catch (error) {
      console.warn('Failed to generate thumbnail for edited recording:', error);
    }

    const recording: Recording = {
      id: randomUUID(),
      name: recordingName,
      path: filePath,
      duration,
      fileSize: stats.size,
      quality,
      createdAt,
      thumbnailPath,
      deletedAt: null,
    };

    storageService.addRecording(recording);
    mainWindow.webContents.send('recording:saved', recording);
    return recording;
  });

  ipcMain.handle('storage:deleteRecording', (_event, id: string) => {
    storageService.deleteRecording(id);
  });

  ipcMain.handle('storage:restoreRecording', (_event, id: string) => {
    storageService.restoreRecording(id);
  });

  ipcMain.handle('storage:purgeRecording', (_event, id: string) => {
    storageService.purgeRecording(id);
  });

  ipcMain.handle('storage:openFolder', () => {
    const settings = storageService.getSettings();
    shell.openPath(settings.storagePath);
  });

  ipcMain.handle('storage:revealRecording', (_event, id: string) => {
    const recording = storageService.getRecordingById(id);
    if (recording?.path) {
      shell.showItemInFolder(recording.path);
    }
  });

  ipcMain.handle('storage:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Recording Location',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Media devices - these are handled in renderer via getUserMedia
  // but we expose them through IPC for consistency
  ipcMain.handle('media:getAudioDevices', async () => {
    // This will be populated by the renderer process
    return [];
  });

  ipcMain.handle('media:getCameras', async () => {
    // This will be populated by the renderer process
    return [];
  });

  // Recording placeholders - will be implemented in Phase 2
  ipcMain.handle('recording:start', async () => {
    console.log('Recording start requested');
    // TODO: Implement in Phase 2
  });

  ipcMain.handle('recording:stop', async () => {
    console.log('Recording stop requested');
    // TODO: Implement in Phase 2
    return '';
  });

  ipcMain.handle('recording:pause', async () => {
    console.log('Recording pause requested');
    // TODO: Implement in Phase 2
  });

  ipcMain.handle('recording:resume', async () => {
    console.log('Recording resume requested');
    // TODO: Implement in Phase 2
  });

  ipcMain.handle('recording:beginRecovery', (_event, mimeType: string) => {
    return recoveryService.begin(mimeType);
  });

  ipcMain.handle('recording:appendRecovery', (_event, id: string, buffer: ArrayBuffer) => {
    recoveryService.append(id, Buffer.from(buffer));
  });

  ipcMain.handle('recording:finalizeRecovery', async (_event, id: string, meta: { duration: number; quality: Recording['quality'] }) => {
    const recording = await recoveryService.finalize(id, meta);
    mainWindow.webContents.send('recording:saved', recording);
    return recording;
  });

  ipcMain.handle('recording:discardRecovery', (_event, id: string) => {
    recoveryService.discard(id);
  });

  ipcMain.handle('recording:save', async (_event, data: RecordingSaveRequest) => {
    const { buffer, mimeType, duration, quality } = data;

    const extension = mimeType?.includes('mp4') ? 'mp4' : 'webm';
    const outputPath = storageService.generateRecordingPath(extension);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileBuffer = Buffer.from(buffer);
    fs.writeFileSync(outputPath, fileBuffer);

    const stats = fs.statSync(outputPath);
    const createdAt = new Date().toISOString();
    const name = path.basename(outputPath, path.extname(outputPath));

    let thumbnailPath: string | undefined;
    try {
      const ffmpegService = getFFmpegService();
      const basePath = outputPath.replace(/\.\w+$/, '');
      const thumbnailOutput = `${basePath}.jpg`;
      const safeTimestamp = duration > 1 ? 1 : undefined;
      await ffmpegService.generateThumbnail(outputPath, thumbnailOutput, safeTimestamp);
      thumbnailPath = thumbnailOutput;
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
    }

    const recording: Recording = {
      id: randomUUID(),
      name,
      path: outputPath,
      duration,
      fileSize: stats.size,
      quality,
      createdAt,
      thumbnailPath,
    };

    storageService.addRecording(recording);
    mainWindow.webContents.send('recording:saved', recording);
    return recording;
  });

  // Webcam window controls
  ipcMain.handle('webcam:open', (_event, config?) => {
    console.log('webcam:open handler called with config:', config);
    try {
      const savedConfig = storageService.getSettings().webcam;
      const finalConfig = config ? { ...savedConfig, ...config } : savedConfig;
      createWebcamWindow(finalConfig);
      console.log('Webcam window created successfully');
    } catch (error) {
      console.error('Error creating webcam window:', error);
      throw error;
    }
  });

  ipcMain.handle('webcam:close', () => {
    closeWebcamWindow();
  });

  ipcMain.handle('webcam:setVisible', (_event, visible: boolean) => {
    setWebcamVisible(visible);
  });

  ipcMain.handle('webcam:updateSize', (_event, size: 'small' | 'medium' | 'large') => {
    updateWebcamSize(size);
  });

  ipcMain.handle('webcam:getPosition', () => {
    return getWebcamPosition();
  });

  ipcMain.handle('webcam:setPosition', (_event, x: number, y: number) => {
    setWebcamPosition(x, y);
  });

  ipcMain.handle('webcam:getOverlayConfig', (_event, displayId?: string) => {
    return getWebcamOverlayConfig(displayId);
  });

  // Drawing overlay controls
  ipcMain.handle('overlay:open', () => {
    createOverlayWindow();
  });

  ipcMain.handle('overlay:close', () => {
    closeOverlayWindow();
  });

  ipcMain.handle('overlay:setClickThrough', (_event, enabled: boolean) => {
    setOverlayClickThrough(enabled);
  });

  ipcMain.handle('overlay:isVisible', () => {
    return isOverlayVisible();
  });

  // FFmpeg video processing
  const ffmpegService = getFFmpegService();

  ipcMain.handle('ffmpeg:compositeWebcam', async (_event, options: {
    videoPath: string;
    webcamPath: string;
    outputPath: string;
    webcamConfig: WebcamOverlayConfig;
  }) => {
    return ffmpegService.compositeWebcam({
      ...options,
      onProgress: (progress) => {
        mainWindow.webContents.send('ffmpeg:progress', progress);
      },
    });
  });

  ipcMain.handle('ffmpeg:trimVideo', async (_event, videoPath: string, outputPath: string, startTime: number, endTime: number) => {
    return ffmpegService.trimVideo(videoPath, outputPath, startTime, endTime, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle('ffmpeg:cropVideo', async (_event, videoPath: string, outputPath: string, x: number, y: number, width: number, height: number) => {
    return ffmpegService.cropVideo(videoPath, outputPath, x, y, width, height, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle(
    'ffmpeg:addTextOverlay',
    async (
      _event,
      videoPath: string,
      outputPath: string,
      text: string,
      x: number,
      y: number,
      fontSize: number,
      color: string,
      startTime: number,
      duration: number,
      bold?: boolean,
      italic?: boolean,
      fontFamily?: string,
      align?: 'left' | 'center' | 'right',
      animate?: boolean,
      endX?: number,
      endY?: number
    ) => {
      return ffmpegService.addTextOverlay(
        videoPath,
        outputPath,
        text,
        x,
        y,
        fontSize,
        color,
        startTime,
        duration,
        bold,
        italic,
        fontFamily,
        align,
        animate,
        endX,
        endY,
        (progress) => {
          mainWindow.webContents.send('ffmpeg:progress', progress);
        }
      );
    }
  );

  ipcMain.handle('ffmpeg:renderTimeline', async (_event, videoPath: string, outputPath: string, segments: { start: number; end: number }[]) => {
    return ffmpegService.renderTimeline(videoPath, outputPath, segments, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle('ffmpeg:generateProxy', async (_event, videoPath: string, outputPath: string, width?: number) => {
    return ffmpegService.generateProxy(videoPath, outputPath, width, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle('ffmpeg:applyAudioFilters', async (
    _event,
    videoPath: string,
    outputPath: string,
    options: { volume: number; muted: boolean; fadeIn: number; fadeOut: number; duration: number }
  ) => {
    return ffmpegService.applyAudioFilters(videoPath, outputPath, options, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle('ffmpeg:transcodePreset', async (
    _event,
    videoPath: string,
    outputPath: string,
    options: { width: number; height: number; bitrate: string; encoder?: 'auto' | 'cpu' | 'nvenc' | 'qsv' | 'amf'; optimizeForSize?: boolean }
  ) => {
    return ffmpegService.transcodePreset(videoPath, outputPath, options, (progress) => {
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
  });

  ipcMain.handle('ffmpeg:generateWaveform', async (_event, videoPath: string, outputPath: string, width?: number, height?: number) => {
    return ffmpegService.generateWaveformImage(videoPath, outputPath, width, height);
  });

  ipcMain.handle('ffmpeg:getMetadata', async (_event, videoPath: string) => {
    return ffmpegService.getMetadata(videoPath);
  });

  ipcMain.handle('ffmpeg:generateThumbnail', async (_event, videoPath: string, outputPath: string, timestamp?: number) => {
    return ffmpegService.generateThumbnail(videoPath, outputPath, timestamp);
  });
}

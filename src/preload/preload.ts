import { contextBridge, ipcRenderer } from 'electron';
import type {
  Recording,
  RecordingSaveRequest as SharedRecordingSaveRequest,
  RecordingRegisterRequest as SharedRecordingRegisterRequest,
} from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  moveWindowOffDisplay: (displayId?: number) => ipcRenderer.invoke('window:moveOffDisplay', displayId),
  restoreWindowBounds: (bounds?: { x: number; y: number; width: number; height: number } | null) =>
    ipcRenderer.invoke('window:restoreBounds', bounds),

  // Screen capture
  getSources: () => ipcRenderer.invoke('sources:get'),
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  setPreferredSource: (sourceId: string | null) => ipcRenderer.invoke('sources:setPreferred', sourceId),

  // Recording controls
  startRecording: (options: RecordingOptions) => ipcRenderer.invoke('recording:start', options),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  pauseRecording: () => ipcRenderer.invoke('recording:pause'),
  resumeRecording: () => ipcRenderer.invoke('recording:resume'),
  saveRecording: (data: RecordingSaveRequest) => ipcRenderer.invoke('recording:save', data),
  beginRecordingRecovery: (mimeType: string) => ipcRenderer.invoke('recording:beginRecovery', mimeType),
  appendRecordingRecovery: (id: string, buffer: ArrayBuffer) => ipcRenderer.invoke('recording:appendRecovery', id, buffer),
  finalizeRecordingRecovery: (id: string, meta: { duration: number; quality: '720p' | '1080p' | '1440p' | '4k' }) =>
    ipcRenderer.invoke('recording:finalizeRecovery', id, meta),
  discardRecordingRecovery: (id: string) => ipcRenderer.invoke('recording:discardRecovery', id),

  // Media devices
  getAudioDevices: () => ipcRenderer.invoke('media:getAudioDevices'),
  getCameras: () => ipcRenderer.invoke('media:getCameras'),

  // Storage
  getRecordings: () => ipcRenderer.invoke('storage:getRecordings'),
  addRecording: (data: RecordingRegisterRequest) => ipcRenderer.invoke('storage:addRecording', data),
  deleteRecording: (id: string) => ipcRenderer.invoke('storage:deleteRecording', id),
  restoreRecording: (id: string) => ipcRenderer.invoke('storage:restoreRecording', id),
  purgeRecording: (id: string) => ipcRenderer.invoke('storage:purgeRecording', id),
  revealRecording: (id: string) => ipcRenderer.invoke('storage:revealRecording', id),
  openRecordingsFolder: () => ipcRenderer.invoke('storage:openFolder'),
  selectFolder: () => ipcRenderer.invoke('storage:selectFolder'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: DeepPartial<AppSettings>) => ipcRenderer.invoke('settings:set', settings),

  // Webcam window
  openWebcam: (config?: WebcamConfig) => ipcRenderer.invoke('webcam:open', config),
  closeWebcam: () => ipcRenderer.invoke('webcam:close'),
  setWebcamVisible: (visible: boolean) => ipcRenderer.invoke('webcam:setVisible', visible),
  updateWebcamSize: (size: 'small' | 'medium' | 'large') => ipcRenderer.invoke('webcam:updateSize', size),
  getWebcamPosition: () => ipcRenderer.invoke('webcam:getPosition'),
  setWebcamPosition: (x: number, y: number) => ipcRenderer.invoke('webcam:setPosition', x, y),
  getWebcamOverlayConfig: (displayId?: string) => ipcRenderer.invoke('webcam:getOverlayConfig', displayId),

  // Drawing overlay
  openOverlay: () => ipcRenderer.invoke('overlay:open'),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  setOverlayClickThrough: (enabled: boolean) => ipcRenderer.invoke('overlay:setClickThrough', enabled),
  isOverlayVisible: () => ipcRenderer.invoke('overlay:isVisible'),

  // Event listeners
  onRecordingProgress: (callback: (progress: RecordingProgress) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: RecordingProgress) => callback(progress);
    ipcRenderer.on('recording:progress', subscription);
    return () => ipcRenderer.removeListener('recording:progress', subscription);
  },
  onRecordingSaved: (callback: (recording: Recording) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, recording: Recording) => callback(recording);
    ipcRenderer.on('recording:saved', subscription);
    return () => ipcRenderer.removeListener('recording:saved', subscription);
  },

  onEncodingProgress: (callback: (percent: number) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, percent: number) => callback(percent);
    ipcRenderer.on('encoding:progress', subscription);
    return () => ipcRenderer.removeListener('encoding:progress', subscription);
  },

  // Debug logging from main process
  onDebugLog: (callback: (log: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, log: string) => callback(log);
    ipcRenderer.on('debug:log', subscription);
    return () => ipcRenderer.removeListener('debug:log', subscription);
  },

  // Keyboard shortcuts
  onShortcutStartStop: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('shortcut:startStop', subscription);
    return () => ipcRenderer.removeListener('shortcut:startStop', subscription);
  },

  onShortcutPause: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('shortcut:pause', subscription);
    return () => ipcRenderer.removeListener('shortcut:pause', subscription);
  },

  onShortcutDrawing: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('shortcut:drawing', subscription);
    return () => ipcRenderer.removeListener('shortcut:drawing', subscription);
  },

  // FFmpeg video processing
  ffmpegCompositeWebcam: (options: {
    videoPath: string;
    webcamPath: string;
    outputPath: string;
    webcamConfig: {
      x: number;
      y: number;
      width: number;
      height: number;
      shape: 'circle' | 'rounded' | 'square';
    };
  }) => ipcRenderer.invoke('ffmpeg:compositeWebcam', options),

  ffmpegTrimVideo: (videoPath: string, outputPath: string, startTime: number, endTime: number) =>
    ipcRenderer.invoke('ffmpeg:trimVideo', videoPath, outputPath, startTime, endTime),

  ffmpegCropVideo: (videoPath: string, outputPath: string, x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke('ffmpeg:cropVideo', videoPath, outputPath, x, y, width, height),

  ffmpegAddTextOverlay: (
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
  ) => ipcRenderer.invoke('ffmpeg:addTextOverlay', videoPath, outputPath, text, x, y, fontSize, color, startTime, duration, bold, italic, fontFamily, align, animate, endX, endY),

  ffmpegRenderTimeline: (
    videoPath: string,
    outputPath: string,
    segments: { start: number; end: number }[]
  ) => ipcRenderer.invoke('ffmpeg:renderTimeline', videoPath, outputPath, segments),

  ffmpegGenerateProxy: (videoPath: string, outputPath: string, width?: number) =>
    ipcRenderer.invoke('ffmpeg:generateProxy', videoPath, outputPath, width),

  ffmpegApplyAudioFilters: (
    videoPath: string,
    outputPath: string,
    options: { volume: number; muted: boolean; fadeIn: number; fadeOut: number; duration: number }
  ) => ipcRenderer.invoke('ffmpeg:applyAudioFilters', videoPath, outputPath, options),

  ffmpegTranscodePreset: (
    videoPath: string,
    outputPath: string,
    options: { width: number; height: number; bitrate: string; encoder?: 'auto' | 'cpu' | 'nvenc' | 'qsv' | 'amf'; optimizeForSize?: boolean }
  ) => ipcRenderer.invoke('ffmpeg:transcodePreset', videoPath, outputPath, options),

  ffmpegGenerateWaveform: (videoPath: string, outputPath: string, width?: number, height?: number) =>
    ipcRenderer.invoke('ffmpeg:generateWaveform', videoPath, outputPath, width, height),

  ffmpegGetMetadata: (videoPath: string) => ipcRenderer.invoke('ffmpeg:getMetadata', videoPath),

  ffmpegGenerateThumbnail: (videoPath: string, outputPath: string, timestamp?: number) =>
    ipcRenderer.invoke('ffmpeg:generateThumbnail', videoPath, outputPath, timestamp),

  onFFmpegProgress: (callback: (progress: number) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress);
    ipcRenderer.on('ffmpeg:progress', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:progress', subscription);
  },
});

// Type definitions
interface RecordingOptions {
  sourceId: string;
  audioDeviceId?: string;
  includeSystemAudio: boolean;
  includeWebcam: boolean;
  webcamDeviceId?: string;
  quality: '720p' | '1080p' | '1440p' | '4k';
}

interface RecordingProgress {
  duration: number;
  fileSize: number;
}

type RecordingSaveRequest = SharedRecordingSaveRequest;
type RecordingRegisterRequest = SharedRecordingRegisterRequest;

interface AppSettings {
  quality: '720p' | '1080p' | '1440p' | '4k';
  frameRate: number;
  videoBitrateKbps: number;
  storagePath: string;
  shortcuts: {
    startStop: string;
    pause: string;
    drawing: string;
  };
  webcam: {
    shape: 'circle' | 'rounded' | 'square';
    size: 'small' | 'medium' | 'large';
    position: { x: number; y: number };
    deviceId?: string | null;
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface WebcamConfig {
  size?: 'small' | 'medium' | 'large';
  shape?: 'circle' | 'rounded' | 'square';
  position?: { x: number; y: number };
}

// Type augmentation for window object
declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      moveWindowOffDisplay: (displayId?: number) => Promise<{ x: number; y: number; width: number; height: number } | null>;
      restoreWindowBounds: (bounds?: { x: number; y: number; width: number; height: number } | null) => Promise<void>;
      getSources: () => Promise<Electron.DesktopCapturerSource[]>;
      getDisplays: () => Promise<{ id: number; name: string; width: number; height: number; scaleFactor: number }[]>;
      setPreferredSource: (sourceId: string | null) => Promise<void>;
      startRecording: (options: RecordingOptions) => Promise<void>;
      stopRecording: () => Promise<string>;
      pauseRecording: () => Promise<void>;
      resumeRecording: () => Promise<void>;
      saveRecording: (data: RecordingSaveRequest) => Promise<Recording>;
      beginRecordingRecovery: (mimeType: string) => Promise<{ id: string; path: string }>;
      appendRecordingRecovery: (id: string, buffer: ArrayBuffer) => Promise<void>;
      finalizeRecordingRecovery: (id: string, meta: { duration: number; quality: '720p' | '1080p' | '1440p' | '4k' }) => Promise<Recording>;
      discardRecordingRecovery: (id: string) => Promise<void>;
      getAudioDevices: () => Promise<MediaDeviceInfo[]>;
      getCameras: () => Promise<MediaDeviceInfo[]>;
      getRecordings: () => Promise<Recording[]>;
      addRecording: (data: RecordingRegisterRequest) => Promise<Recording>;
      deleteRecording: (id: string) => Promise<void>;
      restoreRecording: (id: string) => Promise<void>;
      purgeRecording: (id: string) => Promise<void>;
      revealRecording: (id: string) => Promise<void>;
      openRecordingsFolder: () => Promise<void>;
      selectFolder: () => Promise<string | null>;
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: DeepPartial<AppSettings>) => Promise<void>;
      openWebcam: (config?: WebcamConfig) => Promise<void>;
      closeWebcam: () => Promise<void>;
      setWebcamVisible: (visible: boolean) => Promise<void>;
      updateWebcamSize: (size: 'small' | 'medium' | 'large') => Promise<void>;
      getWebcamPosition: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
      setWebcamPosition: (x: number, y: number) => Promise<void>;
      getWebcamOverlayConfig: (displayId?: string) => Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
        shape: 'circle' | 'rounded' | 'square';
        displayWidth?: number;
        displayHeight?: number;
      } | null>;
      openOverlay: () => Promise<void>;
      closeOverlay: () => Promise<void>;
      setOverlayClickThrough: (enabled: boolean) => Promise<void>;
      isOverlayVisible: () => Promise<boolean>;
      onRecordingProgress: (callback: (progress: RecordingProgress) => void) => () => void;
      onRecordingSaved: (callback: (recording: Recording) => void) => () => void;
      onEncodingProgress: (callback: (percent: number) => void) => () => void;
      onDebugLog: (callback: (log: string) => void) => () => void;
      onShortcutStartStop: (callback: () => void) => () => void;
      onShortcutPause: (callback: () => void) => () => void;
      onShortcutDrawing: (callback: () => void) => () => void;
      ffmpegCompositeWebcam: (options: {
        videoPath: string;
        webcamPath: string;
        outputPath: string;
        webcamConfig: {
          x: number;
          y: number;
          width: number;
          height: number;
          shape: 'circle' | 'rounded' | 'square';
        };
      }) => Promise<string>;
      ffmpegTrimVideo: (videoPath: string, outputPath: string, startTime: number, endTime: number) => Promise<string>;
      ffmpegCropVideo: (videoPath: string, outputPath: string, x: number, y: number, width: number, height: number) => Promise<string>;
      ffmpegAddTextOverlay: (
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
      ) => Promise<string>;
      ffmpegRenderTimeline: (
        videoPath: string,
        outputPath: string,
        segments: { start: number; end: number }[]
      ) => Promise<string>;
      ffmpegGenerateProxy: (videoPath: string, outputPath: string, width?: number) => Promise<string>;
      ffmpegApplyAudioFilters: (
        videoPath: string,
        outputPath: string,
        options: { volume: number; muted: boolean; fadeIn: number; fadeOut: number; duration: number }
      ) => Promise<string>;
      ffmpegTranscodePreset: (
        videoPath: string,
        outputPath: string,
        options: { width: number; height: number; bitrate: string; encoder?: 'auto' | 'cpu' | 'nvenc' | 'qsv' | 'amf'; optimizeForSize?: boolean }
      ) => Promise<string>;
      ffmpegGenerateWaveform: (
        videoPath: string,
        outputPath: string,
        width?: number,
        height?: number
      ) => Promise<string>;
      ffmpegGetMetadata: (videoPath: string) => Promise<any>;
      ffmpegGenerateThumbnail: (videoPath: string, outputPath: string, timestamp?: number) => Promise<string>;
      onFFmpegProgress: (callback: (progress: number) => void) => () => void;
    };
  }

  interface Recording {
    id: string;
    name: string;
    path: string;
    duration: number;
    fileSize: number;
    quality: '720p' | '1080p' | '1440p' | '4k';
    createdAt: string;
    thumbnailPath?: string;
    deletedAt?: string | null;
  }
}

export {};

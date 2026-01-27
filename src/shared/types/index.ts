// Recording types
export interface RecordingOptions {
  sourceId: string;
  audioDeviceId?: string;
  includeSystemAudio: boolean;
  includeWebcam: boolean;
  webcamDeviceId?: string;
  quality: QualityPreset;
}

export interface RecordingProgress {
  duration: number;
  fileSize: number;
}

export interface RecordingSaveRequest {
  buffer: ArrayBuffer;
  mimeType: string;
  duration: number;
  quality: QualityPreset;
}

export interface RecordingRegisterRequest {
  path: string;
  duration: number;
  quality: QualityPreset;
  name?: string;
}

export interface Recording {
  id: string;
  name: string;
  path: string;
  duration: number;
  fileSize: number;
  quality: QualityPreset;
  createdAt: string;
  thumbnailPath?: string;
  deletedAt?: string | null;
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing';

// Quality presets
export type QualityPreset = '720p' | '1080p' | '1440p' | '4k';

export interface QualityConfig {
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
  frameRate: number;
}

// Settings
export interface AppSettings {
  quality: QualityPreset;
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

// Source types
export interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string;
  display_id?: string;
}

export interface DisplayInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  scaleFactor: number;
}

// Media device types
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface VideoDevice {
  deviceId: string;
  label: string;
}

export type { TimelineClip, TimelineProject } from './editor';

// IPC channel types
export interface IPCChannels {
  // Window
  'window:minimize': () => void;
  'window:maximize': () => void;
  'window:close': () => void;

  // Sources
  'sources:get': () => SourceInfo[];
  'displays:get': () => DisplayInfo[];

  // Recording
  'recording:start': (options: RecordingOptions) => void;
  'recording:stop': () => string;
  'recording:pause': () => void;
  'recording:resume': () => void;
  'recording:save': (data: RecordingSaveRequest) => Recording;
  'recording:saved': Recording;
  'recording:progress': RecordingProgress;
  'recording:beginRecovery': (mimeType: string) => { id: string; path: string };
  'recording:appendRecovery': (id: string, buffer: ArrayBuffer) => void;
  'recording:finalizeRecovery': (id: string, meta: { duration: number; quality: QualityPreset }) => Recording;
  'recording:discardRecovery': (id: string) => void;

  // Media
  'media:getAudioDevices': () => AudioDevice[];
  'media:getCameras': () => VideoDevice[];

  // Storage
  'storage:getRecordings': () => Recording[];
  'storage:addRecording': (data: RecordingRegisterRequest) => Recording;
  'storage:deleteRecording': (id: string) => void;
  'storage:restoreRecording': (id: string) => void;
  'storage:purgeRecording': (id: string) => void;
  'storage:revealRecording': (id: string) => void;
  'storage:openFolder': () => void;
  'storage:selectFolder': () => string | null;

  // Settings
  'settings:get': () => AppSettings;
  'settings:set': (settings: Partial<AppSettings>) => void;

  // Encoding
  'encoding:progress': number;
}

import { create } from 'zustand';
import type { RecordingStatus, QualityPreset, SourceInfo } from '../../shared/types';

interface RecordingState {
  // Recording status
  status: RecordingStatus;

  // Selected sources
  selectedSource: SourceInfo | null;
  availableSources: SourceInfo[];

  // Audio settings
  includeMicrophone: boolean;
  includeSystemAudio: boolean;
  selectedMicrophoneId: string | null;
  microphoneMuted: boolean;
  systemAudioMuted: boolean;
  systemAudioAvailable: boolean | null;

  // Webcam settings
  includeWebcam: boolean;
  selectedWebcamId: string | null;

  // Quality
  quality: QualityPreset;

  // Recording stats
  duration: number;
  fileSize: number;

  // Actions
  setStatus: (status: RecordingStatus) => void;
  setSelectedSource: (source: SourceInfo | null) => void;
  setAvailableSources: (sources: SourceInfo[]) => void;
  setIncludeMicrophone: (include: boolean) => void;
  setIncludeSystemAudio: (include: boolean) => void;
  setSelectedMicrophoneId: (id: string | null) => void;
  setMicrophoneMuted: (muted: boolean) => void;
  setSystemAudioMuted: (muted: boolean) => void;
  setSystemAudioAvailable: (available: boolean | null) => void;
  setIncludeWebcam: (include: boolean) => void;
  setSelectedWebcamId: (id: string | null) => void;
  setQuality: (quality: QualityPreset) => void;
  setDuration: (duration: number) => void;
  setFileSize: (fileSize: number) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as RecordingStatus,
  selectedSource: null,
  availableSources: [],
  includeMicrophone: true,
  includeSystemAudio: false,
  selectedMicrophoneId: null,
  microphoneMuted: false,
  systemAudioMuted: false,
  systemAudioAvailable: null,
  includeWebcam: false,
  selectedWebcamId: null,
  quality: '1080p' as QualityPreset,
  duration: 0,
  fileSize: 0,
};

export const useRecordingStore = create<RecordingState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setAvailableSources: (sources) => set({ availableSources: sources }),
  setIncludeMicrophone: (include) => set({ includeMicrophone: include }),
  setIncludeSystemAudio: (include) => set({ includeSystemAudio: include }),
  setSelectedMicrophoneId: (id) => set({ selectedMicrophoneId: id }),
  setMicrophoneMuted: (muted) => set({ microphoneMuted: muted }),
  setSystemAudioMuted: (muted) => set({ systemAudioMuted: muted }),
  setSystemAudioAvailable: (available) => set({ systemAudioAvailable: available }),
  setIncludeWebcam: (include) => set({ includeWebcam: include }),
  setSelectedWebcamId: (id) => set({ selectedWebcamId: id }),
  setQuality: (quality) => set({ quality }),
  setDuration: (duration) => set({ duration }),
  setFileSize: (fileSize) => set({ fileSize }),
  reset: () => set(initialState),
}));

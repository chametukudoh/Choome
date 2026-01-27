import { useState, useEffect, useCallback, useRef } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface VideoDevice {
  deviceId: string;
  label: string;
}

interface UseMediaDevicesReturn {
  // Devices
  microphones: AudioDevice[];
  cameras: VideoDevice[];

  // Loading states
  isLoadingDevices: boolean;
  error: string | null;

  // Audio levels
  microphoneLevel: number;

  // Actions
  refreshDevices: () => Promise<void>;
  startMicrophoneMonitor: (deviceId?: string) => Promise<void>;
  stopMicrophoneMonitor: () => void;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [cameras, setCameras] = useState<VideoDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);

  // Refs for audio monitoring
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Enumerate all media devices
  const refreshDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    setError(null);

    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
        // Stop all tracks immediately - we just need permission
        stream.getTracks().forEach((track) => track.stop());
      }).catch(() => {
        // Continue even if permission denied - we'll get device IDs without labels
      });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const mics: AudioDevice[] = [];
      const cams: VideoDevice[] = [];

      devices.forEach((device) => {
        if (device.kind === 'audioinput') {
          mics.push({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${mics.length + 1}`,
            kind: 'audioinput',
          });
        } else if (device.kind === 'videoinput') {
          cams.push({
            deviceId: device.deviceId,
            label: device.label || `Camera ${cams.length + 1}`,
          });
        }
      });

      setMicrophones(mics);
      setCameras(cams);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to get media devices');
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  // Start microphone level monitoring
  const startMicrophoneMonitor = useCallback(async (deviceId?: string) => {
    // Stop any existing monitor
    stopMicrophoneMonitor();

    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });

      micStreamRef.current = stream;

      // Create audio context and analyser
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Start monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Normalize to 0-100 range
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setMicrophoneLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Failed to start microphone monitor:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  }, []);

  // Stop microphone level monitoring
  const stopMicrophoneMonitor = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setMicrophoneLevel(0);
  }, []);

  // Load devices on mount
  useEffect(() => {
    refreshDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      stopMicrophoneMonitor();
    };
  }, [refreshDevices, stopMicrophoneMonitor]);

  return {
    microphones,
    cameras,
    isLoadingDevices,
    error,
    microphoneLevel,
    refreshDevices,
    startMicrophoneMonitor,
    stopMicrophoneMonitor,
  };
}

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebcamDevice {
  deviceId: string;
  label: string;
}

interface UseWebcamReturn {
  // State
  stream: MediaStream | null;
  cameras: WebcamDevice[];
  selectedCameraId: string | null;
  isLoadingDevices: boolean;
  error: string | null;
  isStreaming: boolean;

  // Actions
  startStream: (deviceId?: string) => Promise<void>;
  stopStream: () => void;
  selectCamera: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useWebcam(): UseWebcamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<WebcamDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    setError(null);

    try {
      // Request permission first
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
        }));

      // Sort cameras - prioritize actual webcams over phone cameras
      const sortedCameras = videoDevices.sort((a, b) => {
        const aIsPhone = /\b(itel|phone|android|ios|mobile)\b/i.test(a.label);
        const bIsPhone = /\b(itel|phone|android|ios|mobile)\b/i.test(b.label);

        if (aIsPhone && !bIsPhone) return 1; // Phone goes last
        if (!aIsPhone && bIsPhone) return -1; // Webcam goes first
        return 0;
      });

      setCameras(sortedCameras);

      // Auto-select first camera (which should be a real webcam after sorting)
      if (!selectedCameraId && sortedCameras.length > 0) {
        setSelectedCameraId(sortedCameras[0].deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enumerate devices');
      console.error('Failed to enumerate webcam devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedCameraId]);

  // Enumerate devices on mount
  useEffect(() => {
    refreshDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  // Start webcam stream
  const startStream = useCallback(async (deviceId?: string) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setError(null);

    try {
      const cameraId = deviceId || selectedCameraId;
      const constraints: MediaStreamConstraints = {
        video: cameraId
          ? {
              deviceId: { exact: cameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);

      if (deviceId) {
        setSelectedCameraId(deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start webcam');
      console.error('Failed to start webcam stream:', err);
      setStream(null);
      streamRef.current = null;
    }
  }, [selectedCameraId]);

  // Stop webcam stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Select camera
  const selectCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    stream,
    cameras,
    selectedCameraId,
    isLoadingDevices,
    error,
    isStreaming: stream !== null,
    startStream,
    stopStream,
    selectCamera,
    refreshDevices,
  };
}

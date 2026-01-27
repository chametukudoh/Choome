import { useEffect, useRef, useState } from 'react';
import { useWebcam } from '../../hooks/useWebcam';
import { BubbleControls } from './BubbleControls';

type Shape = 'circle' | 'rounded' | 'square';
type Size = 'small' | 'medium' | 'large';

export function WebcamOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shape, setShape] = useState<Shape>('circle');
  const [size, setSize] = useState<Size>('medium');
  const [showControls, setShowControls] = useState(false);

  const { stream, cameras, selectedCameraId, startStream, selectCamera } = useWebcam();

  const updateWebcamSettings = async (
    updates: Partial<{ size: Size; shape: Shape; deviceId?: string | null }>
  ) => {
    const settings = await window.electronAPI?.getSettings();
    if (!settings) return;
    await window.electronAPI?.setSettings({
      webcam: {
        ...settings.webcam,
        ...updates,
      },
    });
  };

  // Load persisted webcam settings
  useEffect(() => {
    let isMounted = true;
    window.electronAPI?.getSettings().then((settings) => {
      if (!isMounted || !settings?.webcam) return;
      if (settings.webcam.shape) {
        setShape(settings.webcam.shape);
      }
      if (settings.webcam.size) {
        setSize(settings.webcam.size);
        window.electronAPI?.updateWebcamSize(settings.webcam.size);
      }
      if (settings.webcam.deviceId) {
        selectCamera(settings.webcam.deviceId);
        startStream(settings.webcam.deviceId);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Start webcam stream on mount
  useEffect(() => {
    startStream();
  }, [startStream]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle size change
  const handleSizeChange = (newSize: Size) => {
    setSize(newSize);
    window.electronAPI?.updateWebcamSize(newSize);
    updateWebcamSettings({ size: newSize });
  };

  const handleShapeChange = (newShape: Shape) => {
    setShape(newShape);
    updateWebcamSettings({ shape: newShape });
  };

  // Handle camera selection
  const handleCameraSelect = (deviceId: string) => {
    selectCamera(deviceId);
    startStream(deviceId);
    window.localStorage.setItem('choome:webcamDeviceId', deviceId);
    updateWebcamSettings({ deviceId });
  };

  // Get shape class
  const getShapeClass = () => {
    switch (shape) {
      case 'circle':
        return 'rounded-full';
      case 'rounded':
        return 'rounded-3xl';
      case 'square':
        return 'rounded-none';
      default:
        return 'rounded-full';
    }
  };

  return (
    <div
      className="drag-region relative w-full h-full flex items-center justify-center bg-transparent cursor-move"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video feed */}
      <div className={`relative w-full h-full overflow-hidden ${getShapeClass()} shadow-2xl`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Border/ring */}
        <div className={`absolute inset-0 border-4 border-white/20 ${getShapeClass()}`} />

        {/* Controls overlay */}
        {showControls && (
          <div
            className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity no-drag"
          >
            <BubbleControls
              shape={shape}
              size={size}
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onShapeChange={handleShapeChange}
              onSizeChange={handleSizeChange}
              onCameraSelect={handleCameraSelect}
              onClose={() => window.electronAPI?.closeWebcam()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { WebcamDevice } from '../../hooks/useWebcam';

type Shape = 'circle' | 'rounded' | 'square';
type Size = 'small' | 'medium' | 'large';

interface BubbleControlsProps {
  shape: Shape;
  size: Size;
  cameras: WebcamDevice[];
  selectedCameraId: string | null;
  onShapeChange: (shape: Shape) => void;
  onSizeChange: (size: Size) => void;
  onCameraSelect: (deviceId: string) => void;
  onClose: () => void;
}

export function BubbleControls({
  shape,
  size,
  cameras,
  selectedCameraId,
  onShapeChange,
  onSizeChange,
  onCameraSelect,
  onClose,
}: BubbleControlsProps) {
  const [showCameraPicker, setShowCameraPicker] = useState(false);

  return (
    <div
      data-no-drag
      className="no-drag pointer-events-auto flex flex-col gap-3 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Size controls */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => onSizeChange('small')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            size === 'small'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Small"
        >
          S
        </button>
        <button
          onClick={() => onSizeChange('medium')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            size === 'medium'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Medium"
        >
          M
        </button>
        <button
          onClick={() => onSizeChange('large')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            size === 'large'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Large"
        >
          L
        </button>
      </div>

      {/* Shape controls */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => onShapeChange('circle')}
          className={`p-2 rounded transition-colors ${
            shape === 'circle'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Circle"
        >
          <CircleIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onShapeChange('rounded')}
          className={`p-2 rounded transition-colors ${
            shape === 'rounded'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Rounded"
        >
          <RoundedIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onShapeChange('square')}
          className={`p-2 rounded transition-colors ${
            shape === 'square'
              ? 'bg-white text-black'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title="Square"
        >
          <SquareIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Camera selector */}
      {cameras.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowCameraPicker(!showCameraPicker)}
            className="w-full px-3 py-2 bg-white/20 text-white rounded text-xs hover:bg-white/30 transition-colors flex items-center gap-2"
          >
            <CameraIcon className="w-4 h-4" />
            <span className="flex-1 text-left truncate">
              {cameras.find((c) => c.deviceId === selectedCameraId)?.label || 'Select camera'}
            </span>
            <ChevronIcon className="w-3 h-3" />
          </button>

          {showCameraPicker && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-dark-800 rounded shadow-xl overflow-hidden">
              {cameras.map((camera) => (
                <button
                  key={camera.deviceId}
                  onClick={() => {
                    onCameraSelect(camera.deviceId);
                    setShowCameraPicker(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-dark-700 transition-colors ${
                    camera.deviceId === selectedCameraId
                      ? 'bg-primary-600 text-white'
                      : 'text-dark-200'
                  }`}
                >
                  {camera.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="px-3 py-2 bg-red-500/80 text-white rounded text-xs font-medium hover:bg-red-500 transition-colors"
      >
        Close Webcam
      </button>
    </div>
  );
}

// Icons
function CircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function RoundedIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="6" />
    </svg>
  );
}

function SquareIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" />
    </svg>
  );
}

function CameraIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

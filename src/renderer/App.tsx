import { useState, useEffect, useMemo, useRef } from 'react';
import { SourceSelector } from './components/SourceSelector';
import { RecordingControls, RecordingTimer } from './components/RecordingControls';
import { AudioControls } from './components/AudioControls';
import { WebcamOverlay } from './components/WebcamBubble';
import { DrawingOverlay } from './components/DrawingTools';
import { RecordingList } from './components/Library';
import { SettingsPage } from './components/Settings';
import { useRecordingStore } from './stores/recordingStore';
import type { AppSettings, DisplayInfo } from '../shared/types';

const CAMERA_SIZE_PRESETS: Record<NonNullable<AppSettings['webcam']>['size'], number> = {
  small: 150,
  medium: 250,
  large: 350,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type Tab = 'record' | 'library' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [windowType, setWindowType] = useState<'main' | 'webcam' | 'overlay'>('main');
  const [ffmpegProgress, setFfmpegProgress] = useState<number | null>(null);

  // Check which window type this is
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#/webcam') {
      setWindowType('webcam');
    } else if (hash === '#/overlay') {
      setWindowType('overlay');
    } else {
      setWindowType('main');
    }
  }, []);

  useEffect(() => {
    if (windowType !== 'main') {
      return;
    }

    const unsubscribe = window.electronAPI?.onFFmpegProgress((progress) => {
      if (progress >= 100) {
        setFfmpegProgress(100);
        setTimeout(() => setFfmpegProgress(null), 800);
      } else {
        setFfmpegProgress(progress);
      }
    });
    return () => unsubscribe?.();
  }, [windowType]);

  // Render appropriate component based on window type
  if (windowType === 'webcam') {
    return <WebcamOverlay />;
  }

  if (windowType === 'overlay') {
    return <DrawingOverlay />;
  }

  return (
    <div className="h-screen flex flex-col bg-dark-900">
      {/* Title bar / drag region */}
      <header className="drag-region h-10 flex items-center justify-between px-4 bg-dark-950 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-semibold text-white">Choome</span>
        </div>
        <div className="no-drag flex items-center gap-1">
          <button
            className="btn-icon text-dark-400 hover:text-white"
            onClick={() => window.electronAPI?.minimizeWindow()}
          >
            <MinimizeIcon />
          </button>
          <button
            className="btn-icon text-dark-400 hover:text-white"
            onClick={() => window.electronAPI?.maximizeWindow()}
          >
            <MaximizeIcon />
          </button>
          <button
            className="btn-icon text-dark-400 hover:text-red-500"
            onClick={() => window.electronAPI?.closeWindow()}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-16 bg-dark-950 border-r border-dark-800 flex flex-col items-center py-4 gap-2">
          <NavButton
            icon={<RecordIcon />}
            label="Record"
            active={activeTab === 'record'}
            onClick={() => setActiveTab('record')}
          />
          <NavButton
            icon={<LibraryIcon />}
            label="Library"
            active={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
          />
          <NavButton
            icon={<SettingsIcon />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'record' && <RecordPage />}
          {activeTab === 'library' && <LibraryPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
      {ffmpegProgress !== null && (
        <div className="h-2 bg-dark-800">
          <div
            className="h-full bg-primary-600 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, ffmpegProgress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Navigation button component
function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-dark-400 hover:bg-dark-800 hover:text-white'
      }`}
      title={label}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

// Record page
function RecordPage() {
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showPipPreview, setShowPipPreview] = useState(() => {
    const stored = window.localStorage.getItem('choome:showPipPreview');
    return stored ? stored === 'true' : true;
  });
  const [webcamSettings, setWebcamSettings] = useState<AppSettings['webcam'] | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const {
    status,
    selectedSource,
    includeWebcam,
    setSelectedSource,
    setIncludeWebcam,
  } = useRecordingStore();

  const isRecording = status === 'recording' || status === 'paused';
  const isProcessing = status === 'processing';
  const isBusy = isRecording || isProcessing;

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await window.electronAPI?.getSettings();
      if (settings?.webcam) {
        setWebcamSettings(settings.webcam);
      }
    };
    const loadDisplays = async () => {
      const loadedDisplays = await window.electronAPI?.getDisplays();
      if (loadedDisplays) {
        setDisplays(loadedDisplays as DisplayInfo[]);
      }
    };
    loadSettings();
    loadDisplays();
    const handleFocus = () => loadSettings();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    window.electronAPI?.getSettings().then((settings) => {
      if (settings?.webcam) {
        setWebcamSettings(settings.webcam);
      }
    });
  }, [selectedSource?.id]);


  useEffect(() => {
    window.localStorage.setItem('choome:showPipPreview', String(showPipPreview));
  }, [showPipPreview]);

  useEffect(() => {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const updateSize = () => {
      setPreviewSize({ width: element.clientWidth, height: element.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const activeDisplay = useMemo(() => {
    if (selectedSource?.display_id) {
      const match = displays.find((display) => String(display.id) === String(selectedSource.display_id));
      if (match) return match;
    }
    if (selectedSource?.name) {
      const match = selectedSource.name.match(/Screen\s+(\d+)/i);
      if (match) {
        const index = Math.max(0, Number(match[1]) - 1);
        if (displays[index]) {
          return displays[index];
        }
      }
    }
    return displays.find((display) => display.isPrimary) ?? displays[0];
  }, [displays, selectedSource?.display_id, selectedSource?.name]);

  const displayBounds = activeDisplay?.bounds ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const displayWidth = displayBounds.width || 1920;
  const displayHeight = displayBounds.height || 1080;
  const webcamSizeKey = webcamSettings?.size ?? 'medium';
  const webcamSize = CAMERA_SIZE_PRESETS[webcamSizeKey];

  const imageRect = useMemo(() => {
    if (!selectedSource?.thumbnail || !imageAspect || !previewSize.width || !previewSize.height) {
      return { x: 0, y: 0, width: previewSize.width, height: previewSize.height };
    }
    const containerAspect = previewSize.width / previewSize.height;
    if (imageAspect > containerAspect) {
      const width = previewSize.width;
      const height = width / imageAspect;
      return { x: 0, y: (previewSize.height - height) / 2, width, height };
    }
    const height = previewSize.height;
    const width = height * imageAspect;
    return { x: (previewSize.width - width) / 2, y: 0, width, height };
  }, [imageAspect, previewSize.width, previewSize.height, selectedSource?.thumbnail]);

  const previewBaseRect = selectedSource?.thumbnail
    ? imageRect
    : { x: 0, y: 0, width: previewSize.width, height: previewSize.height };

  const previewPipWidth = previewBaseRect.width
    ? Math.max(24, Math.round((webcamSize / displayWidth) * previewBaseRect.width))
    : 0;
  const previewPipHeight = previewBaseRect.height
    ? Math.max(24, Math.round((webcamSize / displayHeight) * previewBaseRect.height))
    : 0;
  const previewMaxX = Math.max(0, previewBaseRect.width - previewPipWidth);
  const previewMaxY = Math.max(0, previewBaseRect.height - previewPipHeight);
  const storedSourcePosition = selectedSource?.id
    ? webcamSettings?.positionBySource?.[selectedSource.id]
    : undefined;
  const previewPipLeft = previewBaseRect.width
    ? (dragPosition?.x ?? (storedSourcePosition ? Math.round(storedSourcePosition.x * previewMaxX) : 0)) + previewBaseRect.x
    : 0;
  const previewPipTop = previewBaseRect.height
    ? (dragPosition?.y ?? (storedSourcePosition ? Math.round(storedSourcePosition.y * previewMaxY) : 0)) + previewBaseRect.y
    : 0;

  useEffect(() => {
    if (!selectedSource?.id || !dragPosition) return;
    if (previewMaxX === 0 || previewMaxY === 0) return;
    const ratioX = clamp(dragPosition.x / previewMaxX, 0, 1);
    const ratioY = clamp(dragPosition.y / previewMaxY, 0, 1);
    applySourcePosition(ratioX, ratioY);
    setDragPosition(null);
    dragPositionRef.current = null;
  }, [selectedSource?.id, dragPosition, previewMaxX, previewMaxY]);

  const applySourcePosition = async (ratioX: number, ratioY: number) => {
    if (!webcamSettings || !selectedSource?.id) return;
    const updatedWebcam: AppSettings['webcam'] = {
      ...webcamSettings,
      positionBySource: {
        ...(webcamSettings.positionBySource ?? {}),
        [selectedSource.id]: { x: ratioX, y: ratioY },
      },
    };
    await window.electronAPI?.setSettings({ webcam: updatedWebcam });
    setWebcamSettings(updatedWebcam);
  };

  const handlePipPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewRef.current || !pipRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const pipRect = pipRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - pipRect.left,
      y: event.clientY - pipRect.top,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!previewRef.current) return;
      const previewRect = previewRef.current.getBoundingClientRect();
      const maxX = Math.max(0, previewBaseRect.width - previewPipWidth);
      const maxY = Math.max(0, previewBaseRect.height - previewPipHeight);
      const nextX = clamp(
        moveEvent.clientX - previewRect.left - previewBaseRect.x - dragOffsetRef.current.x,
        0,
        maxX
      );
      const nextY = clamp(
        moveEvent.clientY - previewRect.top - previewBaseRect.y - dragOffsetRef.current.y,
        0,
        maxY
      );
      const next = { x: nextX, y: nextY };
      dragPositionRef.current = next;
      setDragPosition(next);
      if (selectedSource?.id) {
        const ratioX = previewMaxX ? next.x / previewMaxX : 0;
        const ratioY = previewMaxY ? next.y / previewMaxY : 0;
        window.dispatchEvent(new CustomEvent('webcam:position', { detail: { x: ratioX, y: ratioY } }));
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      const finalPosition = dragPositionRef.current ?? dragPosition;
      if (!selectedSource?.id) {
        if (finalPosition) {
          setDragPosition(finalPosition);
          dragPositionRef.current = finalPosition;
        }
        return;
      }
      if (finalPosition) {
        const ratioX = previewMaxX ? finalPosition.x / previewMaxX : 0;
        const ratioY = previewMaxY ? finalPosition.y / previewMaxY : 0;
        applySourcePosition(ratioX, ratioY);
        window.dispatchEvent(new CustomEvent('webcam:position', { detail: { x: ratioX, y: ratioY } }));
      }
      setDragPosition(null);
      dragPositionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Set up keyboard shortcut listeners
  useEffect(() => {
    // Import the useRecording hook functionality - we'll need to handle this
    const handleStartStop = () => {
      // This will be handled by RecordingControls component
      const event = new CustomEvent('shortcut:startStop');
      window.dispatchEvent(event);
    };

    const handlePause = () => {
      const event = new CustomEvent('shortcut:pause');
      window.dispatchEvent(event);
    };

    const handleDrawing = async () => {
      const isVisible = await window.electronAPI?.isOverlayVisible();
      if (isVisible) {
        await window.electronAPI?.closeOverlay();
      } else {
        await window.electronAPI?.openOverlay();
      }
    };

    const unsubStartStop = window.electronAPI?.onShortcutStartStop(handleStartStop);
    const unsubPause = window.electronAPI?.onShortcutPause(handlePause);
    const unsubDrawing = window.electronAPI?.onShortcutDrawing(handleDrawing);

    return () => {
      unsubStartStop?.();
      unsubPause?.();
      unsubDrawing?.();
    };
  }, []);

  // Handle webcam toggle
  const handleWebcamToggle = async () => {
    const newState = !includeWebcam;
    setIncludeWebcam(newState);

    if (newState) {
      // Open webcam window
      await window.electronAPI?.openWebcam();
    } else {
      // Close webcam window
      await window.electronAPI?.closeWebcam();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">
          {isProcessing
            ? 'Saving Recording'
            : isRecording
            ? 'Recording in Progress'
            : 'Ready to Record'}
        </h1>
        <p className="text-dark-400">
          {isProcessing
            ? 'Finalizing and saving your recording...'
            : selectedSource
            ? `Selected: ${selectedSource.name}`
            : 'Select a screen or window to begin'}
        </p>
      </div>

      {/* Source preview */}
      <button
        onClick={() => !isBusy && setShowSourceSelector(true)}
        disabled={isBusy}
        className={`card w-full max-w-2xl aspect-video flex items-center justify-center overflow-hidden ${
          isBusy
            ? 'cursor-default'
            : 'cursor-pointer hover:border-primary-500 transition-colors border-2 border-dashed border-dark-600'
        }`}
      >
        <div ref={previewRef} className="relative w-full h-full">
          {selectedSource?.thumbnail ? (
            <img
              src={selectedSource.thumbnail}
              alt={selectedSource.name}
              className="w-full h-full object-contain bg-dark-950"
              onLoad={(event) => {
                const target = event.currentTarget;
                if (target.naturalWidth && target.naturalHeight) {
                  setImageAspect(target.naturalWidth / target.naturalHeight);
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-500">
              <ScreenIcon className="w-16 h-16 mb-2" />
              <p>Click to select screen or window</p>
            </div>
          )}
          {includeWebcam && showPipPreview && webcamSettings && previewPipWidth > 0 && previewPipHeight > 0 && (
            <div
              ref={pipRef}
              onPointerDown={handlePipPointerDown}
              onClick={(event) => event.stopPropagation()}
              className="absolute border-2 border-white/60 bg-white/10 backdrop-blur-[2px] shadow-lg rounded-2xl cursor-move"
              style={{
                left: previewPipLeft,
                top: previewPipTop,
                width: previewPipWidth,
                height: previewPipHeight,
              }}
            >
              <div className="absolute inset-x-0 bottom-1 text-center text-[10px] text-white/80">
                Drag to position
              </div>
            </div>
          )}
          {selectedSource?.thumbnail && isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-dark-900/80 px-3 py-1 rounded-full">
              <RecordingTimer />
            </div>
          )}
          {selectedSource?.thumbnail && !isBusy && (
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium">
                Change Source
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Recording controls */}
      <RecordingControls />

      {/* Quick settings bar */}
      <div className="flex items-center gap-4 text-sm">
        {/* Audio controls (compact mode) */}
        <AudioControls compact disabled={isBusy} />

        {/* Webcam toggle */}
        <button
          onClick={handleWebcamToggle}
          disabled={isBusy}
          className={`p-2 rounded-lg transition-colors ${
            isBusy
              ? 'opacity-50 cursor-not-allowed'
              : includeWebcam
              ? 'bg-primary-600/20 text-primary-400 hover:bg-primary-600/30'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title={includeWebcam ? 'Disable webcam' : 'Enable webcam'}
        >
          <CameraIcon className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowPipPreview((prev) => !prev)}
          disabled={isBusy || !includeWebcam}
          className={`px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${
            isBusy || !includeWebcam
              ? 'opacity-50 cursor-not-allowed bg-dark-800 text-dark-500'
              : showPipPreview
              ? 'bg-primary-600/20 text-primary-300 hover:bg-primary-600/30'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title={showPipPreview ? 'Hide PiP preview' : 'Show PiP preview'}
        >
          PiP
        </button>
        {!isBusy && includeWebcam && (
          <div className="relative group">
            <InfoIcon className="w-4 h-4 text-dark-500 group-hover:text-dark-300" />
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 rounded-md bg-dark-800 px-2 py-1 text-[11px] text-dark-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Toggle the PiP preview overlay on the source preview.
            </div>
          </div>
        )}

        {/* Audio settings button */}
        <button
          onClick={() => setShowAudioPanel(!showAudioPanel)}
          disabled={isBusy}
          className={`p-2 rounded-lg transition-colors ${
            isBusy
              ? 'opacity-50 cursor-not-allowed'
              : showAudioPanel
              ? 'bg-primary-600/20 text-primary-400'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="Audio settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Expanded audio panel */}
      {showAudioPanel && !isBusy && (
        <div className="w-full max-w-md">
          <AudioControls disabled={isBusy} />
        </div>
      )}

      {/* Source selector modal */}
      <SourceSelector
        isOpen={showSourceSelector}
        onClose={() => setShowSourceSelector(false)}
        onSelect={setSelectedSource}
      />
    </div>
  );
}

// Library page
function LibraryPage() {
  return <RecordingList />;
}

// Icons
function MinimizeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7h.01" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function LibraryIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ScreenIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8M12 17v4" />
    </svg>
  );
}

function CameraIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

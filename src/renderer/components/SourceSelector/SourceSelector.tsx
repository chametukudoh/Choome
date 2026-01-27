import { useState, useEffect } from 'react';
import { useRecordingStore } from '../../stores/recordingStore';
import type { SourceInfo, DisplayInfo } from '../../../shared/types';

interface SourceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (source: SourceInfo) => void;
}

export function SourceSelector({ isOpen, onClose, onSelect }: SourceSelectorProps) {
  const { availableSources, setAvailableSources } = useRecordingStore();
  const [filter, setFilter] = useState<'all' | 'screens' | 'windows'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string | null>(null);
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo[]>([]);
  const [frameRate, setFrameRate] = useState<number | null>(null);

  // Listen for debug logs from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onDebugLog((log) => {
      console.log('=== Debug log from main process ===\n', log);
      setDebugLog(log);
    });
    return unsubscribe;
  }, []);

  // Fetch sources when modal opens
  useEffect(() => {
    if (isOpen) {
      setDebugLog(null);
      fetchSources();
      fetchDisplays();
      fetchSettings();
    }
  }, [isOpen]);

  const fetchDisplays = async () => {
    try {
      const displays = await window.electronAPI.getDisplays();
      setDisplayInfo(displays as DisplayInfo[]);
    } catch (err) {
      console.error('Failed to fetch displays:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      if (settings?.frameRate) {
        setFrameRate(settings.frameRate);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchSources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Fetching sources from renderer...');
      const sources = await window.electronAPI.getSources();
      console.log('Received sources:', sources);
      setAvailableSources(sources as SourceInfo[]);
      if (sources.length === 0) {
        setError('No screen or window sources detected. Check DevTools console for details.');
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sources');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSources = availableSources.filter((source) => {
    if (filter === 'all') return true;
    if (filter === 'screens') return source.id.startsWith('screen:');
    if (filter === 'windows') return source.id.startsWith('window:');
    return true;
  });

  const screens = availableSources.filter((s) => s.id.startsWith('screen:'));
  const windows = availableSources.filter((s) => s.id.startsWith('window:'));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-4xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold">Select Screen or Window</h2>
          <button
            onClick={onClose}
            className="btn-icon text-dark-400 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 p-4 border-b border-dark-700">
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={`All (${availableSources.length})`}
          />
          <FilterTab
            active={filter === 'screens'}
            onClick={() => setFilter('screens')}
            label={`Screens (${screens.length})`}
          />
          <FilterTab
            active={filter === 'windows'}
            onClick={() => setFilter('windows')}
            label={`Windows (${windows.length})`}
          />
          <button
            onClick={fetchSources}
            className="ml-auto btn btn-secondary text-sm flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Sources grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-dark-400">Loading sources...</div>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="text-dark-400 mb-2">No sources found</div>
              {error && (
                <div className="text-red-400 text-sm mb-4 max-w-md">{error}</div>
              )}
              <p className="text-dark-500 text-sm max-w-md mb-4">
                If this issue persists, try restarting the application or check if any security software is blocking screen capture.
              </p>
              <button
                onClick={fetchSources}
                className="btn btn-primary text-sm mb-4"
              >
                Try Again
              </button>
              {debugLog && (
                <div className="mt-4 w-full max-w-2xl text-left">
                  <div className="text-dark-400 text-xs mb-2">Debug Log (Main Process):</div>
                  <pre className="bg-dark-950 p-3 rounded text-xs text-dark-300 overflow-auto max-h-48 whitespace-pre-wrap">
                    {debugLog}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  displayInfo={displayInfo}
                  frameRate={frameRate}
                  onClick={() => {
                    onSelect(source);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function SourceCard({
  source,
  displayInfo,
  frameRate,
  onClick,
}: {
  source: SourceInfo;
  displayInfo: DisplayInfo[];
  frameRate: number | null;
  onClick: () => void;
}) {
  const isScreen = source.id.startsWith('screen:');
  const display = source.display_id
    ? displayInfo.find((d) => String(d.id) === String(source.display_id))
    : undefined;
  const resolution = display ? `${display.width}×${display.height}` : null;
  const scaleLabel = display ? `${display.scaleFactor}x` : null;

  return (
    <button
      onClick={onClick}
      className="group card p-2 hover:border-primary-500 transition-colors text-left"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-dark-900 rounded-lg overflow-hidden mb-2">
        {source.thumbnail ? (
          <img
            src={source.thumbnail}
            alt={source.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-dark-500">
            {isScreen ? <ScreenIcon className="w-12 h-12" /> : <WindowIcon className="w-12 h-12" />}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            Select
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2">
        {source.appIcon ? (
          <img src={source.appIcon} alt="" className="w-4 h-4" />
        ) : isScreen ? (
          <ScreenIcon className="w-4 h-4 text-dark-400" />
        ) : (
          <WindowIcon className="w-4 h-4 text-dark-400" />
        )}
        <span className="text-sm text-white truncate flex-1">{source.name}</span>
      </div>
      {(resolution || frameRate) && (
        <div className="text-xs text-dark-400 mt-1">
          {resolution && <span>{resolution}</span>}
          {scaleLabel && <span className="ml-2">{scaleLabel}</span>}
          {frameRate && <span className="ml-2">{frameRate} fps</span>}
        </div>
      )}
    </button>
  );
}

// Icons
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
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

function WindowIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="9" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

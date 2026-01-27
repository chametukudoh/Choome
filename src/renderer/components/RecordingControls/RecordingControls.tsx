import { useEffect } from 'react';
import { useRecordingStore } from '../../stores/recordingStore';
import { useRecording } from '../../hooks/useRecording';

export function RecordingControls() {
  const { status, selectedSource, duration } = useRecordingStore();
  const { startRecording, stopRecording, pauseRecording, resumeRecording } = useRecording();

  const isIdle = status === 'idle';
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isProcessing = status === 'processing';
  const canStart = isIdle && selectedSource !== null;

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleStartStopShortcut = () => {
      if (isIdle && canStart) {
        startRecording();
      } else if (isRecording || isPaused) {
        stopRecording();
      }
    };

    const handlePauseShortcut = () => {
      if (isRecording) {
        pauseRecording();
      } else if (isPaused) {
        resumeRecording();
      }
    };

    window.addEventListener('shortcut:startStop', handleStartStopShortcut);
    window.addEventListener('shortcut:pause', handlePauseShortcut);

    return () => {
      window.removeEventListener('shortcut:startStop', handleStartStopShortcut);
      window.removeEventListener('shortcut:pause', handlePauseShortcut);
    };
  }, [isIdle, isRecording, isPaused, canStart, startRecording, stopRecording, pauseRecording, resumeRecording]);

  return (
    <div className="flex items-center gap-4">
      {isIdle ? (
        // Start button
        <button
          onClick={startRecording}
          disabled={!canStart}
          className={`btn px-8 py-3 text-lg flex items-center gap-2 ${
            canStart
              ? 'btn-primary'
              : 'bg-dark-700 text-dark-500 cursor-not-allowed'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-white" />
          Start Recording
        </button>
      ) : isProcessing ? (
        <button
          disabled
          className="btn px-8 py-3 text-lg flex items-center gap-3 bg-dark-700 text-dark-300 cursor-not-allowed"
        >
          <div className="w-4 h-4 border-2 border-dark-300 border-t-transparent rounded-full animate-spin" />
          Saving...
        </button>
      ) : (
        // Recording controls
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-800 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 recording-indicator' : 'bg-yellow-500'}`} />
            <span className="font-mono text-lg font-medium">{formatDuration(duration)}</span>
          </div>

          {/* Pause/Resume button */}
          <button
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="btn btn-secondary p-3"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </button>

          {/* Stop button */}
          <button
            onClick={stopRecording}
            className="btn btn-danger p-3"
            title="Stop Recording"
          >
            <StopIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// Timer component for display in other places
export function RecordingTimer() {
  const { status, duration } = useRecordingStore();

  if (status === 'idle' || status === 'processing') return null;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-red-500 recording-indicator' : 'bg-yellow-500'}`} />
      <span className="font-mono text-sm">{formatDuration(duration)}</span>
    </div>
  );
}

// Helper to format duration as MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Icons
function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

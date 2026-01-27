import { useEffect, useCallback } from 'react';
import { MicrophoneSelector } from './MicrophoneSelector';
import { VolumeIndicator, AudioLevelMeter } from './VolumeIndicator';
import { useMediaDevices } from '../../hooks/useMediaDevices';
import { useRecordingStore } from '../../stores/recordingStore';

interface AudioControlsProps {
  disabled?: boolean;
  compact?: boolean;
}

export function AudioControls({ disabled = false, compact = false }: AudioControlsProps) {
  const {
    includeMicrophone,
    includeSystemAudio,
    selectedMicrophoneId,
    microphoneMuted,
    systemAudioMuted,
    systemAudioAvailable,
    setIncludeMicrophone,
    setIncludeSystemAudio,
    setSelectedMicrophoneId,
    setMicrophoneMuted,
    setSystemAudioMuted,
  } = useRecordingStore();

  const isWindows = navigator.userAgent.toLowerCase().includes('windows');
  const systemAudioSupported = isWindows;

  const {
    microphoneLevel,
    startMicrophoneMonitor,
    stopMicrophoneMonitor,
  } = useMediaDevices();

  // Start/stop microphone monitoring when enabled
  useEffect(() => {
    if (includeMicrophone && !microphoneMuted && selectedMicrophoneId) {
      startMicrophoneMonitor(selectedMicrophoneId);
    } else {
      stopMicrophoneMonitor();
    }

    return () => {
      stopMicrophoneMonitor();
    };
  }, [includeMicrophone, microphoneMuted, selectedMicrophoneId, startMicrophoneMonitor, stopMicrophoneMonitor]);

  const handleMicrophoneSelect = useCallback((deviceId: string) => {
    setSelectedMicrophoneId(deviceId);
  }, [setSelectedMicrophoneId]);

  const handleMicrophoneToggle = useCallback((enabled: boolean) => {
    setIncludeMicrophone(enabled);
    if (!enabled) {
      setMicrophoneMuted(false);
    }
  }, [setIncludeMicrophone, setMicrophoneMuted]);

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {/* Microphone toggle with level meter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleMicrophoneToggle(!includeMicrophone)}
            disabled={disabled}
            className={`p-2 rounded-lg transition-colors ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : includeMicrophone
                ? 'bg-primary-600/20 text-primary-400 hover:bg-primary-600/30'
                : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={includeMicrophone ? 'Disable microphone' : 'Enable microphone'}
          >
            {microphoneMuted ? (
              <MicMutedIcon className="w-5 h-5" />
            ) : (
              <MicIcon className="w-5 h-5" />
            )}
          </button>
          {includeMicrophone && (
            <AudioLevelMeter level={microphoneLevel} bars={6} muted={microphoneMuted} />
          )}
        </div>

        {/* System audio toggle */}
        <button
          onClick={() => setIncludeSystemAudio(!includeSystemAudio)}
          disabled={disabled || !systemAudioSupported}
          className={`p-2 rounded-lg transition-colors ${
            disabled || !systemAudioSupported
              ? 'opacity-50 cursor-not-allowed'
              : includeSystemAudio
              ? 'bg-primary-600/20 text-primary-400 hover:bg-primary-600/30'
              : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title={
            !systemAudioSupported
              ? 'System audio capture is not available on this platform'
              : includeSystemAudio
              ? 'Disable system audio'
              : 'Enable system audio'
          }
        >
          {systemAudioMuted ? (
            <SpeakerMutedIcon className="w-5 h-5" />
          ) : (
            <SpeakerIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Microphone section */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <MicIcon className="w-4 h-4 text-dark-400" />
            Microphone
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMicrophone}
              onChange={(e) => handleMicrophoneToggle(e.target.checked)}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-xs text-dark-400">Enable</span>
          </label>
        </div>

        {includeMicrophone && (
          <div className="space-y-3">
            <MicrophoneSelector
              selectedDeviceId={selectedMicrophoneId}
              onDeviceSelect={handleMicrophoneSelect}
              disabled={disabled}
            />

            <VolumeIndicator
              level={microphoneLevel}
              label="Input level"
              muted={microphoneMuted}
              onMuteToggle={() => setMicrophoneMuted(!microphoneMuted)}
            />
          </div>
        )}
      </div>

      {/* System Audio section */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <SpeakerIcon className="w-4 h-4 text-dark-400" />
            System Audio
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSystemAudio}
              onChange={(e) => setIncludeSystemAudio(e.target.checked)}
              disabled={disabled || !systemAudioSupported}
              className="rounded"
            />
            <span className="text-xs text-dark-400">Enable</span>
          </label>
        </div>

        {!systemAudioSupported ? (
          <p className="text-xs text-dark-500">
            System audio capture is not available on this platform.
          </p>
        ) : includeSystemAudio ? (
          <div className="flex items-center justify-between">
            <div className="text-xs text-dark-500">
              <div>Records audio from your computer (music, videos, etc.)</div>
              {systemAudioAvailable === false && (
                <div className="text-red-400 mt-1">System audio not available for this source.</div>
              )}
            </div>
            <button
              onClick={() => setSystemAudioMuted(!systemAudioMuted)}
              disabled={disabled}
              className={`p-2 rounded-lg transition-colors ${
                systemAudioMuted
                  ? 'bg-red-600/20 text-red-400'
                  : 'bg-dark-700 text-dark-400 hover:text-white'
              }`}
            >
              {systemAudioMuted ? (
                <SpeakerMutedIcon className="w-4 h-4" />
              ) : (
                <SpeakerIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Export individual components for flexible usage
export { MicrophoneSelector } from './MicrophoneSelector';
export { SystemAudioToggle } from './SystemAudioToggle';
export { VolumeIndicator, AudioLevelMeter } from './VolumeIndicator';

// Icons
function MicIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicMutedIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3l18 18"
      />
    </svg>
  );
}

function SpeakerIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function SpeakerMutedIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}

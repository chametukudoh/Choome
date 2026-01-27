import { useEffect, useState } from 'react';
import { useMediaDevices } from '../../hooks/useMediaDevices';

interface MicrophoneSelectorProps {
  selectedDeviceId: string | null;
  onDeviceSelect: (deviceId: string) => void;
  disabled?: boolean;
}

export function MicrophoneSelector({
  selectedDeviceId,
  onDeviceSelect,
  disabled = false,
}: MicrophoneSelectorProps) {
  const { microphones, isLoadingDevices, error, refreshDevices } = useMediaDevices();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-select first microphone if none selected
  useEffect(() => {
    if (!selectedDeviceId && microphones.length > 0) {
      onDeviceSelect(microphones[0].deviceId);
    }
  }, [microphones, selectedDeviceId, onDeviceSelect]);

  const selectedMic = microphones.find((m) => m.deviceId === selectedDeviceId);

  return (
    <div className="relative">
      <label className="block text-xs text-dark-400 mb-1">Microphone</label>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg border border-dark-700 text-left text-sm ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-dark-600 cursor-pointer'
        }`}
      >
        <MicIcon className="w-4 h-4 text-dark-400 flex-shrink-0" />
        <span className="flex-1 truncate">
          {isLoadingDevices
            ? 'Loading...'
            : selectedMic?.label || 'Select microphone'}
        </span>
        <ChevronIcon className={`w-4 h-4 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden">
            {error ? (
              <div className="px-3 py-2 text-sm text-red-400">{error}</div>
            ) : microphones.length === 0 ? (
              <div className="px-3 py-2 text-sm text-dark-400">
                No microphones found
              </div>
            ) : (
              <ul className="max-h-48 overflow-auto">
                {microphones.map((mic) => (
                  <li key={mic.deviceId}>
                    <button
                      onClick={() => {
                        onDeviceSelect(mic.deviceId);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-700 ${
                        mic.deviceId === selectedDeviceId
                          ? 'bg-primary-600/20 text-primary-400'
                          : 'text-white'
                      }`}
                    >
                      <MicIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{mic.label}</span>
                      {mic.deviceId === selectedDeviceId && (
                        <CheckIcon className="w-4 h-4 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-dark-700">
              <button
                onClick={() => {
                  refreshDevices();
                }}
                className="w-full px-3 py-2 text-sm text-dark-400 hover:text-white hover:bg-dark-700 flex items-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                Refresh devices
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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

function ChevronIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RefreshIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

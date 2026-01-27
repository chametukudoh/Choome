interface SystemAudioToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export function SystemAudioToggle({
  enabled,
  onToggle,
  disabled = false,
}: SystemAudioToggleProps) {
  return (
    <div>
      <label className="block text-xs text-dark-400 mb-1">System Audio</label>
      <button
        onClick={() => !disabled && onToggle(!enabled)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-3 py-2 bg-dark-800 rounded-lg border text-left text-sm transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-dark-700'
            : enabled
            ? 'border-primary-500 bg-primary-600/10'
            : 'border-dark-700 hover:border-dark-600 cursor-pointer'
        }`}
      >
        <div
          className={`relative w-10 h-6 rounded-full transition-colors ${
            enabled ? 'bg-primary-600' : 'bg-dark-600'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? 'left-5' : 'left-1'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <SpeakerIcon className={`w-4 h-4 ${enabled ? 'text-primary-400' : 'text-dark-400'}`} />
          <span className={enabled ? 'text-white' : 'text-dark-300'}>
            {enabled ? 'System audio enabled' : 'System audio disabled'}
          </span>
        </div>
      </button>
      <p className="text-xs text-dark-500 mt-1">
        Captures audio from your computer (WASAPI loopback)
      </p>
    </div>
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

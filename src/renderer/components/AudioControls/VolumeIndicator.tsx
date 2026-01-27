import { useEffect, useRef } from 'react';

interface VolumeIndicatorProps {
  level: number; // 0-100
  label?: string;
  showValue?: boolean;
  muted?: boolean;
  onMuteToggle?: () => void;
  variant?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

export function VolumeIndicator({
  level,
  label,
  showValue = false,
  muted = false,
  onMuteToggle,
  variant = 'horizontal',
  size = 'md',
}: VolumeIndicatorProps) {
  const barRef = useRef<HTMLDivElement>(null);

  // Smooth animation for level changes
  useEffect(() => {
    if (barRef.current) {
      const clampedLevel = Math.max(0, Math.min(100, level));
      if (variant === 'horizontal') {
        barRef.current.style.width = `${clampedLevel}%`;
      } else {
        barRef.current.style.height = `${clampedLevel}%`;
      }
    }
  }, [level, variant]);

  // Get color based on level
  const getBarColor = () => {
    if (muted) return 'bg-dark-600';
    if (level > 85) return 'bg-red-500';
    if (level > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const sizeClasses = {
    sm: variant === 'horizontal' ? 'h-1' : 'w-1 h-16',
    md: variant === 'horizontal' ? 'h-2' : 'w-2 h-24',
    lg: variant === 'horizontal' ? 'h-3' : 'w-3 h-32',
  };

  if (variant === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`relative bg-dark-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
          <div
            ref={barRef}
            className={`absolute bottom-0 left-0 w-full transition-all duration-75 rounded-full ${getBarColor()}`}
            style={{ height: `${muted ? 0 : level}%` }}
          />
        </div>
        {label && <span className="text-xs text-dark-400">{label}</span>}
        {showValue && (
          <span className="text-xs font-mono text-dark-300">
            {muted ? 'Muted' : `${Math.round(level)}%`}
          </span>
        )}
        {onMuteToggle && (
          <button
            onClick={onMuteToggle}
            className={`p-1 rounded transition-colors ${
              muted ? 'text-red-400 hover:text-red-300' : 'text-dark-400 hover:text-white'
            }`}
          >
            {muted ? <MutedIcon className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {onMuteToggle && (
        <button
          onClick={onMuteToggle}
          className={`p-1 rounded transition-colors ${
            muted ? 'text-red-400 hover:text-red-300' : 'text-dark-400 hover:text-white'
          }`}
        >
          {muted ? <MutedIcon className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
        </button>
      )}
      <div className="flex-1">
        {label && <span className="text-xs text-dark-400 block mb-1">{label}</span>}
        <div className={`relative bg-dark-700 rounded-full overflow-hidden ${sizeClasses[size]} w-full`}>
          <div
            ref={barRef}
            className={`absolute top-0 left-0 h-full transition-all duration-75 rounded-full ${getBarColor()}`}
            style={{ width: `${muted ? 0 : level}%` }}
          />
        </div>
      </div>
      {showValue && (
        <span className="text-xs font-mono text-dark-300 w-10 text-right">
          {muted ? 'Muted' : `${Math.round(level)}%`}
        </span>
      )}
    </div>
  );
}

// Multi-bar meter (like VU meter)
interface AudioLevelMeterProps {
  level: number; // 0-100
  bars?: number;
  muted?: boolean;
}

export function AudioLevelMeter({ level, bars = 10, muted = false }: AudioLevelMeterProps) {
  const activeBarCount = Math.round((level / 100) * bars);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = !muted && i < activeBarCount;
        let barColor = 'bg-green-500';
        if (i >= bars * 0.6 && i < bars * 0.85) barColor = 'bg-yellow-500';
        if (i >= bars * 0.85) barColor = 'bg-red-500';

        return (
          <div
            key={i}
            className={`w-1.5 h-4 rounded-sm transition-colors duration-75 ${
              isActive ? barColor : 'bg-dark-700'
            }`}
          />
        );
      })}
    </div>
  );
}

// Icons
function VolumeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function MutedIcon({ className = 'w-5 h-5' }: { className?: string }) {
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

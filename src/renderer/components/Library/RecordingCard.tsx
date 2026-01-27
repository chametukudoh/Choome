import type { Recording } from '../../../shared/types';
import { toMediaUrl } from '../../utils/mediaUrl';

interface RecordingCardProps {
  recording: Recording;
  onPlay: (recording: Recording) => void;
  onEdit: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onReveal: (id: string) => void;
}

export function RecordingCard({
  recording,
  onPlay,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  onReveal,
}: RecordingCardProps) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="card group overflow-hidden hover:border-primary-500 transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-dark-950 overflow-hidden">
        {recording.thumbnailPath ? (
          <img
            src={toMediaUrl(recording.thumbnailPath)}
            alt={recording.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoIcon className="w-16 h-16 text-dark-600" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {recording.deletedAt ? (
            <>
              <button
                onClick={() => onRestore(recording.id)}
                className="p-3 bg-primary-600 rounded-full hover:bg-primary-500 transition-colors"
                title="Restore"
              >
                <RestoreIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => onPurge(recording.id)}
                className="p-3 bg-red-600 rounded-full hover:bg-red-500 transition-colors"
                title="Delete Permanently"
              >
                <DeleteIcon className="w-6 h-6 text-white" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onPlay(recording)}
                className="p-3 bg-primary-600 rounded-full hover:bg-primary-500 transition-colors"
                title="Play"
              >
                <PlayIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => onEdit(recording)}
                className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors"
                title="Edit"
              >
                <EditIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => onReveal(recording.id)}
                className="p-3 bg-dark-600 rounded-full hover:bg-dark-500 transition-colors"
                title="Show in Folder"
              >
                <FolderIcon className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => onDelete(recording.id)}
                className="p-3 bg-red-600 rounded-full hover:bg-red-500 transition-colors"
                title="Move to Trash"
              >
                <TrashIcon className="w-6 h-6 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-mono text-white">
          {formatDuration(recording.duration)}
        </div>

        {/* Quality badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white">
          {recording.quality}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate mb-1" title={recording.name}>
          {recording.name}
        </h3>
        <div className="flex items-center justify-between text-xs text-dark-400">
          <span>{formatDate(recording.createdAt)}</span>
          <span>{formatFileSize(recording.fileSize)}</span>
        </div>
        {recording.deletedAt && (
          <div className="text-xs text-red-400 mt-1">In Trash</div>
        )}
      </div>
    </div>
  );
}

// Icons
function VideoIcon({ className = 'w-5 h-5' }: { className?: string }) {
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

function PlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function EditIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function DeleteIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function TrashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function RestoreIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12a9 9 0 1115.364 5.364M3 12H7m-4 0l3-3m-3 3l3 3"
      />
    </svg>
  );
}

function FolderIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

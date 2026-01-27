import { useState, useEffect } from 'react';
import { RecordingCard } from './RecordingCard';
import { VideoPlayer } from './VideoPlayer';
import { VideoEditor } from '../VideoEditor';
import type { Recording } from '../../../shared/types';

export function RecordingList() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'duration'>('date');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  // Load recordings
  useEffect(() => {
    loadRecordings();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onRecordingSaved((recording) => {
      setRecordings((prev) => {
        if (prev.find((r) => r.id === recording.id)) {
          return prev;
        }
        return [recording, ...prev];
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const loadRecordings = async () => {
    setIsLoading(true);
    try {
      const data = await window.electronAPI.getRecordings();
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort recordings
  const filteredRecordings = recordings
    .filter((recording) => (showTrash ? recording.deletedAt : !recording.deletedAt))
    .filter((recording) =>
      recording.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'duration':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

  // Handle delete
  const handleDelete = async (id: string) => {
    const recording = recordings.find((r) => r.id === id);
    if (!recording) return;

    const confirmed = confirm(`Move "${recording.name}" to Trash?`);
    if (!confirmed) return;

    try {
      await window.electronAPI.deleteRecording(id);
      setRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r))
      );

      // Close player if deleted recording is currently playing
      if (selectedRecording?.id === id) {
        setSelectedRecording(null);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      alert('Failed to delete recording');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await window.electronAPI.restoreRecording(id);
      setRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, deletedAt: null } : r))
      );
    } catch (error) {
      console.error('Failed to restore recording:', error);
      alert('Failed to restore recording');
    }
  };

  const handlePurge = async (id: string) => {
    const recording = recordings.find((r) => r.id === id);
    if (!recording) return;
    const confirmed = confirm(`Permanently delete "${recording.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await window.electronAPI.purgeRecording(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Failed to purge recording:', error);
      alert('Failed to delete recording');
    }
  };

  const handleReveal = async (id: string) => {
    await window.electronAPI.revealRecording(id);
  };

  // Handle play
  const handlePlay = (recording: Recording) => {
    setSelectedRecording(recording);
  };

  // Handle edit
  const handleEdit = (recording: Recording) => {
    setEditingRecording(recording);
  };

  // Handle save edited recording
  const handleSaveEdit = async () => {
    await loadRecordings();
    setEditingRecording(null);
  };

  // Handle open folder
  const handleOpenFolder = async () => {
    await window.electronAPI.openRecordingsFolder();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-dark-400">Loading recordings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold">My Recordings</h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full sm:w-64 pl-10"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="select flex-1 sm:flex-initial"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="duration">Sort by Duration</option>
          </select>

          {/* Trash toggle */}
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`btn flex-1 sm:flex-initial ${showTrash ? 'btn-primary' : 'btn-secondary'}`}
          >
            {showTrash ? 'Viewing Trash' : 'View Trash'}
          </button>

          {/* Open folder button */}
          <button
            onClick={handleOpenFolder}
            className="btn btn-secondary flex items-center gap-2 justify-center flex-1 sm:flex-initial"
          >
            <FolderIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Open Folder</span>
            <span className="sm:hidden">Folder</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {filteredRecordings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <VideoIcon className="w-16 h-16 text-dark-600 mb-4" />
          <p className="text-dark-400 mb-2">
            {searchQuery ? 'No recordings found' : 'No recordings yet'}
          </p>
          <p className="text-dark-500 text-sm">
            {searchQuery
              ? 'Try a different search query'
              : showTrash
              ? 'Trash is empty'
              : 'Start a recording to see it here'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {filteredRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onPlay={handlePlay}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onPurge={handlePurge}
                onReveal={handleReveal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedRecording && (
        <VideoPlayer
          recording={selectedRecording}
          onClose={() => setSelectedRecording(null)}
        />
      )}

      {/* Video Editor Modal */}
      {editingRecording && (
        <VideoEditor
          recording={editingRecording}
          onClose={() => setEditingRecording(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

// Icons
function SearchIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
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

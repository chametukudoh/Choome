import { useState, useRef, useEffect } from 'react';
import type { Recording, TimelineClip } from '../../../shared/types';
import { toMediaUrl } from '../../utils/mediaUrl';

interface VideoEditorProps {
  recording: Recording;
  onClose: () => void;
  onSave: (editedRecording: Recording) => void;
}

type EditorTool = 'trim' | 'crop' | 'text';

interface TextOverlay {
  id: string;
  text: string;
  x: number; // Percent
  y: number; // Percent
  endX: number;
  endY: number;
  animate: boolean;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  timestamp: number; // Start time in seconds
  duration: number; // Duration in seconds
}

interface CropArea {
  // Percent values relative to the video frame
  x: number;
  y: number;
  width: number;
  height: number;
}

export function VideoEditor({ recording, onClose, onSave }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const initialClipIdRef = useRef(crypto.randomUUID());
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);

  // Timeline state (EDL)
  const [clips, setClips] = useState<TimelineClip[]>(() => ([
    {
      id: initialClipIdRef.current,
      sourcePath: recording.path,
      sourceStart: 0,
      sourceEnd: recording.duration,
    },
  ]));
  const [selectedClipId, setSelectedClipId] = useState(initialClipIdRef.current);

  // Crop state (percent-based)
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Audio controls
  const [audioSettings, setAudioSettings] = useState({
    volume: 100,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
  });
  const updateAudioSettings = (updates: Partial<typeof audioSettings>) => {
    setAudioSettings((prev) => {
      const next = { ...prev, ...updates };
      pushHistory(createSnapshot({ audioSettings: next }));
      return next;
    });
  };

  type EditorSnapshot = {
    clips: TimelineClip[];
    cropArea: CropArea | null;
    textOverlays: TextOverlay[];
    audioSettings: typeof audioSettings;
    selectedPresetId: string;
  };

  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [proxyPath, setProxyPath] = useState<string | null>(null);
  const [isProxyLoading, setIsProxyLoading] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('Preparing');

  const [waveformPath, setWaveformPath] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const exportPresets = [
    { id: 'source', label: 'Source', width: 0, height: 0, bitrate: '' },
    { id: '1080p', label: '1080p (16:9)', width: 1920, height: 1080, bitrate: '8000k' },
    { id: '720p', label: '720p (16:9)', width: 1280, height: 720, bitrate: '5000k' },
    { id: 'shorts', label: 'Shorts (9:16)', width: 1080, height: 1920, bitrate: '6000k' },
  ];
  const [selectedPresetId, setSelectedPresetId] = useState('source');
  const [encoder, setEncoder] = useState<'auto' | 'cpu' | 'nvenc' | 'qsv' | 'amf'>('auto');
  const [optimizeForSize, setOptimizeForSize] = useState(false);
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    pushHistory(createSnapshot({ selectedPresetId: presetId }));
  };

  const createSnapshot = (overrides: Partial<EditorSnapshot> = {}): EditorSnapshot => ({
    clips,
    cropArea,
    textOverlays,
    audioSettings,
    selectedPresetId,
    ...overrides,
  });

  const pushHistory = (snapshot: EditorSnapshot) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, snapshot];
      setHistoryIndex(next.length - 1);
      return next;
    });
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const prevSnapshot = history[historyIndex - 1];
    setClips(prevSnapshot.clips);
    setCropArea(prevSnapshot.cropArea);
    setTextOverlays(prevSnapshot.textOverlays);
    setAudioSettings(prevSnapshot.audioSettings);
    setSelectedPresetId(prevSnapshot.selectedPresetId);
    setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextSnapshot = history[historyIndex + 1];
    setClips(nextSnapshot.clips);
    setCropArea(nextSnapshot.cropArea);
    setTextOverlays(nextSnapshot.textOverlays);
    setAudioSettings(nextSnapshot.audioSettings);
    setSelectedPresetId(nextSnapshot.selectedPresetId);
    setHistoryIndex(historyIndex + 1);
  };

  useEffect(() => {
    if (historyIndex === -1) {
      pushHistory(createSnapshot());
    }
  }, []);

  // Video player controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const basePath = recording.path.replace(/\.\w+$/, '');
    const waveformOutput = `${basePath}-waveform-${recording.id}.png`;
    window.electronAPI.ffmpegGenerateWaveform(recording.path, waveformOutput, 1200, 120)
      .then((path) => {
        if (!active) return;
        setWaveformPath(path);
      })
      .catch(() => {
        if (!active) return;
        setWaveformPath(null);
      });

    return () => {
      active = false;
    };
  }, [recording.id, recording.path]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const audioContext = audioContextRef.current;

    if (!mediaSourceRef.current) {
      mediaSourceRef.current = audioContext.createMediaElementSource(video);
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    mediaSourceRef.current.connect(analyser);
    analyser.connect(audioContext.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(100, (avg / 128) * 100);
      setAudioLevel(normalized);
      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      analyser.disconnect();
      analyserRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onFFmpegProgress((progress) => {
      setExportProgress(progress);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const basePath = recording.path.replace(/\.\w+$/, '');
    const proxyOutput = `${basePath}-proxy-${recording.id}.mp4`;
    setIsProxyLoading(true);
    window.electronAPI.ffmpegGenerateProxy(recording.path, proxyOutput, 960)
      .then((path) => {
        if (!active) return;
        setProxyPath(path);
      })
      .catch(() => {
        if (!active) return;
        setProxyPath(null);
      })
      .finally(() => {
        if (!active) return;
        setIsProxyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [recording.id, recording.path]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0];
  const clipStart = selectedClip?.sourceStart ?? 0;
  const clipEnd = selectedClip?.sourceEnd ?? recording.duration;

  const updateClip = (id: string, updates: Partial<TimelineClip>) => {
    setClips((prev) => {
      const next = prev.map((clip) => (clip.id === id ? { ...clip, ...updates } : clip));
      pushHistory(createSnapshot({ clips: next }));
      return next;
    });
  };

  const handleTrimStartChange = (value: number) => {
    if (!selectedClip) return;
    const newStart = Math.min(value, clipEnd - 0.1);
    updateClip(selectedClip.id, { sourceStart: newStart });
    handleSeek(newStart);
  };

  const handleTrimEndChange = (value: number) => {
    if (!selectedClip) return;
    const newEnd = Math.max(value, clipStart + 0.1);
    updateClip(selectedClip.id, { sourceEnd: newEnd });
  };

  const handleSplitAtPlayhead = () => {
    if (!selectedClip) return;
    if (currentTime <= clipStart || currentTime >= clipEnd) return;
    const splitTime = Math.min(Math.max(currentTime, clipStart + 0.1), clipEnd - 0.1);
    const newClipId = crypto.randomUUID();
    const firstClip: TimelineClip = { ...selectedClip, sourceEnd: splitTime };
    const secondClip: TimelineClip = {
      ...selectedClip,
      id: newClipId,
      sourceStart: splitTime,
      sourceEnd: clipEnd,
    };

    setClips((prev) => {
      const index = prev.findIndex((clip) => clip.id === selectedClip.id);
      if (index === -1) return prev;
      const updated = [...prev];
      updated.splice(index, 1, firstClip, secondClip);
      pushHistory(createSnapshot({ clips: updated }));
      return updated;
    });
    setSelectedClipId(newClipId);
  };

  const moveClip = (direction: -1 | 1) => {
    if (!selectedClip) return;
    setClips((prev) => {
      const index = prev.findIndex((clip) => clip.id === selectedClip.id);
      if (index === -1) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(newIndex, 0, removed);
      pushHistory(createSnapshot({ clips: updated }));
      return updated;
    });
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    setClips((prev) => {
      if (prev.length === 1) return prev;
      const filtered = prev.filter((clip) => clip.id !== selectedClip.id);
      pushHistory(createSnapshot({ clips: filtered }));
      return filtered;
    });
    setSelectedClipId((prevId) => {
      const remaining = clips.filter((clip) => clip.id !== prevId);
      return remaining[0]?.id ?? prevId;
    });
  };

  const handleAddTextOverlay = () => {
    if (!newText.trim()) return;

    const overlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
      y: 50,
      endX: 50,
      endY: 50,
      animate: false,
      fontSize: 24,
      color: '#FFFFFF',
      bold: false,
      italic: false,
      fontFamily: 'Arial',
      align: 'left',
      timestamp: currentTime,
      duration: 5,
    };

    const next = [...textOverlays, overlay];
    setTextOverlays(next);
    pushHistory(createSnapshot({ textOverlays: next }));
    setNewText('');
    setSelectedOverlay(overlay.id);
  };

  const handleDeleteOverlay = (id: string) => {
    const next = textOverlays.filter(o => o.id !== id);
    setTextOverlays(next);
    pushHistory(createSnapshot({ textOverlays: next }));
    if (selectedOverlay === id) {
      setSelectedOverlay(null);
    }
  };

  const updateOverlay = (id: string, updates: Partial<TextOverlay>, recordHistory = true) => {
    setTextOverlays((prev) => {
      const next = prev.map((overlay) => (overlay.id === id ? { ...overlay, ...updates } : overlay));
      if (recordHistory) {
        pushHistory(createSnapshot({ textOverlays: next }));
      }
      return next;
    });
  };

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const getVideoDimensions = () => {
    const width = videoSize?.width ?? videoRef.current?.videoWidth ?? videoContainerRef.current?.clientWidth ?? 1920;
    const height = videoSize?.height ?? videoRef.current?.videoHeight ?? videoContainerRef.current?.clientHeight ?? 1080;
    return { width, height };
  };

  const getContainerRect = () => {
    return videoContainerRef.current?.getBoundingClientRect() ?? null;
  };

  const handleOverlayMouseDown = (overlay: TextOverlay, event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'text') return;
    event.preventDefault();
    event.stopPropagation();
    const rect = getContainerRect();
    if (!rect) return;
    setSelectedOverlay(overlay.id);
    setDraggingOverlayId(overlay.id);

    const overlayX = (overlay.x / 100) * rect.width;
    const overlayY = (overlay.y / 100) * rect.height;
    setDragOffset({
      x: event.clientX - rect.left - overlayX,
      y: event.clientY - rect.top - overlayY,
    });
  };

  useEffect(() => {
    if (!draggingOverlayId || !dragOffset) return;

    const handleMove = (event: MouseEvent) => {
      const rect = getContainerRect();
      if (!rect) return;
      const rawX = event.clientX - rect.left - dragOffset.x;
      const rawY = event.clientY - rect.top - dragOffset.y;
      const xPercent = clamp((rawX / rect.width) * 100, 0, 100);
      const yPercent = clamp((rawY / rect.height) * 100, 0, 100);
      updateOverlay(draggingOverlayId, { x: xPercent, y: yPercent }, false);
    };

    const handleUp = () => {
      setDraggingOverlayId(null);
      setDragOffset(null);
      pushHistory(createSnapshot({ textOverlays }));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingOverlayId, dragOffset]);

  const handleCropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'crop') return;
    const rect = getContainerRect();
    if (!rect) return;
    const startX = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const startY = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    cropStartRef.current = { x: startX, y: startY };
    setIsDraggingCrop(true);
    setCropArea({ x: startX, y: startY, width: 0, height: 0 });
  };

  const handleCropMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !cropStartRef.current) return;
    const rect = getContainerRect();
    if (!rect) return;
    const currentX = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const currentY = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const start = cropStartRef.current;
    const x = Math.min(start.x, currentX);
    const y = Math.min(start.y, currentY);
    const width = Math.abs(currentX - start.x);
    const height = Math.abs(currentY - start.y);
    setCropArea({ x, y, width, height });
  };

  const handleCropMouseUp = () => {
    cropStartRef.current = null;
    setIsDraggingCrop(false);
    pushHistory(createSnapshot({ cropArea }));
  };

  const applyCropPreset = (ratio: number) => {
    const { width, height } = getVideoDimensions();
    if (ratio <= 0) {
      setCropArea(null);
      pushHistory(createSnapshot({ cropArea: null }));
      return;
    }
    let cropWidth = width;
    let cropHeight = width / ratio;
    if (cropHeight > height) {
      cropHeight = height;
      cropWidth = height * ratio;
    }
    const x = (width - cropWidth) / 2;
    const y = (height - cropHeight) / 2;
    const nextCrop = {
      x: (x / width) * 100,
      y: (y / height) * 100,
      width: (cropWidth / width) * 100,
      height: (cropHeight / height) * 100,
    };
    setCropArea(nextCrop);
    pushHistory(createSnapshot({ cropArea: nextCrop }));
  };

  const handleSave = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      let currentPath = recording.path;
      const basePath = recording.path.replace(/\.\w+$/, '');
      const timelineDuration = clips.reduce((total, clip) => total + (clip.sourceEnd - clip.sourceStart), 0);
      const { width: baseWidth, height: baseHeight } = getVideoDimensions();
      let outputWidth = baseWidth;
      let outputHeight = baseHeight;

      const hasEdits = clips.length > 1 || clips.some((clip) => clip.sourceStart > 0 || clip.sourceEnd < recording.duration);
      if (hasEdits) {
        setExportStage('Rendering timeline');
        const timelinePath = `${basePath}-timeline-${Date.now()}.mp4`;
        console.log('Rendering timeline:', clips);
        currentPath = await window.electronAPI.ffmpegRenderTimeline(
          currentPath,
          timelinePath,
          clips.map((clip) => ({ start: clip.sourceStart, end: clip.sourceEnd }))
        );
      }

      if (cropArea && cropArea.width > 0.5 && cropArea.height > 0.5) {
        setExportStage('Applying crop');
        const cropX = Math.round((cropArea.x / 100) * outputWidth);
        const cropY = Math.round((cropArea.y / 100) * outputHeight);
        const cropWidth = Math.round((cropArea.width / 100) * outputWidth);
        const cropHeight = Math.round((cropArea.height / 100) * outputHeight);
        const cropPath = `${basePath}-crop-${Date.now()}.mp4`;
        currentPath = await window.electronAPI.ffmpegCropVideo(
          currentPath,
          cropPath,
          cropX,
          cropY,
          cropWidth,
          cropHeight
        );
        outputWidth = cropWidth;
        outputHeight = cropHeight;
      }

      // Apply text overlays if any
      for (const overlay of textOverlays) {
        setExportStage('Applying text overlay');
        const textPath = `${basePath}-text-${Date.now()}.mp4`;
        console.log('Adding text overlay:', overlay.text);
        const xPx = Math.round((overlay.x / 100) * outputWidth);
        const yPx = Math.round((overlay.y / 100) * outputHeight);
        currentPath = await window.electronAPI.ffmpegAddTextOverlay(
          currentPath,
          textPath,
          overlay.text,
          xPx,
          yPx,
          overlay.fontSize,
          overlay.color,
          overlay.timestamp,
          overlay.duration,
          overlay.bold,
          overlay.italic,
          overlay.fontFamily,
          overlay.align,
          overlay.animate,
          Math.round((overlay.endX / 100) * outputWidth),
          Math.round((overlay.endY / 100) * outputHeight)
        );
      }

      const hasAudioAdjustments =
        audioSettings.muted ||
        audioSettings.volume !== 100 ||
        audioSettings.fadeIn > 0 ||
        audioSettings.fadeOut > 0;

      if (hasAudioAdjustments) {
        setExportStage('Processing audio');
        const audioPath = `${basePath}-audio-${Date.now()}.mp4`;
        currentPath = await window.electronAPI.ffmpegApplyAudioFilters(currentPath, audioPath, {
          volume: audioSettings.volume,
          muted: audioSettings.muted,
          fadeIn: audioSettings.fadeIn,
          fadeOut: audioSettings.fadeOut,
          duration: timelineDuration || recording.duration,
        });
      }

      const preset = exportPresets.find((p) => p.id === selectedPresetId);
      const shouldTranscode = preset && (preset.id !== 'source' || optimizeForSize || encoder !== 'auto');
      if (preset && shouldTranscode) {
        setExportStage('Exporting preset');
        const presetPath = `${basePath}-export-${preset.id}-${Date.now()}.mp4`;
        currentPath = await window.electronAPI.ffmpegTranscodePreset(currentPath, presetPath, {
          width: preset.width,
          height: preset.height,
          bitrate: preset.bitrate,
          encoder,
          optimizeForSize,
        });
      }

      const resolvedDuration = Math.max(1, Math.round(timelineDuration || recording.duration));
      const resolvedQuality = preset?.id && ['720p', '1080p', '1440p', '4k'].includes(preset.id)
        ? (preset.id as Recording['quality'])
        : recording.quality;

      const savedRecording = await window.electronAPI.addRecording({
        path: currentPath,
        duration: resolvedDuration,
        quality: resolvedQuality,
        name: `${recording.name} (Edited)`,
      });

      console.log('Video editing completed:', savedRecording);
      onSave(savedRecording);
      setIsExporting(false);
      setExportProgress(0);
    } catch (error) {
      console.error('Failed to save edited video:', error);
      alert('Failed to save edited video. Please try again.');
      setIsExporting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Video Editor</h2>
          <span className="text-sm text-dark-400">{recording.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            className="btn btn-secondary"
            disabled={historyIndex <= 0 || isExporting}
          >
            Undo
          </button>
          <button
            onClick={redo}
            className="btn btn-secondary"
            disabled={historyIndex >= history.length - 1 || isExporting}
          >
            Redo
          </button>
          <button onClick={handleSave} className="btn btn-primary" disabled={isExporting}>
            Save Changes
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={isExporting}>
            Cancel
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video preview */}
        <div className="flex-1 flex flex-col p-6 bg-dark-900">
          {/* Video container */}
          <div
            ref={videoContainerRef}
            className={`flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center ${
              activeTool === 'crop' ? 'cursor-crosshair' : ''
            }`}
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
            onMouseLeave={handleCropMouseUp}
          >
            {isProxyLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-sm text-dark-200">
                Generating preview…
              </div>
            )}
            <video
              ref={videoRef}
              src={toMediaUrl(proxyPath ?? recording.path)}
              className="max-w-full max-h-full"
              onClick={togglePlay}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ display: activeTool === 'crop' ? 'block' : 'none' }}
            />

            {/* Crop preview */}
            {activeTool === 'crop' && cropArea && (
              <div
                className="absolute border-2 border-primary-500 bg-primary-500/10"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`,
                }}
              />
            )}

            {/* Text overlays preview */}
            {textOverlays
              .filter(o => currentTime >= o.timestamp && currentTime < o.timestamp + o.duration)
              .map(overlay => {
                const progress = overlay.duration > 0
                  ? Math.min(1, Math.max(0, (currentTime - overlay.timestamp) / overlay.duration))
                  : 0;
                const effectiveX = overlay.animate ? overlay.x + (overlay.endX - overlay.x) * progress : overlay.x;
                const effectiveY = overlay.animate ? overlay.y + (overlay.endY - overlay.y) * progress : overlay.y;
                const alignTransform = overlay.align === 'center'
                  ? 'translateX(-50%)'
                  : overlay.align === 'right'
                  ? 'translateX(-100%)'
                  : 'translateX(0)';

                return (
                  <div
                    key={overlay.id}
                    className={`absolute ${activeTool === 'text' ? 'pointer-events-auto cursor-move' : 'pointer-events-none'} ${
                      selectedOverlay === overlay.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                    onMouseDown={(event) => handleOverlayMouseDown(overlay, event)}
                    style={{
                      left: `${effectiveX}%`,
                      top: `${effectiveY}%`,
                      fontSize: `${overlay.fontSize}px`,
                      color: overlay.color,
                      fontWeight: overlay.bold ? '700' : '400',
                      fontStyle: overlay.italic ? 'italic' : 'normal',
                      fontFamily: overlay.fontFamily,
                      textAlign: overlay.align,
                      transform: alignTransform,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {overlay.text}
                  </div>
                );
              })}

            {/* Play button overlay */}
            {!isPlaying && !isExporting && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors"
              >
                <PlayIcon className="w-20 h-20 text-white" />
              </button>
            )}
          </div>

          {isExporting && (
            <div className="mt-4 card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{exportStage}</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-xs text-dark-400">
                Export in progress. Please keep the editor open.
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-4 space-y-2">
            {/* Main timeline */}
            <div className="relative">
              <input
                type="range"
                min="0"
                max={recording.duration}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-dark-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(recording.duration)}</span>
              </div>
            </div>

            {/* Clip timeline */}
            <div className="card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Timeline Clips</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleSplitAtPlayhead} className="btn btn-secondary text-xs">
                    Split at Playhead
                  </button>
                  <button
                    onClick={() => moveClip(-1)}
                    className="btn btn-secondary text-xs"
                    disabled={!selectedClip || clips.findIndex((c) => c.id === selectedClip.id) === 0}
                  >
                    Move Left
                  </button>
                  <button
                    onClick={() => moveClip(1)}
                    className="btn btn-secondary text-xs"
                    disabled={!selectedClip || clips.findIndex((c) => c.id === selectedClip.id) === clips.length - 1}
                  >
                    Move Right
                  </button>
                  <button
                    onClick={deleteSelectedClip}
                    className="btn btn-danger text-xs"
                    disabled={!selectedClip || clips.length === 1}
                  >
                    Delete Clip
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {clips.map((clip, index) => (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      clip.id === selectedClipId ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                    }`}
                    title={`${formatTime(clip.sourceStart)} - ${formatTime(clip.sourceEnd)}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>Clip {index + 1} · {formatTime(clip.sourceEnd - clip.sourceStart)}</span>
                      {clip.id === selectedClipId && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block w-1.5 h-6 bg-primary-200/50 rounded-full overflow-hidden"
                            title="Audio level"
                          >
                            <span
                              className="block w-full bg-primary-400"
                              style={{ height: `${audioLevel}%` }}
                            />
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              {waveformPath && (
                <div className="mt-2 rounded bg-dark-900 border border-dark-700 p-2">
                  <img
                    src={toMediaUrl(waveformPath)}
                    alt="Audio waveform"
                    className="w-full h-20 object-cover opacity-70"
                  />
                </div>
              )}
              <p className="text-xs text-dark-500">
                Timeline edits apply on export. Preview playback uses the full source.
              </p>
            </div>

            {/* Trim controls */}
            {activeTool === 'trim' && (
              <div className="card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Trim Video</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-dark-400 mb-1 block">Start Time: {formatTime(clipStart)}</label>
                    <input
                      type="range"
                      min="0"
                      max={recording.duration}
                      step="0.1"
                      value={clipStart}
                      onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                      className="w-full accent-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-dark-400 mb-1 block">End Time: {formatTime(clipEnd)}</label>
                    <input
                      type="range"
                      min="0"
                      max={recording.duration}
                      step="0.1"
                      value={clipEnd}
                      onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                      className="w-full accent-red-600"
                    />
                  </div>
                </div>
                <div className="text-xs text-dark-400">
                  Selected clip duration: {formatTime(clipEnd - clipStart)}
                </div>
              </div>
            )}

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleSeek(Math.max(0, currentTime - 5))}
                className="btn-icon"
                title="Rewind 5s"
              >
                <RewindIcon />
              </button>
              <button onClick={togglePlay} className="btn btn-primary p-3">
                {isPlaying ? <PauseIcon /> : <PlayIcon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => handleSeek(Math.min(recording.duration, currentTime + 5))}
                className="btn-icon"
                title="Forward 5s"
              >
                <ForwardIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Tools sidebar */}
        <div className="w-80 bg-dark-950 border-l border-dark-800 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Editing Tools</h3>

          <div className="space-y-2">
            {/* Trim tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'trim' ? null : 'trim')}
              className={`w-full btn ${activeTool === 'trim' ? 'btn-primary' : 'btn-secondary'} justify-start gap-2`}
            >
              <TrimIcon />
              Trim Video
            </button>

            {/* Crop tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'crop' ? null : 'crop')}
              className={`w-full btn ${activeTool === 'crop' ? 'btn-primary' : 'btn-secondary'} justify-start gap-2`}
            >
              <CropIcon />
              Crop Video
            </button>

            {/* Text tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
              className={`w-full btn ${activeTool === 'text' ? 'btn-primary' : 'btn-secondary'} justify-start gap-2`}
            >
              <TextIcon />
              Add Text
            </button>
          </div>

          {/* Tool-specific options */}
          {activeTool === 'text' && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Add New Text</label>
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTextOverlay()}
                  className="input w-full mb-2"
                  placeholder="Enter text..."
                />
                <button
                  onClick={handleAddTextOverlay}
                  className="btn btn-primary w-full"
                  disabled={!newText.trim()}
                >
                  Add Text Overlay
                </button>
              </div>

              {/* Text overlays list */}
              {textOverlays.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Text Overlays</label>
                  <div className="space-y-2">
                    {textOverlays.map(overlay => (
                      <div
                        key={overlay.id}
                        className={`card p-3 cursor-pointer ${selectedOverlay === overlay.id ? 'border-primary-600' : ''}`}
                        onClick={() => setSelectedOverlay(overlay.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 truncate text-sm">{overlay.text}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOverlay(overlay.id);
                            }}
                            className="btn-icon text-red-400 hover:text-red-300"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                        <div className="text-xs text-dark-400">
                          {formatTime(overlay.timestamp)} - {formatTime(overlay.timestamp + overlay.duration)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOverlay && (
                <div className="card p-3 space-y-3">
                  <label className="text-sm font-medium">Selected Text</label>
                  <input
                    type="text"
                    value={textOverlays.find((o) => o.id === selectedOverlay)?.text ?? ''}
                    onChange={(e) => updateOverlay(selectedOverlay, { text: e.target.value })}
                    className="input w-full"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Font Size</label>
                      <input
                        type="number"
                        min="12"
                        max="120"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.fontSize ?? 24}
                        onChange={(e) => updateOverlay(selectedOverlay, { fontSize: Number(e.target.value) })}
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Color</label>
                      <input
                        type="color"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.color ?? '#FFFFFF'}
                        onChange={(e) => updateOverlay(selectedOverlay, { color: e.target.value })}
                        className="w-full h-9 rounded bg-dark-800 border border-dark-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Font</label>
                      <select
                        className="select w-full text-xs"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.fontFamily ?? 'Arial'}
                        onChange={(e) => updateOverlay(selectedOverlay, { fontFamily: e.target.value })}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Verdana">Verdana</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Align</label>
                      <select
                        className="select w-full text-xs"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.align ?? 'left'}
                        onChange={(e) => updateOverlay(selectedOverlay, { align: e.target.value as 'left' | 'center' | 'right' })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Start (s)</label>
                      <input
                        type="number"
                        min="0"
                        max={recording.duration}
                        step="0.1"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.timestamp ?? 0}
                        onChange={(e) => updateOverlay(selectedOverlay, { timestamp: Number(e.target.value) })}
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1 block">Duration (s)</label>
                      <input
                        type="number"
                        min="0.1"
                        max={recording.duration}
                        step="0.1"
                        value={textOverlays.find((o) => o.id === selectedOverlay)?.duration ?? 5}
                        onChange={(e) => updateOverlay(selectedOverlay, { duration: Number(e.target.value) })}
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateOverlay(selectedOverlay, { bold: !textOverlays.find((o) => o.id === selectedOverlay)?.bold })}
                      className={`btn text-xs flex-1 ${textOverlays.find((o) => o.id === selectedOverlay)?.bold ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOverlay(selectedOverlay, { italic: !textOverlays.find((o) => o.id === selectedOverlay)?.italic })}
                      className={`btn text-xs flex-1 ${textOverlays.find((o) => o.id === selectedOverlay)?.italic ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Italic
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-dark-400">Animate position</label>
                    <input
                      type="checkbox"
                      checked={textOverlays.find((o) => o.id === selectedOverlay)?.animate ?? false}
                      onChange={(e) => updateOverlay(selectedOverlay, { animate: e.target.checked })}
                      className="rounded"
                    />
                  </div>
                  {textOverlays.find((o) => o.id === selectedOverlay)?.animate && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-dark-400 mb-1 block">End X (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={textOverlays.find((o) => o.id === selectedOverlay)?.endX ?? 50}
                          onChange={(e) => updateOverlay(selectedOverlay, { endX: Number(e.target.value) })}
                          className="input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 mb-1 block">End Y (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={textOverlays.find((o) => o.id === selectedOverlay)?.endY ?? 50}
                          onChange={(e) => updateOverlay(selectedOverlay, { endY: Number(e.target.value) })}
                          className="input w-full text-xs"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-dark-500">
                    Drag text directly on the video to reposition it.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTool === 'crop' && (
            <div className="mt-6">
              <p className="text-sm text-dark-400 mb-3">
                Click and drag on the video to select the crop area.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => applyCropPreset(16 / 9)} className="btn btn-secondary text-xs">
                  16:9
                </button>
                <button onClick={() => applyCropPreset(9 / 16)} className="btn btn-secondary text-xs">
                  9:16
                </button>
                <button onClick={() => applyCropPreset(1)} className="btn btn-secondary text-xs">
                  1:1
                </button>
                <button onClick={() => applyCropPreset(4 / 3)} className="btn btn-secondary text-xs">
                  4:3
                </button>
                <button onClick={() => applyCropPreset(0)} className="btn btn-secondary text-xs col-span-2">
                  Reset Crop
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-dark-800 pt-4 space-y-4">
            <h4 className="text-sm font-semibold">Audio</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dark-400 mb-1 block">
                  Volume: {audioSettings.muted ? 'Muted' : `${audioSettings.volume}%`}
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  value={audioSettings.muted ? 0 : audioSettings.volume}
                  onChange={(e) => updateAudioSettings({ volume: parseInt(e.target.value, 10), muted: false })}
                  className="w-full accent-primary-600"
                />
              </div>
              <button
                onClick={() => updateAudioSettings({ muted: !audioSettings.muted })}
                className={`btn ${audioSettings.muted ? 'btn-primary' : 'btn-secondary'} text-xs`}
              >
                {audioSettings.muted ? 'Unmute Audio' : 'Mute Audio'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-dark-400 mb-1 block">Fade In (s)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={audioSettings.fadeIn}
                    onChange={(e) => updateAudioSettings({ fadeIn: Number(e.target.value) })}
                    className="input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-dark-400 mb-1 block">Fade Out (s)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={audioSettings.fadeOut}
                    onChange={(e) => updateAudioSettings({ fadeOut: Number(e.target.value) })}
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-dark-800 pt-4 space-y-3">
            <h4 className="text-sm font-semibold">Export Preset</h4>
            <div className="space-y-2">
              {exportPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  className={`w-full btn text-xs ${selectedPresetId === preset.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="pt-3 space-y-2">
              <label className="text-xs text-dark-400 mb-1 block">Encoder</label>
              <select
                className="select w-full text-xs"
                value={encoder}
                onChange={(e) => setEncoder(e.target.value as typeof encoder)}
              >
                <option value="auto">Auto (CPU)</option>
                <option value="cpu">CPU (libx264)</option>
                <option value="nvenc">NVIDIA NVENC</option>
                <option value="qsv">Intel QuickSync</option>
                <option value="amf">AMD AMF</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-dark-400">
                <input
                  type="checkbox"
                  checked={optimizeForSize}
                  onChange={(e) => setOptimizeForSize(e.target.checked)}
                  className="rounded"
                />
                Optimize for smaller files
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
function PlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
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

function RewindIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
    </svg>
  );
}

function TrimIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

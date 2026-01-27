import { useCallback, useRef, useEffect } from 'react';
import { useRecordingStore } from '../stores/recordingStore';
import type { SourceInfo } from '../../shared/types';
import { toast } from '../components/Toasts/toast';

interface UseRecordingReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;

  // Actions
  fetchSources: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useRecording(): UseRecordingReturn {
  const {
    status,
    selectedSource,
    includeMicrophone,
    includeSystemAudio,
    includeWebcam,
    selectedWebcamId,
    selectedMicrophoneId,
    microphoneMuted,
    systemAudioMuted,
    setSystemAudioAvailable,
    quality,
    setQuality,
    duration,
    setStatus,
    setAvailableSources,
    setDuration,
    setFileSize,
  } = useRecordingStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedAudioStreamRef = useRef<MediaStream | null>(null);
  const recoveryIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((track) => track.stop());
        canvasStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }
      if (systemAudioStreamRef.current) {
        systemAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        systemAudioStreamRef.current = null;
      }
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        micAudioStreamRef.current = null;
      }
      if (mixedAudioStreamRef.current) {
        mixedAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        mixedAudioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (recoveryIdRef.current) {
        window.electronAPI.discardRecordingRecovery(recoveryIdRef.current);
        recoveryIdRef.current = null;
      }
    };
  }, []);

  // Fetch available screen/window sources
  const fetchSources = useCallback(async () => {
    try {
      const sources = await window.electronAPI.getSources();
      setAvailableSources(sources as SourceInfo[]);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  }, [setAvailableSources]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!selectedSource) {
      console.error('No source selected');
      return;
    }

    try {
      const settings = await window.electronAPI?.getSettings();
      const frameRateSetting = settings?.frameRate ?? 60;
      const effectiveQuality = settings?.quality ?? quality;
      if (settings?.quality && settings.quality !== quality) {
        setQuality(settings.quality);
      }
      // Capture screen video (without audio - Electron desktop capturer doesn't support audio on Windows)
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false, // We'll capture audio separately
        video: {
          // @ts-expect-error - Electron-specific constraint
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource.id,
            maxWidth: 3840,
            maxHeight: 2160,
            maxFrameRate: frameRateSetting,
          },
        },
      });

      screenStreamRef.current = screenStream;

      console.log('Screen stream created:', {
        video: screenStream.getVideoTracks().length,
        audio: screenStream.getAudioTracks().length
      });

      // Create combined stream (video will be either screen or composed canvas)
      const combinedStream = new MediaStream();

      let videoSourceStream: MediaStream = screenStream;

      if (includeWebcam) {
        try {
          const overlayConfig = await window.electronAPI?.getWebcamOverlayConfig(selectedSource.display_id);
          const webcamShape = overlayConfig?.shape ?? settings?.webcam?.shape ?? 'circle';
          const persistedWebcamId = selectedWebcamId || settings?.webcam?.deviceId || window.localStorage.getItem('choome:webcamDeviceId');
          const webcamConstraints: MediaStreamConstraints = {
            video: persistedWebcamId
              ? { deviceId: { exact: persistedWebcamId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          };

          const webcamStream = await navigator.mediaDevices.getUserMedia(webcamConstraints);
          webcamStreamRef.current = webcamStream;

          const screenVideo = document.createElement('video');
          screenVideo.muted = true;
          screenVideo.playsInline = true;
          screenVideo.srcObject = screenStream;
          screenVideoRef.current = screenVideo;

          const webcamVideo = document.createElement('video');
          webcamVideo.muted = true;
          webcamVideo.playsInline = true;
          webcamVideo.srcObject = webcamStream;
          webcamVideoRef.current = webcamVideo;

          const ensureVideoReady = async (video: HTMLVideoElement) => {
            if (video.readyState >= 2) return;
            await new Promise<void>((resolve) => {
              const handleReady = () => resolve();
              video.addEventListener('loadeddata', handleReady, { once: true });
              video.addEventListener('loadedmetadata', handleReady, { once: true });
            });
          };

          await Promise.all([
            screenVideo.play().catch(() => {}),
            webcamVideo.play().catch(() => {}),
            ensureVideoReady(screenVideo),
            ensureVideoReady(webcamVideo),
          ]);

          const screenSettings = screenStream.getVideoTracks()[0]?.getSettings() || {};
          const canvasWidth = screenSettings.width || 1920;
          const canvasHeight = screenSettings.height || 1080;
          const frameRate = screenSettings.frameRate || frameRateSetting || 30;

          const canvas = document.createElement('canvas');
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Failed to create canvas context for webcam overlay');
          }

          const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
            const r = Math.min(radius, width / 2, height / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + width, y, x + width, y + height, r);
            ctx.arcTo(x + width, y + height, x, y + height, r);
            ctx.arcTo(x, y + height, x, y, r);
            ctx.arcTo(x, y, x + width, y, r);
            ctx.closePath();
          };

          const drawFrame = () => {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            if (screenVideo.readyState >= 2) {
              ctx.drawImage(screenVideo, 0, 0, canvasWidth, canvasHeight);
            }

            if (webcamVideo.readyState >= 2) {
              const margin = Math.round(Math.min(canvasWidth, canvasHeight) * 0.02);
              const targetWidth = Math.round(canvasWidth * 0.22);
              const webcamAspect = webcamVideo.videoWidth && webcamVideo.videoHeight
                ? webcamVideo.videoWidth / webcamVideo.videoHeight
                : 16 / 9;

              let pipWidth = Math.min(targetWidth, canvasWidth - margin * 2);
              let pipHeight = Math.round(pipWidth / webcamAspect);
              const maxHeight = Math.round(canvasHeight * 0.3);
              if (pipHeight > maxHeight) {
                pipHeight = maxHeight;
                pipWidth = Math.round(pipHeight * webcamAspect);
              }

              let pipX = canvasWidth - pipWidth - margin;
              let pipY = canvasHeight - pipHeight - margin;

              if (overlayConfig && overlayConfig.width > 0 && overlayConfig.height > 0) {
                pipWidth = Math.min(overlayConfig.width, canvasWidth);
                pipHeight = Math.min(overlayConfig.height, canvasHeight);
                pipX = Math.min(Math.max(overlayConfig.x, 0), canvasWidth - pipWidth);
                pipY = Math.min(Math.max(overlayConfig.y, 0), canvasHeight - pipHeight);
              }
              const borderWidth = Math.max(2, Math.round(canvasWidth * 0.003));
              const cornerRadius = Math.round(Math.min(pipWidth, pipHeight) * 0.18);

              if (webcamShape === 'circle') {
                const diameter = Math.min(pipWidth, pipHeight);
                pipX += Math.round((pipWidth - diameter) / 2);
                pipY += Math.round((pipHeight - diameter) / 2);
                pipWidth = diameter;
                pipHeight = diameter;
              }

              ctx.save();
              if (webcamShape === 'circle') {
                const radius = Math.round(pipWidth / 2);
                ctx.beginPath();
                ctx.arc(pipX + radius, pipY + radius, radius, 0, Math.PI * 2);
                ctx.closePath();
              } else if (webcamShape === 'square') {
                ctx.beginPath();
                ctx.rect(pipX, pipY, pipWidth, pipHeight);
                ctx.closePath();
              } else {
                drawRoundedRect(pipX, pipY, pipWidth, pipHeight, cornerRadius);
              }
              ctx.clip();
              ctx.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight);
              ctx.restore();

              ctx.save();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
              ctx.lineWidth = borderWidth;
              if (webcamShape === 'circle') {
                const radius = Math.round(pipWidth / 2);
                ctx.beginPath();
                ctx.arc(pipX + radius, pipY + radius, radius, 0, Math.PI * 2);
                ctx.closePath();
              } else if (webcamShape === 'square') {
                ctx.beginPath();
                ctx.rect(pipX, pipY, pipWidth, pipHeight);
                ctx.closePath();
              } else {
                drawRoundedRect(pipX, pipY, pipWidth, pipHeight, cornerRadius);
              }
              ctx.stroke();
              ctx.restore();
            }

            animationFrameRef.current = requestAnimationFrame(drawFrame);
          };

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          drawFrame();

          const canvasStream = canvas.captureStream(frameRate);
          canvasStreamRef.current = canvasStream;
          videoSourceStream = canvasStream;
        } catch (webcamError) {
          console.error('Failed to start webcam overlay, falling back to screen-only:', webcamError);
          if (webcamStreamRef.current) {
            webcamStreamRef.current.getTracks().forEach((track) => track.stop());
            webcamStreamRef.current = null;
          }
        }
      }

      // Add video tracks
      videoSourceStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track);
      });

      const audioStreams: MediaStream[] = [];

      setSystemAudioAvailable(null);

      if (includeSystemAudio && !systemAudioMuted) {
        try {
          if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error('getDisplayMedia is not available');
          }
          await window.electronAPI?.setPreferredSource(selectedSource.id);
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });

          systemAudioStreamRef.current = displayStream;
          displayStream.getVideoTracks().forEach((track) => track.stop());

          if (displayStream.getAudioTracks().length > 0) {
            audioStreams.push(displayStream);
            console.log('✓ System audio captured:', displayStream.getAudioTracks().length);
            setSystemAudioAvailable(true);
          } else {
            console.warn('No system audio tracks were captured');
            setSystemAudioAvailable(false);
          }
        } catch (systemError) {
          console.error('Failed to capture system audio:', systemError);
          toast({
            type: 'warning',
            title: 'System audio unavailable',
            message: 'We could not capture system audio for this source.',
          });
          setSystemAudioAvailable(false);
        }
      }

      // Add microphone audio
      if (includeMicrophone && !microphoneMuted) {
        try {
          const micConstraints: MediaStreamConstraints = {
            audio: selectedMicrophoneId
              ? {
                  deviceId: { exact: selectedMicrophoneId },
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                }
              : {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
            video: false,
          };

          console.log('Requesting microphone with constraints:', micConstraints);
          const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
          micAudioStreamRef.current = micStream;

          const micTracks = micStream.getAudioTracks();
          console.log('✓ Microphone tracks captured:', micTracks.length);
          audioStreams.push(micStream);
        } catch (micError) {
          console.error('✗ Failed to capture microphone:', micError);
          toast({
            type: 'error',
            title: 'Microphone unavailable',
            message: 'Please check microphone permissions and device access.',
          });
        }
      } else {
        console.log('Microphone disabled in settings:', { includeMicrophone, microphoneMuted });
      }

      if (audioStreams.length === 1) {
        audioStreams[0].getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      } else if (audioStreams.length > 1) {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const destination = audioContext.createMediaStreamDestination();

          audioStreams.forEach((stream) => {
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(destination);
          });

          mixedAudioStreamRef.current = destination.stream;
          destination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
        } catch (mixError) {
          console.warn('Failed to mix audio streams, falling back to first stream:', mixError);
          audioStreams[0].getAudioTracks().forEach((track) => combinedStream.addTrack(track));
        }
      }

      streamRef.current = combinedStream;

      // Log final stream configuration
      console.log('Combined stream tracks:', {
        video: combinedStream.getVideoTracks().length,
        audio: combinedStream.getAudioTracks().length,
        allTracks: combinedStream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled
        }))
      });

      // Determine codec - prefer VP9 with Opus audio for better quality
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('VP9+Opus not supported, trying VP8+Opus');
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('VP8+Opus not supported, trying basic webm');
        mimeType = 'video/webm';
      }

      console.log('Using codec:', mimeType);

      try {
        const recovery = await window.electronAPI.beginRecordingRecovery(mimeType);
        recoveryIdRef.current = recovery?.id ?? null;
      } catch (error) {
        console.warn('Failed to initialize recording recovery:', error);
        recoveryIdRef.current = null;
      }

      // Calculate bitrate based on quality
      const bitrates: Record<string, number> = {
        '720p': 6_000_000,
        '1080p': 12_000_000,
        '1440p': 20_000_000,
        '4k': 40_000_000,
      };

      const videoBitsPerSecond = settings?.videoBitrateKbps
        ? settings.videoBitrateKbps * 1000
        : bitrates[effectiveQuality] || 12_000_000;

      // Create MediaRecorder with explicit audio bitrate
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond,
        audioBitsPerSecond: 128_000, // 128kbps for audio
      };

      console.log('Creating MediaRecorder with options:', recorderOptions);
      mediaRecorderRef.current = new MediaRecorder(combinedStream, recorderOptions);

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Update file size estimate
          const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
          setFileSize(totalSize);
          if (recoveryIdRef.current) {
            event.data.arrayBuffer().then((buffer) => {
              window.electronAPI.appendRecordingRecovery(recoveryIdRef.current as string, buffer);
            });
          }
        }
      };

      mediaRecorderRef.current.onstart = () => {
        setStatus('recording');
        startTimeRef.current = Date.now();
        pausedDurationRef.current = 0;

        // Start timer
        timerRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
          setDuration(Math.floor(elapsed / 1000));
        }, 1000);
      };

      mediaRecorderRef.current.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      // Start recording with 1 second chunks
      mediaRecorderRef.current.start(1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        type: 'error',
        title: 'Recording failed',
        message: 'Please check permissions and try again.',
      });
      setStatus('idle');
    }
  }, [
    selectedSource,
    includeMicrophone,
    includeSystemAudio,
    includeWebcam,
    selectedWebcamId,
    selectedMicrophoneId,
    microphoneMuted,
    systemAudioMuted,
    setSystemAudioAvailable,
    quality,
    setQuality,
    setStatus,
    setDuration,
    setFileSize,
  ]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setStatus('idle');
        resolve(null);
        return;
      }

      setStatus('processing');

      mediaRecorderRef.current.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (canvasStreamRef.current) {
          canvasStreamRef.current.getTracks().forEach((track) => track.stop());
          canvasStreamRef.current = null;
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
        }
        if (webcamStreamRef.current) {
          webcamStreamRef.current.getTracks().forEach((track) => track.stop());
          webcamStreamRef.current = null;
        }
        if (systemAudioStreamRef.current) {
          systemAudioStreamRef.current.getTracks().forEach((track) => track.stop());
          systemAudioStreamRef.current = null;
        }
        if (micAudioStreamRef.current) {
          micAudioStreamRef.current.getTracks().forEach((track) => track.stop());
          micAudioStreamRef.current = null;
        }
        if (mixedAudioStreamRef.current) {
          mixedAudioStreamRef.current.getTracks().forEach((track) => track.stop());
          mixedAudioStreamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Create blob from chunks (fallback)
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];

        let recovered = false;
        const recoveryId = recoveryIdRef.current;
        if (recoveryId) {
          try {
            await window.electronAPI.finalizeRecordingRecovery(recoveryId, {
              duration,
              quality,
            });
            recovered = true;
          } catch (error) {
            console.warn('Recovery finalize failed, falling back to blob save:', error);
            try {
              await window.electronAPI.discardRecordingRecovery(recoveryId);
            } catch {
              // ignore cleanup errors
            }
          } finally {
            recoveryIdRef.current = null;
          }
        }

        if (!recovered) {
          try {
            const buffer = await blob.arrayBuffer();
            await window.electronAPI.saveRecording({
              buffer,
              mimeType: blob.type || 'video/webm',
              duration,
              quality,
            });
          } catch (saveError) {
            console.error('Failed to save recording via IPC:', saveError);
            toast({
              type: 'error',
              title: 'Save failed',
              message: 'Falling back to a local download.',
            });
            // Fallback to browser download so user doesn't lose the recording
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `recording-${timestamp}.webm`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }

        setStatus('idle');
        setDuration(0);
        setFileSize(0);
        resolve(null);
      };

      mediaRecorderRef.current.stop();
    });
  }, [duration, quality, setStatus, setDuration, setFileSize]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');

      // Track paused time
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [setStatus]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');

      // Resume timer
      const pauseEnd = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
        setDuration(Math.floor(elapsed / 1000));
      }, 1000);
    }
  }, [setStatus, setDuration]);

  return {
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    duration,
    fetchSources,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}

# Choome - Personal Screen Recording Application

## Overview
A Loom-like desktop application for Windows that records screen, webcam, and audio with drawing tools and HD/4K support.

**Tech Stack:** Electron + React + TypeScript
**Platform:** Windows only
**Storage:** Local folder
**Hardware:** NVIDIA NVENC for fast encoding

---

## Active Scope: Webcam Shape Consistency (Circle Support)
Goal: ensure the webcam bubble shape (circle/rounded/square) is applied consistently in the overlay UI, persisted in settings, and used in the recorded output on Windows.

**Concrete task list**
1. Persist webcam shape/size in settings and deep-merge nested settings updates (avoid overwriting size/position).
2. Load persisted webcam shape/size in the webcam overlay window and update settings on shape/size changes.
3. Use the persisted webcam shape when compositing the webcam feed into recordings (circle mask vs rounded/square).
4. Ensure `webcam:open` uses stored settings when no explicit config is provided.
5. Validate: open webcam bubble → change shape to circle → start recording → verify recorded video has a circular bubble.

---

## Completed Improvements (Jan 2026)
- Added migration from legacy Loomy settings to Choome on first launch.
- Added media:// protocol so local thumbnails/videos load reliably in the library.
- Added IPC recording save + auto library refresh on save.
- Added system audio + mic mixing and system-audio availability indicator.
- Added recording settings for frame rate + bitrate and surfaced them in Settings.
- Added multi-monitor display info in source selector.
- Added recovery pipeline for mid-record crashes (temp file + recovery on startup).
- Added repair scan to re-index recordings on startup.
- Added soft delete (Trash), restore, and permanent delete.
- Added reveal-in-folder for recordings.
- Added undo/redo for editor operations.
- Added text overlay font selection, alignment, and animated position (keyframe-style).
- Added unified FFmpeg progress indicator.
- Added hardware encoder + optimize-for-size export options.
- Added smoke test script (`npm run test:smoke`).
- Added USER.md quick-start for running packaged builds without a terminal.

---

## Project Structure

```
choome-personal/
├── package.json
├── tsconfig.json
├── forge.config.ts
├── vite.config.ts
├── resources/
│   ├── icons/
│   └── ffmpeg/win32/x64/ffmpeg.exe
├── src/
│   ├── main/                     # Electron Main Process
│   │   ├── index.ts
│   │   ├── windows/
│   │   │   ├── mainWindow.ts
│   │   │   ├── overlayWindow.ts  # Drawing overlay
│   │   │   └── webcamWindow.ts   # Floating webcam bubble
│   │   ├── ipc/
│   │   │   └── handlers.ts
│   │   └── services/
│   │       ├── RecordingService.ts
│   │       ├── FFmpegService.ts
│   │       └── StorageService.ts
│   ├── renderer/                 # React Frontend
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── RecordingControls/
│   │   │   ├── SourceSelector/
│   │   │   ├── AudioControls/
│   │   │   ├── WebcamBubble/
│   │   │   ├── DrawingTools/
│   │   │   └── Library/
│   │   ├── hooks/
│   │   │   ├── useMediaDevices.ts
│   │   │   ├── useRecording.ts
│   │   │   └── useDrawing.ts
│   │   └── stores/
│   │       ├── recordingStore.ts
│   │       └── settingsStore.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── overlay.ts
│   ├── overlay/                  # Drawing overlay renderer
│   │   ├── index.html
│   │   └── DrawingOverlay.tsx
│   └── shared/
│       ├── types/
│       └── constants/
└── scripts/
```

---

## Implementation Phases

### Phase 1: Project Foundation
**Goal:** Set up Electron + React project with basic window management

**Tasks:**
1. Initialize Electron Forge with Vite + TypeScript template
2. Configure TailwindCSS for styling
3. Create main BrowserWindow with basic React shell
4. Set up IPC communication infrastructure
5. Create preload scripts with contextBridge
6. Implement basic settings storage with electron-store

**Key Files to Create:**
- `package.json` - Dependencies and scripts
- `src/main/index.ts` - Main process entry
- `src/main/windows/mainWindow.ts` - Main window config
- `src/preload/index.ts` - Preload script
- `src/renderer/App.tsx` - React app entry

---

### Phase 2: Screen Capture
**Goal:** Implement screen/window selection and basic recording

**Tasks:**
1. Use `desktopCapturer.getSources()` for screens and windows
2. Build source selector UI with thumbnails
3. Implement MediaRecorder with screen source
4. Create recording controls (start/stop/pause)
5. Build timer display
6. Save recordings as WebM to temp folder

**Key Files to Create:**
- `src/renderer/components/SourceSelector/ScreenSelector.tsx`
- `src/renderer/components/SourceSelector/WindowSelector.tsx`
- `src/renderer/components/RecordingControls/RecordButton.tsx`
- `src/renderer/components/RecordingControls/Timer.tsx`
- `src/renderer/hooks/useRecording.ts`
- `src/main/ipc/handlers.ts`

---

### Phase 3: Audio Capture
**Goal:** Capture microphone and system audio

**Tasks:**
1. Enumerate audio input devices with `navigator.mediaDevices.enumerateDevices()`
2. Build microphone selector dropdown
3. Integrate system audio capture using Electron's `setDisplayMediaRequestHandler` with `audio: 'loopback'` (WASAPI)
4. Combine microphone and system audio streams
5. Add volume controls and mute toggles
6. Build audio level meters

**Key Files to Create:**
- `src/renderer/components/AudioControls/MicrophoneSelector.tsx`
- `src/renderer/components/AudioControls/SystemAudioToggle.tsx`
- `src/renderer/components/AudioControls/VolumeIndicator.tsx`
- `src/main/services/RecordingService.ts`

---

### Phase 4: Webcam Bubble Overlay
**Goal:** Floating draggable webcam window

**Tasks:**
1. Create frameless, always-on-top BrowserWindow for webcam
2. Implement webcam feed with `getUserMedia`
3. Add circular mask styling (CSS clip-path)
4. Enable window dragging
5. Add resize presets (small/medium/large)
6. Implement shape selector (circle, rounded, square)
7. Add webcam device selector
8. Track webcam position for FFmpeg compositing

**Key Files to Create:**
- `src/main/windows/webcamWindow.ts`
- `src/renderer/components/WebcamBubble/WebcamOverlay.tsx`
- `src/renderer/components/WebcamBubble/BubbleControls.tsx`
- `src/renderer/components/WebcamBubble/ShapeSelector.tsx`
- `src/renderer/hooks/useWebcam.ts`

---

### Phase 5: Drawing Tools
**Goal:** Transparent overlay for on-screen annotations

**Tasks:**
1. Create transparent full-screen overlay window
   - `transparent: true`, `frame: false`, `alwaysOnTop: true`
   - `setIgnoreMouseEvents(true, { forward: true })` for click-through
2. Implement Konva canvas for drawing
3. Build drawing tools:
   - Freehand pen
   - Arrow/line
   - Rectangle
   - Circle
   - Highlighter (semi-transparent)
4. Create floating toolbar with:
   - Tool selector
   - Color picker
   - Brush size
   - Undo/redo
   - Clear canvas
5. Capture drawings for video compositing

**Key Files to Create:**
- `src/main/windows/overlayWindow.ts`
- `src/overlay/index.html`
- `src/overlay/index.tsx`
- `src/overlay/DrawingOverlay.tsx`
- `src/renderer/components/DrawingTools/ToolPalette.tsx`
- `src/renderer/components/DrawingTools/ColorPicker.tsx`
- `src/preload/overlay.ts`

---

### Phase 6: FFmpeg Encoding
**Goal:** Convert recordings to MP4 with webcam overlay composited

**Tasks:**
1. Bundle FFmpeg binary with application
2. Set up fluent-ffmpeg with correct paths
3. Implement WebM to MP4 transcoding
4. Add webcam overlay compositing filter
5. Configure audio mixing in FFmpeg
6. Implement quality presets:

| Quality | Resolution | Bitrate | Codec |
|---------|------------|---------|-------|
| 720p    | 1280x720   | 6 Mbps  | H.264 (h264_nvenc) |
| 1080p   | 1920x1080  | 12 Mbps | H.264 (h264_nvenc) |
| 1440p   | 2560x1440  | 20 Mbps | H.265 (hevc_nvenc) |
| 4K      | 3840x2160  | 40 Mbps | H.265 (hevc_nvenc) |

7. Use NVIDIA NVENC hardware encoder (fall back to libx264 if unavailable)
8. Run encoding in background process

**Key Files to Create:**
- `src/main/services/FFmpegService.ts`
- `src/shared/constants/quality.ts`
- `src/shared/constants/codecs.ts`
- `resources/ffmpeg/win32/x64/ffmpeg.exe` (bundled binary)

---

### Phase 7: Video Library & Polish
**Goal:** View and manage recorded videos

**Tasks:**
1. Implement recording metadata storage
2. Build recording list with thumbnails
3. Implement search and filter
4. Create video player with playback controls
5. Add global keyboard shortcuts for recording
6. Implement error handling and recovery

**Key Files to Create:**
- `src/main/services/StorageService.ts`
- `src/renderer/components/Library/RecordingList.tsx`
- `src/renderer/components/Library/RecordingCard.tsx`
- `src/renderer/components/Library/VideoPlayer.tsx`
- `src/renderer/components/Settings/HotkeySettings.tsx`

---

## Key Dependencies

```json
{
  "dependencies": {
    "electron": "^33.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "konva": "^9.3.0",
    "react-konva": "^18.2.10",
    "fluent-ffmpeg": "^2.1.3",
    "electron-store": "^8.2.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.5.0",
    "@electron-forge/plugin-vite": "^7.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.3.0",
    "@types/fluent-ffmpeg": "^2.1.0"
  }
}
```

---

## Technical Notes

### System Audio Capture (Windows WASAPI)
```typescript
// In main process
session.defaultSession.setDisplayMediaRequestHandler(
  async (request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    callback({
      video: sources[0],
      audio: 'loopback'  // WASAPI loopback
    });
  }
);
```
- Requires Electron >= 31.0.1

### Transparent Drawing Overlay
```typescript
const overlay = new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  fullscreen: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload/overlay.js'),
    contextIsolation: true
  }
});
overlay.setIgnoreMouseEvents(true, { forward: true });
```

### Hardware Encoding (NVIDIA NVENC)
- Primary encoder: `h264_nvenc` for 720p/1080p, `hevc_nvenc` for 1440p/4K
- Fall back to `libx264`/`libx265` if NVENC unavailable
- NVENC provides ~10x faster encoding than software

### FFmpeg Webcam Compositing
```bash
ffmpeg -i screen.webm -i webcam.webm \
  -filter_complex "[1:v]scale=320:320[webcam];[0:v][webcam]overlay=x:y[out]" \
  -map "[out]" -map 0:a output.mp4
```

---

## Implementation Order

1. **Phase 1** - Project setup & basic window
2. **Phase 2** - Screen capture & basic recording
3. **Phase 3** - Audio capture (mic + system)
4. **Phase 4** - Webcam bubble overlay
5. **Phase 5** - Drawing tools
6. **Phase 6** - FFmpeg encoding & HD/4K
7. **Phase 7** - Library & polish

Each phase builds on the previous and results in a working (if incomplete) application.

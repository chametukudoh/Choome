import ffmpeg from 'fluent-ffmpeg';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const resolveFfmpegPath = (): string | null => {
  try {
    // Lazy require to avoid hard crash if the module or binary is missing in packaged builds.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as { path?: string };
    let binaryPath = ffmpegInstaller?.path;
    if (!binaryPath) {
      return null;
    }
    if (app.isPackaged && binaryPath.includes('app.asar')) {
      binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
    }
    return binaryPath;
  } catch (error) {
    console.warn('FFmpeg installer not available:', error);
    return null;
  }
};

// Set FFmpeg path (if available)
try {
  const ffmpegPath = resolveFfmpegPath();
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (error) {
  console.warn('Failed to set FFmpeg path:', error);
}

const escapeDrawtextValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

const resolveFontFile = (fontFamily?: string, bold?: boolean, italic?: boolean): string | null => {
  const isBold = Boolean(bold);
  const isItalic = Boolean(italic);
  const candidates: string[] = [];
  const family = (fontFamily ?? 'Arial').toLowerCase();

  if (process.platform === 'win32') {
    const winFontDir = path.join(process.env.WINDIR ?? 'C:\\\\Windows', 'Fonts');
    const fontMap: Record<string, { regular: string; bold: string; italic: string; boldItalic: string }> = {
      arial: { regular: 'arial.ttf', bold: 'arialbd.ttf', italic: 'ariali.ttf', boldItalic: 'arialbi.ttf' },
      calibri: { regular: 'calibri.ttf', bold: 'calibrib.ttf', italic: 'calibrii.ttf', boldItalic: 'calibriz.ttf' },
      'times new roman': { regular: 'times.ttf', bold: 'timesbd.ttf', italic: 'timesi.ttf', boldItalic: 'timesbi.ttf' },
      'courier new': { regular: 'cour.ttf', bold: 'courbd.ttf', italic: 'couri.ttf', boldItalic: 'courbi.ttf' },
      verdana: { regular: 'verdana.ttf', bold: 'verdanab.ttf', italic: 'verdanai.ttf', boldItalic: 'verdanaz.ttf' },
    };
    const selected = fontMap[family] ?? fontMap.arial;
    if (isBold && isItalic) {
      candidates.push(selected.boldItalic);
    } else if (isBold) {
      candidates.push(selected.bold);
    } else if (isItalic) {
      candidates.push(selected.italic);
    } else {
      candidates.push(selected.regular);
    }
    if (selected !== fontMap.arial) {
      candidates.push(fontMap.arial.regular, fontMap.arial.bold, fontMap.arial.italic, fontMap.arial.boldItalic);
    }
    for (const font of candidates) {
      const fontPath = path.join(winFontDir, font);
      if (fs.existsSync(fontPath)) {
        return fontPath;
      }
    }
  } else if (process.platform === 'darwin') {
    const macFontDir = '/System/Library/Fonts/Supplemental';
    const fontMap: Record<string, { regular: string; bold: string; italic: string; boldItalic: string }> = {
      arial: { regular: 'Arial.ttf', bold: 'Arial Bold.ttf', italic: 'Arial Italic.ttf', boldItalic: 'Arial Bold Italic.ttf' },
      helvetica: { regular: 'Helvetica.ttf', bold: 'Helvetica Bold.ttf', italic: 'Helvetica Oblique.ttf', boldItalic: 'Helvetica Bold Italic.ttf' },
    };
    const selected = fontMap[family] ?? fontMap.arial;
    if (isBold && isItalic) {
      candidates.push(selected.boldItalic);
    } else if (isBold) {
      candidates.push(selected.bold);
    } else if (isItalic) {
      candidates.push(selected.italic);
    } else {
      candidates.push(selected.regular);
    }
    if (selected !== fontMap.arial) {
      candidates.push(fontMap.arial.regular, fontMap.arial.bold, fontMap.arial.italic, fontMap.arial.boldItalic);
    }
    for (const font of candidates) {
      const fontPath = path.join(macFontDir, font);
      if (fs.existsSync(fontPath)) {
        return fontPath;
      }
    }
  } else {
    const linuxFonts = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    ];
    if (isBold && isItalic) {
      candidates.push(linuxFonts[3]);
    } else if (isBold) {
      candidates.push(linuxFonts[1]);
    } else if (isItalic) {
      candidates.push(linuxFonts[2]);
    } else {
      candidates.push(linuxFonts[0]);
    }
    for (const fontPath of candidates) {
      if (fs.existsSync(fontPath)) {
        return fontPath;
      }
    }
  }

  return null;
};

export interface WebcamOverlayConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'circle' | 'rounded' | 'square';
}

export interface CompositeOptions {
  videoPath: string;
  webcamPath: string;
  outputPath: string;
  webcamConfig: WebcamOverlayConfig;
  onProgress?: (progress: number) => void;
}

export class FFmpegService {
  /**
   * Composite webcam overlay onto main recording
   */
  async compositeWebcam(options: CompositeOptions): Promise<string> {
    const { videoPath, webcamPath, outputPath, webcamConfig, onProgress } = options;

    return new Promise((resolve, reject) => {
      // Build filter for webcam overlay
      let overlayFilter = `[1:v]scale=${webcamConfig.width}:${webcamConfig.height}`;

      // Add shape filter
      if (webcamConfig.shape === 'circle') {
        overlayFilter += `,geq=lum='p(X,Y)':a='if(gt(hypot(X-W/2,Y-H/2),min(W/2,H/2)),0,255)'`;
      } else if (webcamConfig.shape === 'rounded') {
        overlayFilter += `,roundrect=30`;
      }

      overlayFilter += `[webcam];[0:v][webcam]overlay=${webcamConfig.x}:${webcamConfig.y}`;

      const command = ffmpeg()
        .input(videoPath)
        .input(webcamPath)
        .complexFilter([overlayFilter])
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-c:a copy',
        ])
        .output(outputPath);

      // Progress tracking
      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => {
        console.log('FFmpeg compositing completed');
        resolve(outputPath);
      });

      command.on('error', (error) => {
        console.error('FFmpeg error:', error);
        reject(error);
      });

      command.run();
    });
  }

  /**
   * Extract audio from a video file
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libopus')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Merge multiple audio tracks into video
   */
  async mergeAudio(
    videoPath: string,
    audioTracks: string[],
    outputPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg().input(videoPath);

      // Add all audio inputs
      audioTracks.forEach((audioPath) => {
        command.input(audioPath);
      });

      // Build filter for mixing audio
      const audioInputs = audioTracks
        .map((_, index) => `[${index + 1}:a]`)
        .join('');
      const mixFilter = `${audioInputs}amix=inputs=${audioTracks.length}:duration=longest[aout]`;

      command
        .complexFilter([mixFilter])
        .outputOptions([
          '-map 0:v',
          '-map [aout]',
          '-c:v copy',
          '-c:a libopus',
          '-b:a 128k',
        ])
        .output(outputPath);

      // Progress tracking
      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => {
        console.log('Audio merge completed');
        resolve(outputPath);
      });

      command.on('error', (error) => {
        console.error('FFmpeg audio merge error:', error);
        reject(error);
      });

      command.run();
    });
  }

  /**
   * Trim video
   */
  async trimVideo(
    videoPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .outputOptions(['-c:v libx264', '-c:a copy'])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Crop video
   */
  async cropVideo(
    videoPath: string,
    outputPath: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .videoFilters(`crop=${width}:${height}:${x}:${y}`)
        .outputOptions(['-c:a copy'])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Add text overlay to video
   */
  async addTextOverlay(
    videoPath: string,
    outputPath: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string,
    startTime: number,
    duration: number,
    bold?: boolean,
    italic?: boolean,
    fontFamily?: string,
    align: 'left' | 'center' | 'right' = 'left',
    animate = false,
    endX?: number,
    endY?: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fontColor = color.replace('#', '');
      const safeText = escapeDrawtextValue(text);
      const fontFile = resolveFontFile(fontFamily, bold, italic);
      const fontFileOption = fontFile ? `:fontfile='${escapeDrawtextValue(fontFile)}'` : '';
      const endTime = startTime + duration;
      const useAnimation = animate && duration > 0;
      const effectiveEndX = Number.isFinite(endX) ? endX : x;
      const effectiveEndY = Number.isFinite(endY) ? endY : y;

      const xExpr = useAnimation
        ? `if(lte(t,${startTime}),${x},if(gte(t,${endTime}),${effectiveEndX},${x}+(${effectiveEndX}-${x})*(t-${startTime})/${duration}))`
        : `${x}`;
      const yExpr = useAnimation
        ? `if(lte(t,${startTime}),${y},if(gte(t,${endTime}),${effectiveEndY},${y}+(${effectiveEndY}-${y})*(t-${startTime})/${duration}))`
        : `${y}`;

      const alignOffset = align === 'center' ? 'text_w/2' : align === 'right' ? 'text_w' : '0';
      const alignedX = alignOffset === '0' ? xExpr : `(${xExpr})-${alignOffset}`;

      const textFilter = `drawtext=text='${safeText}':x=${alignedX}:y=${yExpr}:fontsize=${fontSize}:fontcolor=0x${fontColor}${fontFileOption}:enable='between(t,${startTime},${endTime})'`;

      const command = ffmpeg(videoPath)
        .videoFilters(textFilter)
        .outputOptions(['-c:a copy'])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Render a timeline by trimming and concatenating segments.
   */
  async renderTimeline(
    videoPath: string,
    outputPath: string,
    segments: { start: number; end: number }[],
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (segments.length === 0) {
        reject(new Error('No timeline segments provided'));
        return;
      }

      const filterParts: string[] = [];
      const concatInputs: string[] = [];

      segments.forEach((segment, index) => {
        const start = Math.max(0, segment.start);
        const end = Math.max(start + 0.1, segment.end);
        filterParts.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`);
        filterParts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`);
        concatInputs.push(`[v${index}][a${index}]`);
      });

      filterParts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`);

      const command = ffmpeg(videoPath)
        .complexFilter(filterParts)
        .outputOptions([
          '-map [outv]',
          '-map [outa]',
          '-c:v libx264',
          '-preset medium',
          '-crf 22',
          '-c:a aac',
          '-b:a 192k',
        ])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Generate a lightweight proxy for editing previews.
   */
  async generateProxy(
    videoPath: string,
    outputPath: string,
    width = 960,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .videoFilters(`scale=${width}:-2`)
        .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 28', '-c:a aac', '-b:a 128k'])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Apply audio filters (volume, mute, fade in/out).
   */
  async applyAudioFilters(
    videoPath: string,
    outputPath: string,
    options: {
      volume: number;
      muted: boolean;
      fadeIn: number;
      fadeOut: number;
      duration: number;
    },
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const filters: string[] = [];
      const volume = options.muted ? 0 : Math.max(0, options.volume) / 100;
      filters.push(`volume=${volume}`);

      if (options.fadeIn > 0) {
        filters.push(`afade=t=in:st=0:d=${options.fadeIn}`);
      }

      if (options.fadeOut > 0) {
        const start = Math.max(0, options.duration - options.fadeOut);
        filters.push(`afade=t=out:st=${start}:d=${options.fadeOut}`);
      }

      const command = ffmpeg(videoPath)
        .audioFilters(filters.join(','))
        .outputOptions(['-c:v copy', '-c:a aac', '-b:a 192k'])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Transcode video to a preset size/bitrate.
   */
  async transcodePreset(
    videoPath: string,
    outputPath: string,
    options: { width: number; height: number; bitrate: string; encoder?: 'auto' | 'cpu' | 'nvenc' | 'qsv' | 'amf'; optimizeForSize?: boolean },
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const encoder = options.encoder ?? 'auto';
      const useHardware = encoder !== 'auto' && encoder !== 'cpu';
      const selectedEncoder =
        encoder === 'nvenc'
          ? 'h264_nvenc'
          : encoder === 'qsv'
          ? 'h264_qsv'
          : encoder === 'amf'
          ? 'h264_amf'
          : 'libx264';

      const command = ffmpeg(videoPath);
      if (options.width > 0 && options.height > 0) {
        command.videoFilters(`scale=${options.width}:${options.height}`);
      }

      const outputOptions: string[] = [];

      if (useHardware) {
        outputOptions.push(`-c:v ${selectedEncoder}`);
        outputOptions.push(`-b:v ${options.bitrate}`);
        outputOptions.push('-maxrate', options.bitrate, '-bufsize', options.bitrate);
        if (options.optimizeForSize) {
          outputOptions.push('-rc:v vbr', '-cq', '25');
        }
      } else {
        outputOptions.push('-c:v libx264');
        if (options.optimizeForSize) {
          outputOptions.push('-preset slow', '-crf 28');
        } else {
          outputOptions.push('-preset medium', `-b:v ${options.bitrate}`, '-maxrate', options.bitrate, '-bufsize', options.bitrate);
        }
      }

      outputOptions.push('-c:a aac', '-b:a 192k');

      command.outputOptions(outputOptions).output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      });

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Generate an audio waveform image for a timeline preview.
   */
  async generateWaveformImage(
    videoPath: string,
    outputPath: string,
    width = 1280,
    height = 200
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .outputOptions([
          '-filter_complex',
          `showwavespic=s=${width}x${height}:colors=white`,
          '-frames:v',
          '1',
        ])
        .output(outputPath);

      command.on('end', () => resolve(outputPath));
      command.on('error', reject);

      command.run();
    });
  }

  /**
   * Get video metadata
   */
  async getMetadata(videoPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp = 1
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x180',
        })
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }
}

// Singleton instance
let ffmpegService: FFmpegService | null = null;

export function getFFmpegService(): FFmpegService {
  if (!ffmpegService) {
    ffmpegService = new FFmpegService();
  }
  return ffmpegService;
}

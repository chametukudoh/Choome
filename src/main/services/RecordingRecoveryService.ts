import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getFFmpegService } from './FFmpegService';
import type { Recording, QualityPreset } from '../../shared/types';
import type { StorageService } from './StorageService';

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export class RecordingRecoveryService {
  private storageService: StorageService;
  private active: Map<string, string>;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
    this.active = new Map();
  }

  begin(mimeType: string): { id: string; path: string } {
    const id = randomUUID();
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'webm';
    const tempDir = this.storageService.getTempPath();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, `recovery-${id}.${extension}`);
    fs.writeFileSync(filePath, Buffer.alloc(0));
    this.active.set(id, filePath);
    return { id, path: filePath };
  }

  append(id: string, buffer: Buffer): void {
    const filePath = this.active.get(id);
    if (!filePath) return;
    fs.appendFileSync(filePath, buffer);
  }

  async finalize(id: string, meta: { duration: number; quality: QualityPreset }): Promise<Recording> {
    const filePath = this.active.get(id);
    if (!filePath) {
      throw new Error('Recovery session not found');
    }

    const extension = path.extname(filePath).replace('.', '') || 'webm';
    const outputPath = this.storageService.generateRecordingPath(extension);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.renameSync(filePath, outputPath);
    this.active.delete(id);

    const stats = fs.statSync(outputPath);
    const createdAt = new Date().toISOString();
    const name = path.basename(outputPath, path.extname(outputPath));

    let thumbnailPath: string | undefined;
    try {
      const ffmpegService = getFFmpegService();
      const basePath = outputPath.replace(/\.\w+$/, '');
      const thumbnailOutput = `${basePath}.jpg`;
      const safeTimestamp = meta.duration > 1 ? 1 : undefined;
      await ffmpegService.generateThumbnail(outputPath, thumbnailOutput, safeTimestamp);
      thumbnailPath = thumbnailOutput;
    } catch (error) {
      console.warn('Failed to generate thumbnail for recovered recording:', error);
    }

    const recording: Recording = {
      id,
      name,
      path: outputPath,
      duration: meta.duration,
      fileSize: stats.size,
      quality: meta.quality,
      createdAt,
      thumbnailPath,
      deletedAt: null,
    };

    this.storageService.addRecording(recording);
    return recording;
  }

  discard(id: string): void {
    const filePath = this.active.get(id);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.active.delete(id);
  }

  async recoverOrphaned(): Promise<Recording[]> {
    const recovered: Recording[] = [];
    const tempDir = this.storageService.getTempPath();
    if (!fs.existsSync(tempDir)) return recovered;

    const entries = fs.readdirSync(tempDir);
    for (const entry of entries) {
      if (!entry.startsWith('recovery-')) continue;
      const filePath = path.join(tempDir, entry);
      const stats = fs.statSync(filePath);
      if (!stats.isFile() || stats.size === 0) continue;

      const extension = path.extname(filePath).replace('.', '') || 'webm';
      const outputPath = this.storageService.generateRecordingPath(extension);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.renameSync(filePath, outputPath);

      let duration = 0;
      try {
        const ffmpegService = getFFmpegService();
        const metadata = await ffmpegService.getMetadata(outputPath);
        duration = metadata.format?.duration ? Math.round(metadata.format.duration) : 0;
      } catch {
        duration = 0;
      }

      const createdAt = new Date(stats.mtimeMs).toISOString();
      const name = path.basename(outputPath, path.extname(outputPath));
      const recording: Recording = {
        id: randomUUID(),
        name: `${name}-recovered`,
        path: outputPath,
        duration,
        fileSize: stats.size,
        quality: '1080p',
        createdAt,
        deletedAt: null,
      };

      this.storageService.addRecording(recording);
      recovered.push(recording);
    }

    return recovered;
  }
}

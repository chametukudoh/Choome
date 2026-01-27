export type QualityPreset = '720p' | '1080p' | '1440p' | '4k';

export interface QualityConfig {
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
  codec: 'h264' | 'h265';
  hwEncoder: string;
  swEncoder: string;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  '720p': {
    width: 1280,
    height: 720,
    videoBitrate: '6M',
    audioBitrate: '256k',
    codec: 'h264',
    hwEncoder: 'h264_nvenc',
    swEncoder: 'libx264',
  },
  '1080p': {
    width: 1920,
    height: 1080,
    videoBitrate: '12M',
    audioBitrate: '256k',
    codec: 'h264',
    hwEncoder: 'h264_nvenc',
    swEncoder: 'libx264',
  },
  '1440p': {
    width: 2560,
    height: 1440,
    videoBitrate: '20M',
    audioBitrate: '320k',
    codec: 'h265',
    hwEncoder: 'hevc_nvenc',
    swEncoder: 'libx265',
  },
  '4k': {
    width: 3840,
    height: 2160,
    videoBitrate: '40M',
    audioBitrate: '320k',
    codec: 'h265',
    hwEncoder: 'hevc_nvenc',
    swEncoder: 'libx265',
  },
};

export function getQualityConfig(preset: QualityPreset): QualityConfig {
  return QUALITY_PRESETS[preset];
}

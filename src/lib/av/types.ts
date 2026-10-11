export type AvMode = 'gif' | 'compress' | 'audio' | 'trim' | 'frame' | 'audio-edit' | 'convert';
export interface AvSettings {
  width: number;
  fps: number;
  bitrate: number;
  videoFormat: 'mp4' | 'webm';
  audioFormat: 'wav' | 'm4a' | 'ogg' | 'mp3';
  imageFormat: 'png' | 'jpeg';
  quality: number;
  interval: number;
  trimMode: 'copy' | 'exact';
  dither: boolean;
  audioBitrate: number;
  rotation: 0 | 90 | 180 | 270;
  mute: boolean;
}
export const DEFAULT_AV: AvSettings = {
  width: 1280,
  fps: 12,
  bitrate: 2,
  videoFormat: 'mp4',
  audioFormat: 'wav',
  imageFormat: 'png',
  quality: 0.92,
  interval: 5,
  trimMode: 'copy',
  dither: true,
  audioBitrate: 128,
  rotation: 0,
  mute: false
};
export interface MediaInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  hasVideo: boolean;
  videoCodec: string;
  audioCodec: string;
}
export interface MediaResult {
  blob: Blob;
  name: string;
  note?: string;
  timestamp?: number;
  frameDuration?: number;
}
export type AvRequest =
  | { kind: 'load'; file: File }
  | { kind: 'frame'; time: number; direction?: -1 | 1; settings: AvSettings }
  | { kind: 'run'; mode: AvMode; start: number; end: number; settings: AvSettings; batch?: boolean };

export type Fmt = 'keep' | 'webp' | 'avif' | 'jpeg';

export interface Settings {
  fmt: Fmt;
  quality: number;
  stripExif: boolean;
  maxWidth: number; // 0 = 不限
}

export interface Job extends Settings {
  id: string;
  gen: number;
  file: File;
}

export interface Output {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
  kept: boolean; // 压不动，直接用原图
  lossless: boolean;
  exifKept: boolean;
}

export type JobResult = ({ id: string; gen: number; ok: true } & Output) | { id: string; gen: number; ok: false; error: string };

export const FMT_LABEL: Record<Fmt, string> = { keep: '原格式', webp: 'WebP', avif: 'AVIF', jpeg: 'JPEG' };

export const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};

export const TYPE_LABEL: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF'
};

export const DEFAULT_SETTINGS: Settings = { fmt: 'webp', quality: 80, stripExif: true, maxWidth: 0 };

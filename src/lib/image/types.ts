export type Mode = 'convert' | 'resize' | 'crop' | 'exif' | 'watermark' | 'svg';
export interface Settings {
  format: string;
  quality: number;
  resizeMode: string;
  width: number;
  height: number;
  percent: number;
  keepRatio: boolean;
  x: number;
  y: number;
  cropWidth: number;
  cropHeight: number;
  cropPixels: number;
  rotation: number;
  flip: boolean;
  text: string;
  opacity: number;
  size: number;
  position: string;
  tile: boolean;
  precision: number;
  removeDimensions: boolean;
  cleanupIds: boolean;
}
export const defaults: Settings = {
  format: 'png',
  quality: 85,
  resizeMode: 'long',
  width: 1920,
  height: 1080,
  percent: 50,
  keepRatio: true,
  // 裁剪框默认留一圈边，一眼能看出框在哪、可以拖
  x: 10,
  y: 10,
  cropWidth: 80,
  cropHeight: 80,
  cropPixels: 0,
  rotation: 0,
  flip: false,
  text: '顺手',
  opacity: 45,
  size: 6,
  position: 'bottom-right',
  tile: false,
  precision: 3,
  removeDimensions: false,
  cleanupIds: false
};
export interface Job {
  mode: Mode;
  file: File;
  settings: Settings;
  watermark?: File;
  inspect?: boolean;
}
export interface Result {
  blob: Blob;
  extension: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
  gps?: boolean;
  note?: string;
}

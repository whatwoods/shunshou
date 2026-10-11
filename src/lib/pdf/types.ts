export type PdfMode =
  'merge' | 'split' | 'to-image' | 'from-image' | 'organize' | 'compress' | 'page-numbers' | 'extract-text' | 'extract-images';
export interface PdfSource {
  id: string;
  name: string;
  size: number;
  count: number;
  image: boolean;
}
export interface PdfPageItem {
  id: string;
  source: string;
  index: number;
  rotation: number;
}
export interface PdfSettings {
  compression: 'preserve' | 'raster';
  name: string;
  a4: boolean;
  paper: 'a4' | 'letter' | 'original';
  landscape: boolean;
  margin: number;
  split: 'ranges' | 'every' | 'each';
  ranges: string;
  every: number;
  format: 'png' | 'jpeg';
  dpi: number;
  quality: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  numberStyle: 'plain' | 'chinese' | 'total';
  start: number;
  fontSize: number;
  skipCover: boolean;
}
export const PDF_DEFAULTS: PdfSettings = {
  compression: 'preserve',
  name: '',
  a4: false,
  paper: 'a4',
  landscape: false,
  margin: 12,
  split: 'ranges',
  ranges: '',
  every: 2,
  format: 'png',
  dpi: 150,
  quality: 75,
  position: 'bottom-center',
  numberStyle: 'plain',
  start: 1,
  fontSize: 12,
  skipCover: false
};
export interface PdfOutput {
  name: string;
  blob: Blob;
  note?: string;
}
export type PdfRequest =
  | { op: 'load'; id: string; file: File }
  | { op: 'thumbnail'; source: string; index: number }
  | { op: 'release'; source: string }
  | { op: 'export'; mode: PdfMode; pages: PdfPageItem[]; settings: PdfSettings };

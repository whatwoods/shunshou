// 在 Web Worker 里解码、缩放、编码。编码器是 Squoosh 的 WebAssembly 版（jSquash），按需加载
import type { Job, JobResult, Output } from './types';
import { jpegExifSegment, jpegInsert, jpegOrientation, jpegStripMeta, pngStripMeta, sniffType } from './fileMeta';

// DOM 和 WebWorker 两套类型不能同时启用，这里只描述用得到的部分
const scope = self as unknown as {
  onmessage: (e: MessageEvent<Job>) => void;
  postMessage: (res: JobResult) => void;
};

const OUT_TYPE = { webp: 'image/webp', avif: 'image/avif', jpeg: 'image/jpeg' } as const;
const ENCODABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

async function encode(img: ImageData, type: string, quality: number): Promise<ArrayBuffer> {
  switch (type) {
    case 'image/webp': {
      const { default: enc } = await import('@jsquash/webp/encode');
      return enc(img, { quality });
    }
    case 'image/avif': {
      // 同样的“画质”数字，AVIF 要低一些才和 WebP、JPEG 的观感相当（Squoosh 默认 WebP 75 ≈ AVIF 50）
      const { default: enc } = await import('@jsquash/avif/encode');
      return enc(img, { quality: Math.round(quality * 0.66), speed: 8 });
    }
    case 'image/jpeg': {
      const { default: enc } = await import('@jsquash/jpeg/encode');
      return enc(img, { quality });
    }
    default: {
      const { default: optimise } = await import('@jsquash/oxipng/optimise');
      return optimise(img, { level: 2 });
    }
  }
}

// 原图不带元数据的版本；做不到（比如方向依赖 EXIF）就返回 null
function originalWithoutMeta(src: Uint8Array, type: string): Uint8Array | null {
  if (type === 'image/jpeg') return jpegOrientation(src) === 1 ? jpegStripMeta(src) : null;
  if (type === 'image/png') return pngStripMeta(src);
  return null;
}

async function run(job: Job): Promise<Output> {
  const src = new Uint8Array(await job.file.arrayBuffer());
  const srcType = sniffType(src) || job.file.type;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(job.file, { imageOrientation: 'from-image' });
  } catch {
    // 浏览器自己打不开 HEIC、AVIF 时，用和格式转换同一套 WebAssembly 解码器
    if (srcType !== 'image/heic' && srcType !== 'image/avif') throw new Error('这个格式浏览器打不开');
    const { decode } = await import('../../lib/image/decode');
    const named = srcType === 'image/heic' && !/\.(heic|heif)$/i.test(job.file.name) ? new File([job.file], 'photo.heic') : job.file;
    bmp = await decode(named);
  }

  const srcWidth = bmp.width,
    srcHeight = bmp.height;
  const scale = job.maxWidth > 0 && srcWidth > job.maxWidth ? job.maxWidth / srcWidth : 1;
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));
  // “原格式”遇到编不回去的格式：HEIC 照片存成 JPEG（存 PNG 会比原图大好几倍），其他的存 PNG
  const type =
    job.fmt === 'keep' ? (ENCODABLE.has(srcType) ? srcType : srcType === 'image/heic' ? 'image/jpeg' : 'image/png') : OUT_TYPE[job.fmt];

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (type === 'image/jpeg') {
    // JPEG 没有透明通道，透明处垫白
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const img = ctx.getImageData(0, 0, width, height);

  let bytes: Uint8Array = new Uint8Array(await encode(img, type, job.quality));
  const lossless = type === 'image/png';
  let exifKept = false;

  // 重新编码本身就会去掉所有元数据；不去除时，只有 JPEG → JPEG 能把 EXIF 搬回去
  if (!job.stripExif && type === 'image/jpeg' && srcType === 'image/jpeg') {
    const seg = jpegExifSegment(src);
    if (seg) {
      bytes = jpegInsert(bytes, seg);
      exifKept = true;
    }
  }

  // 格式没变、没缩放，结果反而更大：直接用原图
  if (scale === 1 && type === srcType && bytes.length >= src.length) {
    const orig = job.stripExif ? originalWithoutMeta(src, srcType) : src;
    if (orig && orig.length <= bytes.length) {
      return {
        blob: new Blob([orig as BlobPart], { type }),
        type,
        width,
        height,
        srcWidth,
        srcHeight,
        kept: true,
        lossless,
        exifKept: !job.stripExif
      };
    }
  }

  return { blob: new Blob([bytes as BlobPart], { type }), type, width, height, srcWidth, srcHeight, kept: false, lossless, exifKept };
}

scope.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  let res: JobResult;
  try {
    res = { id: job.id, gen: job.gen, ok: true, ...(await run(job)) };
  } catch (err) {
    res = { id: job.id, gen: job.gen, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  scope.postMessage(res);
};

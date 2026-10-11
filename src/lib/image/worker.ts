import type { Job, Result } from './types';
import { dimensions, bmpBytes, stripMetadata, preserveOrientation } from './logic';
import { decode } from './decode';
function keepFormat(file: File) {
  const t = file.type || '';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (t === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg' || t === 'image/heic' || t === 'image/heif' || ext === 'heic' || ext === 'heif')
    return 'jpeg';
  if (t === 'image/webp' || ext === 'webp') return 'webp';
  if (t === 'image/avif' || ext === 'avif') return 'avif';
  return 'png';
}
async function run({ file, mode, settings: s, watermark, inspect }: Job): Promise<Result> {
  if (mode === 'svg') {
    const { optimize } = await import('svgo/browser');
    const text = await file.text();
    const result = optimize(text, {
      floatPrecision: s.precision,
      multipass: true,
      plugins: [
        { name: 'preset-default', params: { overrides: { cleanupIds: s.cleanupIds ? {} : false } } },
        ...(s.removeDimensions ? ['removeDimensions' as const] : [])
      ]
    });
    return { blob: new Blob([result.data], { type: 'image/svg+xml' }), extension: 'svg' };
  }
  if (mode === 'exif') {
    const { default: exifr } = await import('exifr');
    const metadata =
      (await exifr
        .parse(await file.arrayBuffer(), { tiff: true, xmp: true, iptc: true, gps: true, translateValues: false })
        .catch(() => null)) ?? {};
    if (inspect)
      return {
        blob: file,
        extension: file.name.split('.').pop()!,
        metadata,
        gps: metadata.latitude !== undefined || metadata.GPSLatitude !== undefined
      };
    const clean = stripMetadata(new Uint8Array(await file.arrayBuffer()));
    return {
      blob: new Blob([preserveOrientation(clean.bytes, clean.extension, Number(metadata.Orientation)) as BlobPart], { type: file.type }),
      extension: clean.extension,
      metadata,
      gps: metadata.latitude !== undefined || metadata.GPSLatitude !== undefined,
      note: metadata.Orientation && metadata.Orientation !== 1 ? '仅保留显示方向，不包含拍摄信息。' : undefined
    };
  }
  const bmp = await decode(file);
  let width = bmp.width,
    height = bmp.height;
  let canvas = new OffscreenCanvas(width, height);
  let ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (mode === 'crop') {
    const rotated = s.rotation % 180 !== 0;
    const rw = rotated ? height : width,
      rh = rotated ? width : height;
    canvas = new OffscreenCanvas(rw, rh);
    ctx = canvas.getContext('2d')!;
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.scale(s.flip ? -1 : 1, 1);
    ctx.drawImage(bmp, -width / 2, -height / 2);
    bmp.close();
    const x = Math.round((s.x / 100) * rw),
      y = Math.round((s.y / 100) * rh);
    width = Math.max(1, Math.round((Math.min(s.cropWidth, 100 - s.x) / 100) * rw));
    height = Math.max(1, Math.round((Math.min(s.cropHeight, 100 - s.y) / 100) * rh));
    const cropped = new OffscreenCanvas(width, height);
    cropped.getContext('2d')!.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    canvas = cropped;
    ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  } else {
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
  }
  if (mode === 'resize' || (mode === 'crop' && s.cropPixels > 0)) {
    const target =
      mode === 'crop'
        ? { width: s.cropPixels, height: Math.max(1, Math.round((height * s.cropPixels) / width)) }
        : dimensions(width, height, s.resizeMode, s.width, s.height, s.percent, s.keepRatio);
    const { default: resize } = await import('@jsquash/resize');
    const pixels = await resize(ctx.getImageData(0, 0, width, height), { ...target, method: 'lanczos3' });
    width = target.width;
    height = target.height;
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(pixels, 0, 0);
  }
  if (mode === 'watermark') {
    const logo = watermark ? await decode(watermark) : null;
    const size = Math.max(12, (width * s.size) / 100);
    ctx.globalAlpha = s.opacity / 100;
    ctx.font = `600 ${size}px sans-serif`;
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = Math.max(1, size / 30);
    ctx.textBaseline = 'top';
    const ww = logo ? size * 4 : ctx.measureText(s.text).width,
      wh = logo ? (size * 4 * logo.height) / logo.width : size * 1.2;
    const pad = Math.max(10, width * 0.025);
    const draw = (x: number, y: number) => {
      if (logo) ctx.drawImage(logo, x, y, ww, wh);
      else {
        ctx.strokeText(s.text, x, y);
        ctx.fillText(s.text, x, y);
      }
    };
    if (s.tile) {
      for (let y = pad; y < height; y += wh + size * 2) for (let x = pad; x < width; x += ww + size * 2) draw(x, y);
    } else
      draw(
        s.position.includes('right') ? width - ww - pad : s.position === 'center' ? (width - ww) / 2 : pad,
        s.position.includes('bottom') ? height - wh - pad : s.position === 'center' ? (height - wh) / 2 : pad
      );
    logo?.close();
    ctx.globalAlpha = 1;
  }
  // 「原格式」：照片还是 JPEG，截图还是 PNG；HEIC、GIF、BMP 这类不适合原样输出的换成最接近的通用格式
  const format = s.format === 'keep' ? keepFormat(file) : s.format;
  if (['jpeg', 'bmp', 'gif'].includes(format)) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
  }
  const pixels = ctx.getImageData(0, 0, width, height);
  let blob: Blob;
  if (format === 'avif') {
    const { default: encode } = await import('@jsquash/avif/encode');
    blob = new Blob([await encode(pixels, { quality: s.quality, speed: 8 })], { type: 'image/avif' });
  } else if (format === 'gif') {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const palette = quantize(pixels.data, 256);
    const encoder = GIFEncoder();
    encoder.writeFrame(applyPalette(pixels.data, palette), width, height, { palette });
    encoder.finish();
    blob = new Blob([encoder.bytes() as BlobPart], { type: 'image/gif' });
  } else if (format === 'bmp') blob = new Blob([bmpBytes(pixels.data, width, height)], { type: 'image/bmp' });
  else {
    blob = await canvas.convertToBlob({ type: `image/${format}`, quality: s.quality / 100 });
    if (blob.type !== `image/${format}`) throw new Error('浏览器不支持这个输出格式，请选择 PNG 或 JPEG');
  }
  return { blob, extension: format === 'jpeg' ? 'jpg' : format, width, height };
}
self.onmessage = async (e: MessageEvent<Job>) => {
  try {
    self.postMessage({ ok: true, result: await run(e.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

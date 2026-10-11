import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFNumber, decodePDFRawStream } from '@cantoo/pdf-lib';
import type { PdfOutput } from './types';

const key = PDFName.of;
export interface ImageEntry {
  ref: PDFRef;
  stream: PDFRawStream;
}
export interface ImageReport {
  total: number;
  changed: number;
  skipped: number;
  unchanged: number;
  reasons: Record<string, number>;
}
export function imageObjects(doc: PDFDocument): ImageEntry[] {
  const images = new Map<string, ImageEntry>(),
    visited = new Set<PDFRawStream>();
  function visit(resources: PDFDict | undefined) {
    const objects = resources?.lookup(key('XObject'));
    if (!(objects instanceof PDFDict)) return;
    for (const [, reference] of objects.entries()) {
      if (!(reference instanceof PDFRef)) continue;
      const object = doc.context.lookup(reference);
      if (!(object instanceof PDFRawStream) || visited.has(object)) continue;
      visited.add(object);
      const type = object.dict.lookup(key('Subtype'));
      if (type === key('Image')) images.set(reference.toString(), { ref: reference, stream: object });
      if (type === key('Form')) {
        const nested = object.dict.lookup(key('Resources'));
        visit(nested instanceof PDFDict ? nested : resources);
      }
    }
  }
  for (const page of doc.getPages()) visit(page.node.Resources());
  return [...images.values()];
}
function number(dict: PDFDict, name: string) {
  const value = dict.lookup(key(name));
  return value instanceof PDFNumber ? value.asNumber() : 0;
}
function maskReferences(doc: PDFDocument) {
  const refs = new Set<string>();
  for (const [, object] of doc.context.enumerateIndirectObjects())
    if (object instanceof PDFRawStream) {
      for (const name of ['Mask', 'SMask']) {
        const ref = object.dict.get(key(name));
        if (ref instanceof PDFRef) refs.add(ref.toString());
      }
    }
  return refs;
}
function unsupported(stream: PDFRawStream, allowSoftMask: boolean): string | null {
  const dict = stream.dict,
    color = dict.lookup(key('ColorSpace'));
  if (dict.has(key('ImageMask')) || dict.has(key('Mask')) || (!allowSoftMask && dict.has(key('SMask')))) return '蒙版或透明图片';
  const decode = dict.lookup(key('Decode'));
  const channels = color === key('DeviceRGB') ? 3 : 1;
  if (
    decode &&
    (!(decode instanceof PDFArray) ||
      decode.size() !== channels * 2 ||
      decode.asArray().some((value, i) => !(value instanceof PDFNumber) || value.asNumber() !== i % 2))
  )
    return '特殊解码参数';
  if (dict.has(key('DecodeParms'))) return '特殊解码参数';
  if (color !== key('DeviceRGB') && color !== key('DeviceGray')) return '特殊颜色空间';
  if (number(dict, 'BitsPerComponent') !== 8) return '非 8 位图片';
  const filter = dict.lookup(key('Filter'));
  if (filter && filter !== key('DCTDecode') && filter !== key('FlateDecode')) return '不支持的图片编码';
  const width = number(dict, 'Width'),
    height = number(dict, 'Height');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 50_000_000)
    return '图片尺寸超出处理范围';
  return null;
}
async function decodeImage(stream: PDFRawStream): Promise<OffscreenCanvas> {
  const width = number(stream.dict, 'Width'),
    height = number(stream.dict, 'Height');
  const canvas = new OffscreenCanvas(width, height),
    ctx = canvas.getContext('2d')!;
  if (stream.dict.lookup(key('Filter')) === key('DCTDecode')) {
    const bitmap = await createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }), {
      imageOrientation: 'none',
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none'
    });
    try {
      if (bitmap.width !== width || bitmap.height !== height) throw new Error('JPEG 尺寸与 PDF 定义不一致');
      ctx.drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }
  } else {
    const bytes = decodePDFRawStream(stream).decode();
    const channels = stream.dict.lookup(key('ColorSpace')) === key('DeviceRGB') ? 3 : 1;
    if (bytes.length !== width * height * channels) throw new Error('图片像素长度不匹配');
    const pixels = ctx.createImageData(width, height);
    for (let i = 0, j = 0; i < bytes.length; i += channels, j += 4) {
      pixels.data[j] = bytes[i];
      pixels.data[j + 1] = bytes[i + (channels === 3 ? 1 : 0)];
      pixels.data[j + 2] = bytes[i + (channels === 3 ? 2 : 0)];
      pixels.data[j + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas;
}
function skip(report: ImageReport, reason: string) {
  report.skipped++;
  report.reasons[reason] = (report.reasons[reason] || 0) + 1;
}
export function imageReport(report: ImageReport, action: string) {
  const reasons = Object.entries(report.reasons)
    .map(([reason, count]) => `${reason} ${count} 张`)
    .join('、');
  return `发现 ${report.total} 张独立图片，${action} ${report.changed} 张，保留 ${report.unchanged} 张，跳过 ${report.skipped} 张${reasons ? `（${reasons}）` : ''}。`;
}
export async function compressImages(file: Blob, dpi: number, quality: number, progress: (text: string) => void) {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const entries = imageObjects(doc),
    masks = maskReferences(doc);
  const report: ImageReport = { total: entries.length, changed: 0, skipped: 0, unchanged: 0, reasons: {} };
  const pageLongEdge = Math.max(...doc.getPages().map((page) => Math.max(page.getWidth(), page.getHeight())));
  const maxPixels = Math.max(1, Math.round((pageLongEdge * dpi) / 72));
  for (const [index, entry] of entries.entries()) {
    progress(`正在检查图片 ${index + 1} / ${entries.length}`);
    const reason = masks.has(entry.ref.toString()) ? '被其他图片用作蒙版' : unsupported(entry.stream, false);
    if (reason) {
      skip(report, reason);
      continue;
    }
    let canvas: OffscreenCanvas | undefined, scaled: OffscreenCanvas | undefined;
    try {
      canvas = await decodeImage(entry.stream);
      const ratio = Math.min(1, maxPixels / Math.max(canvas.width, canvas.height));
      scaled = new OffscreenCanvas(Math.max(1, Math.round(canvas.width * ratio)), Math.max(1, Math.round(canvas.height * ratio)));
      const ctx = scaled.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      const bytes = new Uint8Array(await (await scaled.convertToBlob({ type: 'image/jpeg', quality: quality / 100 })).arrayBuffer());
      if (bytes.length >= entry.stream.contents.length) {
        report.unchanged++;
        continue;
      }
      const dict = entry.stream.dict.clone(doc.context);
      dict.delete(key('Decode'));
      dict.set(key('Filter'), key('DCTDecode'));
      dict.set(key('ColorSpace'), key('DeviceRGB'));
      dict.set(key('Width'), PDFNumber.of(scaled.width));
      dict.set(key('Height'), PDFNumber.of(scaled.height));
      dict.set(key('BitsPerComponent'), PDFNumber.of(8));
      // 保留原引用，页面、嵌套 Form 和共享图片均继续引用同一对象。
      doc.context.assign(entry.ref, PDFRawStream.of(dict, bytes));
      report.changed++;
    } catch {
      skip(report, '图片无法安全解码');
    } finally {
      if (canvas) canvas.width = canvas.height = 0;
      if (scaled) scaled.width = scaled.height = 0;
    }
  }
  if (!report.changed) return { blob: file, report, keptOriginal: true };
  const blob = new Blob([(await doc.save({ updateFieldAppearances: false })) as BlobPart], { type: 'application/pdf' });
  return { blob: blob.size < file.size ? blob : file, report, keptOriginal: blob.size >= file.size };
}
export async function extractImages(file: Blob, name: string, progress: (text: string) => void): Promise<PdfOutput[]> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  const entries = imageObjects(doc),
    outputs: PdfOutput[] = [];
  const report: ImageReport = { total: entries.length, changed: 0, skipped: 0, unchanged: 0, reasons: {} };
  for (const [index, entry] of entries.entries()) {
    progress(`正在提取图片 ${index + 1} / ${entries.length}`);
    const reason = unsupported(entry.stream, true);
    if (reason) {
      skip(report, reason);
      continue;
    }
    let canvas: OffscreenCanvas | undefined;
    try {
      const softMask = entry.stream.dict.lookup(key('SMask'));
      if (
        softMask &&
        (!(softMask instanceof PDFRawStream) ||
          unsupported(softMask, false) ||
          softMask.dict.lookup(key('ColorSpace')) !== key('DeviceGray'))
      ) {
        skip(report, '不支持的透明蒙版');
        continue;
      }
      let blob: Blob, extension: string;
      if (!softMask && entry.stream.dict.lookup(key('Filter')) === key('DCTDecode')) {
        blob = new Blob([entry.stream.contents as BlobPart], { type: 'image/jpeg' });
        extension = 'jpg';
      } else {
        canvas = await decodeImage(entry.stream);
        if (softMask instanceof PDFRawStream) {
          if (
            number(softMask.dict, 'Width') !== canvas.width ||
            number(softMask.dict, 'Height') !== canvas.height ||
            softMask.dict.has(key('Matte'))
          ) {
            skip(report, '不支持的透明蒙版');
            continue;
          }
          const mask = await decodeImage(softMask);
          try {
            const alpha = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data;
            const ctx = canvas.getContext('2d')!,
              pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = alpha[i];
            ctx.putImageData(pixels, 0, 0);
          } finally {
            mask.width = mask.height = 0;
          }
        }
        blob = await canvas.convertToBlob({ type: 'image/png' });
        extension = 'png';
      }
      outputs.push({ name: `${name}-image-${String(index + 1).padStart(3, '0')}.${extension}`, blob });
      report.changed++;
    } catch {
      skip(report, '图片无法安全解码');
    } finally {
      if (canvas) canvas.width = canvas.height = 0;
    }
  }
  const note = `${imageReport(report, '提取')}矢量图形不算图片，重复的只导出一次。`;
  if (!outputs.length) throw new Error(`没有可提取的图片。${note}`);
  outputs[0].note = note;
  if (report.skipped) outputs.push({ name: `${name}-提取说明.txt`, blob: new Blob([note], { type: 'text/plain;charset=utf-8' }) });
  return outputs;
}

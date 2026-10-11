import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { PDF_DEFAULTS, type PdfMode, type PdfOutput, type PdfPageItem, type PdfSource } from '../../lib/pdf/types';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

vi.mock('pdfjs-dist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pdfjs-dist')>();
  actual.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs')).href;
  return {
    ...actual,
    PDFWorker: class {
      constructor() {
        return new actual.PDFWorker();
      }
    }
  };
});
let handle: (typeof import('../../lib/pdf/worker'))['handle'];
let pages: PdfPageItem[];
const settings = { ...PDF_DEFAULTS, name: 'test', dpi: 72 };
beforeAll(async () => {
  const canvas = await import('@napi-rs/canvas');
  vi.stubGlobal('DOMMatrix', canvas.DOMMatrix);
  vi.stubGlobal('Path2D', canvas.Path2D);
  vi.stubGlobal('ImageData', canvas.ImageData);
  vi.stubGlobal('self', { postMessage() {}, onmessage: null });
  vi.stubGlobal(
    'Worker',
    class {
      terminate() {}
    }
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(width: number, height: number) {
        const result = canvas.createCanvas(width, height);
        Object.assign(result, {
          convertToBlob: async (options: { type?: string; quality?: number } = {}) =>
            new Blob(
              [
                (options.type === 'image/jpeg'
                  ? await result.encode('jpeg', Math.round((options.quality ?? 0.9) * 100))
                  : await result.encode('png')) as BlobPart
              ],
              { type: options.type || 'image/png' }
            )
        });
        return result;
      }
    }
  );
  vi.stubGlobal('createImageBitmap', async (file: Blob) =>
    Object.assign(await canvas.loadImage(Buffer.from(await file.arrayBuffer())), { close() {} })
  );
  vi.stubGlobal('fetch', async (url: string) => {
    const pathname = url.replace(/^\/@fs/, '').split('?')[0];
    return new Response(await readFile(pathname.startsWith('/node_modules/') ? resolve(pathname.slice(1)) : pathname));
  });
  ({ handle } = await import('../../lib/pdf/worker'));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) doc.addPage([300 + i * 10, 400]).drawText(`Page ${i + 1}`, { font, size: 20, x: 30, y: 100 });
  doc.getPage(1).setRotation(degrees(90));
  const file = new File([(await doc.save()) as BlobPart], 'source.pdf', { type: 'application/pdf' });
  const source = (await handle({ op: 'load', id: 'source', file })) as PdfSource;
  expect(source.count).toBe(3);
  pages = Array.from({ length: 3 }, (_, index) => ({ source: 'source', id: String(index), index, rotation: 0 }));
});
afterAll(() => vi.unstubAllGlobals());
async function output(mode: PdfMode, overrides = {}, selected = pages) {
  return (await handle({ op: 'export', mode, pages: selected, settings: { ...settings, ...overrides } })) as PdfOutput[];
}
async function read(output: PdfOutput) {
  return PDFDocument.load(await output.blob.arrayBuffer());
}
describe('actual PDF engine', () => {
  it('merges pages in requested order and retains rotation', async () => {
    const doc = await read((await output('merge', {}, [pages[2], pages[1], pages[0]]))[0]);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getWidth()).toBe(320);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });
  it('normalizes rotated pages to A4', async () => {
    const doc = await read((await output('merge', { a4: true }))[0]);
    expect(doc.getPages().every((p) => Math.abs(p.getWidth() - 595.28) < 0.1)).toBe(true);
  });
  it('splits actual PDF ranges', async () => {
    const results = await output('split', { ranges: '1;2-3' });
    expect(results).toHaveLength(2);
    expect((await read(results[1])).getPageCount()).toBe(2);
  });
  it('deletes, rotates and inserts a blank page', async () => {
    const doc = await read(
      (
        await output('organize', {}, [
          { ...pages[2], rotation: 90 },
          { id: 'blank', source: '', index: 0, rotation: 0 }
        ])
      )[0]
    );
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getWidth()).toBeCloseTo(595.28);
  });
  it('adds English and Chinese page numbers', async () => {
    for (const numberStyle of ['plain', 'chinese', 'total']) {
      const doc = await read((await output('page-numbers', { numberStyle, skipCover: true }))[0]);
      expect(doc.getPageCount()).toBe(3);
    }
  });
  it('renders a thumbnail in a canvas without a DOM', async () => {
    const blob = (await handle({ op: 'thumbnail', source: 'source', index: 0 })) as Blob;
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(100);
  });
  it('exports every page as PNG and JPEG', async () => {
    for (const format of ['png', 'jpeg']) {
      const results = await output('to-image', { format });
      expect(results).toHaveLength(3);
      expect(results[0].blob.type).toBe(`image/${format}`);
      expect(results[0].blob.size).toBeGreaterThan(100);
    }
  });
  it('compresses pages into an actual readable PDF', async () => {
    const doc = await read((await output('compress', { compression: 'raster' }))[0]);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(1).getWidth()).toBe(400);
  });
  it('converts a PNG to PDF with margins', async () => {
    const png = (await handle({ op: 'thumbnail', source: 'source', index: 0 })) as Blob;
    await handle({ op: 'load', id: 'image', file: new File([png], 'page.png', { type: 'image/png' }) });
    const doc = await read((await output('from-image', {}, [{ id: 'img', source: 'image', index: 0, rotation: 0 }]))[0]);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89);
  });
});
it('thumbnail contains rendered ink, not only blank canvas', async () => {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const blob = (await handle({ op: 'thumbnail', source: 'source', index: 0 })) as Blob;
  const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
  const canvas = createCanvas(image.width, image.height),
    ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  let ink = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) ink++;
  expect(ink).toBeGreaterThan(100);
});
it('default compression preserves page streams, searchable text, vectors, forms and shared nested images', async () => {
  const { createCanvas } = await import('@napi-rs/canvas');
  const { PDFName, PDFArray, PDFNumber, drawObject, rgb } = await import('@cantoo/pdf-lib');
  const { imageObjects } = await import('../../lib/pdf/images');
  const canvas = createCanvas(1400, 1000),
    ctx = canvas.getContext('2d'),
    pixels = ctx.createImageData(1400, 1000);
  let seed = 12;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    pixels.data[i] = seed & 255;
    pixels.data[i + 1] = (seed >>> 8) & 255;
    pixels.data[i + 2] = (seed >>> 16) & 255;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    image = await doc.embedPng(await canvas.encode('png'));
  const page = doc.addPage([300, 400]);
  page.drawText('Searchable contract 123', { font, x: 20, y: 380, size: 12 });
  page.drawRectangle({ x: 10, y: 10, width: 40, height: 40, color: rgb(1, 0, 0) });
  page.drawImage(image, { x: 20, y: 70, width: 250, height: 250 });
  const form = doc.getForm().createTextField('kept-field');
  form.setText('kept value');
  form.addToPage(page, { x: 10, y: 335, width: 150, height: 20 });
  const nested = doc.context.flateStream('q 100 0 0 100 0 0 cm /Nested Do Q', {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, 100, 100],
    Resources: { XObject: { Nested: image.ref } }
  });
  const nestedRef = doc.context.register(nested);
  page.node.setXObject(PDFName.of('NestedForm'), nestedRef);
  page.pushOperators(drawObject('NestedForm'));
  const original = new File([(await doc.save()) as BlobPart], 'mixed.pdf', { type: 'application/pdf' });
  const before = await PDFDocument.load(await original.arrayBuffer());
  const contentBytes = (d: typeof before) => {
    const array = d.getPage(0).node.lookup(PDFName.of('Contents'), PDFArray);
    return array.asArray().map((ref) => Array.from((d.context.lookup(ref) as import('@cantoo/pdf-lib').PDFRawStream).contents));
  };
  await handle({ op: 'load', id: 'mixed-before', file: original });
  const selected = [{ id: 'mixed-page', source: 'mixed-before', index: 0, rotation: 0 }];
  const beforeText = (await output('extract-text', {}, selected))[0];
  const result = (await output('compress', { compression: 'preserve', dpi: 72, quality: 55 }, selected))[0];
  expect(result.blob.size).toBeLessThan(original.size);
  expect(result.note).toContain('重压 1 张');
  const after = await PDFDocument.load(await result.blob.arrayBuffer());
  expect(contentBytes(after)).toEqual(contentBytes(before));
  expect(after.getForm().getTextField('kept-field').getText()).toBe('kept value');
  const entries = imageObjects(after);
  expect(entries).toHaveLength(1);
  expect(entries[0].stream.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber()).toBeLessThan(1400);
  const nestedAfter = after.context.lookup(nestedRef) as import('@cantoo/pdf-lib').PDFRawStream;
  expect(nestedAfter.contents).toEqual(nested.contents);
  await handle({ op: 'load', id: 'mixed-after', file: new File([result.blob], 'after.pdf', { type: 'application/pdf' }) });
  const afterText = (await output('extract-text', {}, [{ ...selected[0], source: 'mixed-after' }]))[0];
  expect(await afterText.blob.text()).toBe(await beforeText.blob.text());
});
it('default compression leaves masked and special-color images unchanged and reports skips', async () => {
  const { createCanvas } = await import('@napi-rs/canvas');
  const { PDFName } = await import('@cantoo/pdf-lib');
  const { compressImages, imageObjects } = await import('../../lib/pdf/images');
  const canvas = createCanvas(16, 16),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10,80,180,0.5)';
  ctx.fillRect(0, 0, 16, 16);
  const doc = await PDFDocument.create(),
    image = await doc.embedPng(await canvas.encode('png'));
  doc.addPage().drawImage(image);
  await doc.flush();
  const special = doc.context.flateStream(new Uint8Array(64), {
    Type: 'XObject',
    Subtype: 'Image',
    Width: 4,
    Height: 4,
    BitsPerComponent: 8,
    ColorSpace: 'DeviceCMYK'
  });
  const specialRef = doc.context.register(special);
  doc.getPage(0).node.setXObject(PDFName.of('Special'), specialRef);
  const original = new Blob([(await doc.save()) as BlobPart]);
  const result = await compressImages(original, 72, 40, () => {});
  expect(result.report.skipped).toBe(2);
  expect(result.keptOriginal).toBe(true);
  expect(await result.blob.arrayBuffer()).toEqual(await original.arrayBuffer());
  expect(imageObjects(await PDFDocument.load(await result.blob.arrayBuffer()))).toHaveLength(2);
});
it('extracts existing text and provides useful output', async () => {
  const result = (await output('extract-text'))[0];
  expect(result.name).toMatch(/\.txt$/);
  expect(await result.blob.text()).toContain('Page 1');
  expect(await result.blob.text()).toContain('Page 3');
});
it('extracts original JPEG bytes and restores soft-mask PNG alpha', async () => {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const { extractImages } = await import('../../lib/pdf/images');
  const canvas = createCanvas(20, 20),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(240,20,10,0.5)';
  ctx.fillRect(0, 0, 20, 20);
  const jpeg = await canvas.encode('jpeg'),
    png = await canvas.encode('png'),
    doc = await PDFDocument.create();
  const jpg = await doc.embedJpg(jpeg),
    transparent = await doc.embedPng(png);
  const page = doc.addPage();
  page.drawImage(jpg);
  page.drawImage(jpg);
  page.drawImage(transparent);
  const result = await extractImages(new Blob([(await doc.save()) as BlobPart]), 'images', () => {});
  expect(result.filter((r) => r.blob.type.startsWith('image/'))).toHaveLength(2);
  expect(new Uint8Array(await result.find((r) => r.blob.type === 'image/jpeg')!.blob.arrayBuffer())).toEqual(new Uint8Array(jpeg));
  const extracted = await loadImage(Buffer.from(await result.find((r) => r.blob.type === 'image/png')!.blob.arrayBuffer()));
  ctx.clearRect(0, 0, 20, 20);
  ctx.drawImage(extracted, 0, 0);
  expect(ctx.getImageData(5, 5, 1, 1).data[3]).toBeGreaterThan(100);
  expect(ctx.getImageData(5, 5, 1, 1).data[3]).toBeLessThan(150);
});

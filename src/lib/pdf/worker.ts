import './compat';
import { extractPageText } from './text';
import { fitPage, jpegOrientation, orientedDraw, pageGroups, pageNumberText, visibleBox } from './logic';
import type { PdfOutput, PdfPageItem, PdfRequest, PdfSettings, PdfSource } from './types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFDocument } from '@cantoo/pdf-lib';

const resourceFiles = import.meta.glob<string>('/node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*', {
  query: '?url&no-inline',
  import: 'default',
  eager: true
});
const resources = new Map(Object.entries(resourceFiles).map(([path, url]) => [path.split('/').pop()!, url]));
class LocalBinaryDataFactory {
  async fetch({ filename }: { filename: string }) {
    const url = resources.get(filename);
    if (!url) throw new Error(`缺少 PDF 本地资源：${filename}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`无法读取 PDF 本地资源：${filename}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}
class WorkerCanvasFactory {
  create(width: number, height: number) {
    const canvas = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext('2d')! };
  }
  reset(target: { canvas: OffscreenCanvas }, width: number, height: number) {
    target.canvas.width = Math.ceil(width);
    target.canvas.height = Math.ceil(height);
  }
  destroy(target: { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }) {
    if (target.canvas) target.canvas.width = target.canvas.height = 0;
    target.canvas = target.context = null;
  }
}
class WorkerFilterFactory {
  addFilter() {
    return 'none';
  }
  addHCMFilter() {
    return 'none';
  }
  addAlphaFilter() {
    return 'none';
  }
  addLuminosityFilter() {
    return 'none';
  }
  addKnockoutFilter() {
    return 'none';
  }
  addHighlightHCMFilter() {
    return 'none';
  }
  addSelectionHCMFilter() {
    return 'none';
  }
  addSelectionFilter() {
    return 'none';
  }
  destroy() {}
}
interface StoredSource {
  file: File;
  image: boolean;
  pdf?: PDFDocumentProxy;
  edit?: PDFDocument;
  renderWorker?: Worker;
}
const sources = new Map<string, StoredSource>();
const post = (data: unknown) => self.postMessage(data);
const progress = (text: string) => post({ progress: text });
async function renderer(source: StoredSource) {
  const pdfjs = await import('pdfjs-dist');
  source.renderWorker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
  const worker = new pdfjs.PDFWorker({ port: source.renderWorker } as unknown as ConstructorParameters<typeof pdfjs.PDFWorker>[0]);
  const task = pdfjs.getDocument({
    worker,
    data: new Uint8Array(await source.file.arrayBuffer()),
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    CanvasFactory: WorkerCanvasFactory,
    FilterFactory: WorkerFilterFactory,
    BinaryDataFactory: LocalBinaryDataFactory,
    stopAtErrors: true
  });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}
// 浏览器自己打不开的 HEIC、AVIF，用和格式转换同一套 WebAssembly 解码器
async function bitmap(file: File) {
  try {
    return await createImageBitmap(file);
  } catch {
    const { decode } = await import('../image/decode');
    return decode(file);
  }
}
const heic = (file: File) => /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type);

async function load(id: string, file: File): Promise<PdfSource> {
  const image = !(/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  const source: StoredSource = { file, image };
  let count = 1;
  if (image) (await bitmap(file)).close();
  else {
    try {
      source.pdf = await renderer(source);
      count = source.pdf.numPages;
    } catch (error) {
      source.renderWorker?.terminate();
      throw error;
    }
  }
  sources.set(id, source);
  return { id, name: file.name, size: file.size, count, image };
}
async function render(source: StoredSource, index: number, dpi: number, width?: number) {
  if (!source.pdf) throw new Error('无法读取 PDF，请重新添加文件');
  const page = await source.pdf.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = width ? width / base.width : dpi / 72;
  const viewport = page.getViewport({ scale });
  if (viewport.width * viewport.height > 50_000_000) throw new Error('这一页太大，请降低分辨率后重试');
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  try {
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
      viewport
    }).promise;
    return { canvas, width: base.width, height: base.height };
  } finally {
    page.cleanup();
  }
}
async function thumbnail(source: StoredSource, index: number) {
  if (source.image) {
    const image = await bitmap(source.file);
    const scale = Math.min(1, 320 / Math.max(image.width, image.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const { canvas } = await render(source, index, 72, 240);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  canvas.width = canvas.height = 0;
  return blob;
}
async function editDocument(source: StoredSource) {
  if (!source.edit) {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    source.edit = await PDFDocument.load(await source.file.arrayBuffer());
  }
  return source.edit;
}
async function addImage(doc: PDFDocument, source: StoredSource, settings: PdfSettings) {
  const { degrees } = await import('@cantoo/pdf-lib');
  let bytes = new Uint8Array(await source.file.arrayBuffer());
  let jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  // 手机照片常带 EXIF 方向：旋转的直接在 PDF 里转着画，不重新压缩；带镜像的少见，交给浏览器解码转正后再嵌入
  let orientation = jpeg ? jpegOrientation(bytes) : 1;
  if ((!jpeg && !png) || [2, 4, 5, 7].includes(orientation)) {
    const image = await bitmap(source.file);
    const canvas = new OffscreenCanvas(image.width, image.height);
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    image.close();
    // 照片（HEIC、转正后的 JPEG）存成 JPEG，存 PNG 会大好几倍；其他格式可能有透明，存 PNG
    jpeg = heic(source.file) || jpeg;
    bytes = new Uint8Array(
      await (await canvas.convertToBlob(jpeg ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' })).arrayBuffer()
    );
    canvas.width = canvas.height = 0;
    orientation = 1;
  }
  const embedded = jpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  // 转正后的宽高：6、8 是横竖对调的
  const sideways = orientation === 6 || orientation === 8;
  const w = sideways ? embedded.height : embedded.width,
    h = sideways ? embedded.width : embedded.height;
  let size = settings.paper === 'original' ? [w * 0.75, h * 0.75] : settings.paper === 'letter' ? [612, 792] : [595.28, 841.89];
  if (settings.landscape && settings.paper !== 'original') size = [size[1], size[0]];
  const page = doc.addPage(size as [number, number]);
  const box = fitPage(w, h, size[0], size[1], settings.paper === 'original' ? 0 : (settings.margin * 72) / 25.4);
  const { rotate, ...at } = orientedDraw(orientation, box);
  page.drawImage(embedded, { ...at, rotate: degrees(rotate) });
  return page;
}
async function compose(pages: PdfPageItem[], settings: PdfSettings, imagesOnly: boolean) {
  const { PDFDocument, degrees } = await import('@cantoo/pdf-lib');
  const doc = await PDFDocument.create();
  // 同一来源的页面一次复制完：每次 copyPages / embedPage 都会新建复制器，页面共享的字体和图片会被重复写入
  const wanted = new Map<StoredSource, number[]>();
  for (const item of pages) {
    const source = item.source ? sources.get(item.source) : undefined;
    if (source && !source.image) wanted.set(source, [...(wanted.get(source) ?? []), item.index]);
  }
  const copied = new Map<
    StoredSource,
    { pages: Awaited<ReturnType<typeof doc.copyPages>>; embedded: Awaited<ReturnType<typeof doc.embedPages>> }
  >();
  for (const [source, indices] of wanted) {
    const original = await editDocument(source);
    copied.set(
      source,
      settings.a4
        ? // 按可见区域（裁剪框和媒体框的交集）嵌入：pdf-lib 默认用 MediaBox，裁剪框又可能伸出媒体框，两种都会把阅读器里看不到的内容画出来
          {
            pages: [],
            embedded: await doc.embedPages(
              indices.map((n) => original.getPage(n)),
              indices.map((n) => {
                const p = original.getPage(n);
                const c = visibleBox(p.getMediaBox(), p.getCropBox());
                return { left: c.x, bottom: c.y, right: c.x + c.width, top: c.y + c.height };
              })
            )
          }
        : { pages: await doc.copyPages(original, indices), embedded: [] }
    );
  }
  for (let i = 0; i < pages.length; i++) {
    progress(`正在整理第 ${i + 1} / ${pages.length} 页`);
    const item = pages[i];
    if (!item.source) {
      doc.addPage([595.28, 841.89]).setRotation(degrees(item.rotation));
      continue;
    }
    const source = sources.get(item.source);
    if (!source) throw new Error('来源文件已移除，请重新添加');
    if (source.image) {
      const page = await addImage(doc, source, imagesOnly ? settings : { ...settings, paper: settings.a4 ? 'a4' : 'original' });
      page.setRotation(degrees(item.rotation));
    } else {
      const original = await editDocument(source);
      if (settings.a4) {
        const src = original.getPage(item.index);
        const embedded = copied.get(source)!.embedded.shift()!;
        const angle = (((src.getRotation().angle + item.rotation) % 360) + 360) % 360;
        const sideways = angle === 90 || angle === 270;
        const w = sideways ? embedded.height : embedded.width,
          h = sideways ? embedded.width : embedded.height;
        const page = doc.addPage([595.28, 841.89]);
        const box = fitPage(w, h, 595.28, 841.89, (settings.margin * 72) / 25.4);
        const scale = box.width / w;
        page.drawPage(embedded, {
          x: box.x + (angle === 180 || angle === 270 ? box.width : 0),
          y: box.y + (angle === 90 || angle === 180 ? box.height : 0),
          width: embedded.width * scale,
          height: embedded.height * scale,
          rotate: degrees(-angle)
        });
      } else {
        const page = copied.get(source)!.pages.shift()!;
        page.setRotation(degrees(page.getRotation().angle + item.rotation));
        doc.addPage(page);
      }
    }
  }
  return doc;
}
const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });
async function exportFiles(request: Extract<PdfRequest, { op: 'export' }>): Promise<PdfOutput[]> {
  const { mode, pages, settings } = request;
  if (!pages.length) throw new Error('请先添加至少一页');
  // 没填文件名时沿用第一个来源文件的名字，再标上做了什么，免得下载一堆同名的“顺手文档”
  const first = sources.get(pages.find((p) => p.source)?.source ?? '')?.file.name.replace(/\.[^.]+$/, '');
  const name = (settings.name.trim().replace(/\.pdf$/i, '') || (first ? `${first}-${mode}` : '顺手文档')).replace(/[\\/:*?"<>|]/g, '-');
  if (mode === 'extract-text') {
    const chunks: string[] = [];
    let nonempty = 0;
    for (const [i, item] of pages.entries()) {
      progress(`正在提取第 ${i + 1} / ${pages.length} 页文字`);
      const pdf = sources.get(item.source)?.pdf;
      if (!pdf) throw new Error('无法读取来源文件');
      const page = await pdf.getPage(item.index + 1);
      const text = extractPageText((await page.getTextContent()).items);
      if (text) nonempty++;
      chunks.push(`第 ${i + 1} 页\n${text || '（本页没有可提取文字）'}`);
      page.cleanup();
    }
    if (!nonempty) throw new Error('没找到文字，可能是扫描件，需要先做文字识别（OCR）');
    return [
      {
        name: `${name}.txt`,
        blob: new Blob([chunks.join('\n\n')], { type: 'text/plain;charset=utf-8' }),
        note: `已提取 ${nonempty} / ${pages.length} 页的文字，多栏和表格可能要再整理。`
      }
    ];
  }
  if (mode === 'extract-images' || (mode === 'compress' && settings.compression !== 'raster')) {
    const source = sources.get(pages[0].source);
    if (!source) throw new Error('无法读取来源文件');
    const engine = await import('./images');
    if (mode === 'extract-images') return engine.extractImages(source.file, name, progress);
    const result = await engine.compressImages(source.file, settings.dpi, settings.quality, progress);
    return [
      {
        name: `${name}.pdf`,
        blob: result.blob,
        note:
          engine.imageReport(result.report, '重压') + (result.keptOriginal ? '没能变小，保留了原文件。' : '文字、矢量、链接和表单都没动。')
      }
    ];
  }
  if (mode === 'to-image' || mode === 'compress') {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const doc = mode === 'compress' ? await PDFDocument.create() : null;
    const out: PdfOutput[] = [];
    for (let i = 0; i < pages.length; i++) {
      progress(`正在渲染第 ${i + 1} / ${pages.length} 页`);
      const item = pages[i],
        source = sources.get(item.source)!;
      const { canvas, width, height } = await render(source, item.index, settings.dpi);
      const type = mode === 'compress' ? 'jpeg' : settings.format;
      const blob = await canvas.convertToBlob({ type: `image/${type}`, quality: settings.quality / 100 });
      canvas.width = canvas.height = 0;
      if (doc) {
        const embedded = await doc.embedJpg(await blob.arrayBuffer());
        doc.addPage([width, height]).drawImage(embedded, { x: 0, y: 0, width, height });
      } else out.push({ name: `${name}-${String(i + 1).padStart(3, '0')}.${type === 'jpeg' ? 'jpg' : 'png'}`, blob });
    }
    return doc ? [{ name: `${name}.pdf`, blob: pdfBlob(await doc.save()) }] : out;
  }
  if (mode === 'split') {
    const groups = pageGroups(pages.length, settings.split, settings.ranges, settings.every);
    const outputs: PdfOutput[] = [];
    for (let i = 0; i < groups.length; i++) {
      progress(`正在生成第 ${i + 1} / ${groups.length} 份 PDF`);
      const doc = await compose(
        groups[i].map((n) => pages[n]),
        { ...settings, a4: false },
        false
      );
      outputs.push({ name: `${name}-${String(i + 1).padStart(3, '0')}.pdf`, blob: pdfBlob(await doc.save()) });
    }
    return outputs;
  }
  const doc = await compose(pages, settings, mode === 'from-image');
  if (mode === 'page-numbers') {
    const { StandardFonts, rgb, degrees } = await import('@cantoo/pdf-lib');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < doc.getPageCount(); i++) {
      const text = pageNumberText(i, doc.getPageCount(), settings);
      if (!text) continue;
      // 页码按可见区域定位，和 A4 嵌入用同一个框
      const page = doc.getPage(i),
        crop = visibleBox(page.getMediaBox(), page.getCropBox());
      const angle = ((page.getRotation().angle % 360) + 360) % 360;
      const sideways = angle === 90 || angle === 270;
      const width = sideways ? crop.height : crop.width,
        height = sideways ? crop.width : crop.height;
      const size = settings.fontSize;
      let textWidth = 0,
        stamp;
      if (settings.numberStyle === 'chinese') {
        const canvas = new OffscreenCanvas(Math.ceil(text.length * size * 4), Math.ceil(size * 5));
        const ctx = canvas.getContext('2d')!;
        ctx.font = `${size * 3}px sans-serif`;
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';
        textWidth = ctx.measureText(text).width / 3;
        ctx.fillText(text, 0, 0);
        stamp = await doc.embedPng(await (await canvas.convertToBlob()).arrayBuffer());
      } else textWidth = font.widthOfTextAtSize(text, size);
      const x = settings.position.endsWith('left')
        ? 24
        : settings.position.endsWith('right')
          ? width - textWidth - 24
          : (width - textWidth) / 2;
      const y = settings.position.startsWith('top') ? height - size - 24 : 24;
      const point =
        angle === 90
          ? { x: crop.x + crop.width - y, y: crop.y + x }
          : angle === 180
            ? { x: crop.x + crop.width - x, y: crop.y + crop.height - y }
            : angle === 270
              ? { x: crop.x + y, y: crop.y + crop.height - x }
              : { x: crop.x + x, y: crop.y + y };
      if (stamp) page.drawImage(stamp, { ...point, width: stamp.width / 3, height: stamp.height / 3, rotate: degrees(angle) });
      else page.drawText(text, { ...point, size, font, color: rgb(0, 0, 0), rotate: degrees(angle) });
    }
  }
  return [{ name: `${name}.pdf`, blob: pdfBlob(await doc.save()) }];
}
export async function handle(request: PdfRequest) {
  if (request.op === 'load') return load(request.id, request.file);
  if (request.op === 'release') {
    const source = sources.get(request.source);
    await source?.pdf?.loadingTask.destroy();
    source?.renderWorker?.terminate();
    sources.delete(request.source);
    return;
  }
  if (request.op === 'thumbnail') {
    const source = sources.get(request.source);
    if (!source) throw new Error('文件已移除');
    return thumbnail(source, request.index);
  }
  return exportFiles(request);
}
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<{ key: number; request: PdfRequest }>) => {
  queue = queue.then(async () => {
    try {
      post({ key: data.key, result: await handle(data.request) });
    } catch (error) {
      let message = error instanceof Error ? error.message : '处理没有完成';
      if (/password|encrypted/i.test(message)) message = '这个 PDF 有密码，请先解锁再添加';
      else if (/Invalid PDF|InvalidPDF|Failed to parse/i.test(message)) message = 'PDF 损坏或格式不支持，请重新导出一份';
      post({ key: data.key, error: message });
    }
  });
};

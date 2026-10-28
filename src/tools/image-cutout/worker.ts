// 抠图 Worker：常驻，模型只加载一次。
// 有 WebGPU 就用显卡跑（快十倍左右）：它要的 asyncify 版 wasm 有 26.8 MB，超过 Cloudflare 单文件 25 MiB 上限，
// 所以拆成两块放在 runtime/，拼好后经 env.wasm.wasmBinary 交给运行时（升级 onnxruntime-web 时要重新拆，见 runtime.test.ts）。
// 没有 WebGPU、或显卡初始化失败，就退回 14 MB 的纯 CPU 版
import type * as Ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import gpuGlue from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import gpuA from './runtime/ort-1.30.0-asyncify-a.bin?url';
import gpuB from './runtime/ort-1.30.0-asyncify-b.bin?url';
import fastUrl from './models/u2netp.onnx?url';
// ISNet 原模型 176 MB：权重改成 fp16 存（计算仍是 fp32），再拆成 4 块，每块都在 25 MiB 以内
import partA from './models/isnet-part-a.bin?url';
import partB from './models/isnet-part-b.bin?url';
import partC from './models/isnet-part-c.bin?url';
import partD from './models/isnet-part-d.bin?url';
import { decode } from '../../lib/image/decode';
import { applyMask, bounds, MODELS, toMask, toPixels, toTensor, type ModelId, type Rect } from './logic';

const FILES: Record<ModelId, string[]> = { fast: [fastUrl], fine: [partA, partB, partC, partD] };
// 输出图最长边：再大的照片也先缩到这里，免得内存吃紧
const MAX_SIDE = 6000;

// range：只在这个范围里找主体（模型看的是这一块，范围外一律透明）
type Job = { id: string; file: File; model: ModelId; clean: boolean; range?: Rect };
type Runtime = { ort: typeof Ort; session: Ort.InferenceSession };
const sessions = new Map<ModelId, Promise<Runtime>>();

async function cpu() {
  const ort = await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };
  // 没开 COOP/COEP，用不了多线程
  ort.env.wasm.numThreads = 1;
  return ort;
}

async function gpu() {
  const g = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!g || !(await g.requestAdapter().catch(() => null))) return null;
  const [ort, a, b] = await Promise.all([
    import('onnxruntime-web/webgpu-extern') as Promise<typeof Ort>,
    fetch(gpuA).then((r) => r.arrayBuffer()),
    fetch(gpuB).then((r) => r.arrayBuffer())
  ]);
  const bin = new Uint8Array(a.byteLength + b.byteLength);
  bin.set(new Uint8Array(a), 0);
  bin.set(new Uint8Array(b), a.byteLength);
  ort.env.wasm.wasmBinary = bin.buffer;
  ort.env.wasm.wasmPaths = { mjs: gpuGlue };
  ort.env.wasm.numThreads = 1;
  return ort;
}

async function open(bytes: Uint8Array): Promise<Runtime> {
  try {
    const ort = await gpu();
    if (ort)
      return { ort, session: await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }) };
  } catch {
    /* 显卡这条路走不通就用 CPU */
  }
  const ort = await cpu();
  return { ort, session: await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }) };
}

async function download(urls: string[], progress: (loaded: number, total: number) => void) {
  const responses = await Promise.all(urls.map((u) => fetch(u)));
  if (responses.some((r) => !r.ok || !r.body)) throw new Error('模型下载失败，检查网络后再试');
  const total = responses.reduce((n, r) => n + Number(r.headers.get('content-length') || 0), 0);
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (const r of responses) {
    const reader = r.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.length;
      progress(loaded, total);
    }
  }
  const all = new Uint8Array(loaded);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

function session(model: ModelId, id: string) {
  let s = sessions.get(model);
  if (!s) {
    s = download(FILES[model], (loaded, total) => self.postMessage({ id, stage: 'download', loaded, total })).then(open);
    // 失败了下次重新下载
    s.catch(() => sessions.delete(model));
    sessions.set(model, s);
  }
  return s;
}

async function run({ id, file, model, clean, range }: Job) {
  const { ort, session: s } = await session(model, id);
  self.postMessage({ id, stage: 'infer', backend: s ? (ort.env.wasm.wasmBinary ? 'gpu' : 'cpu') : '' });
  const src = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const width = Math.max(1, Math.round(src.width * scale)),
    height = Math.max(1, Math.round(src.height * scale));

  // 1. 缩到模型的输入尺寸（选了范围就只取这一块）
  const { size, mean, std } = MODELS[model];
  const area = range ? toPixels(range, width, height) : { x: 0, y: 0, w: width, h: height };
  const k = src.width / width;
  const small = new OffscreenCanvas(size, size);
  const sc = small.getContext('2d', { willReadFrequently: true })!;
  sc.drawImage(src, area.x * k, area.y * k, area.w * k, area.h * k, 0, 0, size, size);
  const input = toTensor(sc.getImageData(0, 0, size, size).data, size, mean, std);
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, size, size]) });
  const pred = out[s.outputNames[0]].data as Float32Array;
  const mask = toMask(pred, clean);

  // 2. 遮罩放大回原图尺寸（借画布做平滑插值，灰度放在红色通道里）
  const maskImg = new ImageData(size, size);
  for (let i = 0; i < mask.length; i++) {
    maskImg.data[i * 4] = mask[i];
    maskImg.data[i * 4 + 3] = 255;
  }
  sc.putImageData(maskImg, 0, 0);
  const big = new OffscreenCanvas(width, height);
  const bc = big.getContext('2d', { willReadFrequently: true })!;
  bc.imageSmoothingQuality = 'high';
  bc.drawImage(small, area.x, area.y, area.w, area.h);
  const alpha = bc.getImageData(0, 0, width, height).data;

  // 3. 原图套上遮罩
  bc.clearRect(0, 0, width, height);
  bc.drawImage(src, 0, 0, width, height);
  src.close();
  const img = bc.getImageData(0, 0, width, height);
  applyMask(img.data, alpha);
  bc.putImageData(img, 0, 0);
  const box = bounds((i) => img.data[i * 4 + 3], width, height);
  const blob = await big.convertToBlob({ type: 'image/png' });
  self.postMessage({ id, ok: true, blob, box, width, height });
}

self.onmessage = (e: MessageEvent<Job>) => {
  run(e.data).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    self.postMessage({
      id: e.data.id,
      ok: false,
      error: /memory|alloc/i.test(msg) ? '图片太大或内存不够，换小一点的图试试' : msg || '抠图失败，换一张试试'
    });
  });
};

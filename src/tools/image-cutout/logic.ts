// 抠图的纯计算部分：模型输入、遮罩整理、边缘清理、主体范围。不碰 DOM，方便测试
export type ModelId = 'fast' | 'fine';

// 两个模型的输入尺寸和归一化参数（和 rembg 的预处理一致）
export const MODELS: Record<ModelId, { size: number; mean: number[]; std: number[] }> = {
  // U²-NetP：4.6 MB，快，主体明显的图够用
  fast: { size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  // ISNet 通用版：边缘更利落，深色身体、细碎边缘也能留住
  fine: { size: 1024, mean: [0.485, 0.456, 0.406], std: [1, 1, 1] }
};

// RGBA 像素（已缩放到 size × size）→ NCHW 的 float32 输入
export function toTensor(rgba: Uint8ClampedArray, size: number, mean: number[], std: number[]): Float32Array {
  const area = size * size;
  const out = new Float32Array(area * 3);
  for (let i = 0; i < area; i++) {
    const p = i * 4;
    out[i] = (rgba[p] / 255 - mean[0]) / std[0];
    out[area + i] = (rgba[p + 1] / 255 - mean[1]) / std[1];
    out[area * 2 + i] = (rgba[p + 2] / 255 - mean[2]) / std[2];
  }
  return out;
}

// 模型输出拉伸到 0–255。clean：去掉背景上的淡淡残影、让主体内部实心，中间的半透明边缘保留
export function toMask(pred: Float32Array, clean: boolean): Uint8ClampedArray {
  let lo = Infinity,
    hi = -Infinity;
  for (const v of pred) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const out = new Uint8ClampedArray(pred.length);
  const [a, b] = clean ? [0.1, 0.9] : [0, 1];
  for (let i = 0; i < pred.length; i++) {
    const v = ((pred[i] - lo) / span - a) / (b - a);
    out[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  return out;
}

export function applyMask(pixels: Uint8ClampedArray, mask: Uint8ClampedArray) {
  // 遮罩只能减少透明度，不能把原本透明的像素重新变成不透明。
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = Math.round((pixels[i] * mask[i - 3]) / 255);
}

// 主体所在的范围（alpha 超过阈值的像素外接框），裁掉四周透明边用；整张都透明时返回 null
export function bounds(alpha: (i: number) => number, width: number, height: number, threshold = 8) {
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha(row + x) > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 抠图范围：占图片宽高的百分比（和裁剪框同一套坐标），换成像素，至少 1 像素、不出界
export type Rect = { x: number; y: number; w: number; h: number };
export function toPixels(r: Rect, width: number, height: number) {
  const x = Math.min(width - 1, Math.max(0, Math.round((r.x / 100) * width)));
  const y = Math.min(height - 1, Math.max(0, Math.round((r.y / 100) * height)));
  const w = Math.max(1, Math.min(width - x, Math.round((r.w / 100) * width)));
  const h = Math.max(1, Math.min(height - y, Math.round((r.h / 100) * height)));
  return { x, y, w, h };
}

// 修整的一笔：保留（从原图补回来）或擦除。points 是 x0, y0, x1, y1… 抠图结果上的像素坐标，size 是笔刷直径
export type Stroke = { mode: 'keep' | 'erase'; size: number; points: number[] };

// 笔画铺成一串圆点（间隔不到半径的一半，连起来看不出接缝）。from：从第几个点开始，画到一半时只补新的那一段
export function dabs(points: number[], radius: number, from = 0): number[] {
  const out: number[] = [];
  const step = Math.max(0.5, radius * 0.4);
  for (let i = Math.max(0, from); i < points.length / 2; i++) {
    const x = points[2 * i],
      y = points[2 * i + 1];
    if (i === 0) {
      out.push(x, y);
      continue;
    }
    const px = points[2 * i - 2],
      py = points[2 * i - 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / step));
    for (let k = 1; k <= n; k++) out.push(px + ((x - px) * k) / n, py + ((y - py) * k) / n);
  }
  return out;
}

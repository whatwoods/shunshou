// 宣传片的动画基础：一切都是时间 t（秒）的纯函数，所以逐帧导出和实时播放画面完全一致。
// 弹簧用解析解（不逐帧积分）：同一个 t 永远得到同一个值，可以随意跳到任何时刻。

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
// t 在 [a, b] 里走到哪了，0..1
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export type Ease = (p: number) => number;

// cubic-bezier 求解（和 CSS 的同一条曲线）
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let u = p;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - p;
      if (Math.abs(e) < 1e-6) break;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 30 && Math.abs(sx(u) - p) > 1e-6; i++) {
      if (sx(u) < p) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

export const E = {
  lin: ((p) => p) as Ease,
  in2: ((p) => p * p) as Ease,
  in3: ((p) => p * p * p) as Ease,
  out2: ((p) => 1 - (1 - p) * (1 - p)) as Ease,
  out3: ((p) => 1 - Math.pow(1 - p, 3)) as Ease,
  out4: ((p) => 1 - Math.pow(1 - p, 4)) as Ease,
  out5: ((p) => 1 - Math.pow(1 - p, 5)) as Ease,
  inOut2: ((p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)) as Ease,
  inOut3: ((p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)) as Ease,
  inOut4: ((p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2)) as Ease,
  inOutSine: ((p) => -(Math.cos(Math.PI * p) - 1) / 2) as Ease,
  // 苹果式的出场曲线：起步快、落地很软
  soft: bezier(0.22, 1, 0.36, 1),
  // 网站切换深浅色用的那条
  theme: bezier(0.3, 0.7, 0.2, 1),
  // 鼠标移动：起步稍慢，减速很长
  hand: bezier(0.45, 0.05, 0.18, 1)
};

// 一段补间：t 从 a 到 b，按 ease 走完 0..1
export const tw = (t: number, a: number, b: number, ease: Ease = E.inOut3) => ease(prog(t, a, b));

export interface Spring {
  w?: number; // 角频率（越大越快）
  z?: number; // 阻尼比（< 1 会冲过头）
}

// 阻尼弹簧的阶跃响应：dt 秒后从 0 走到哪了（会冲过 1 再回来）
export function spring(dt: number, { w = 12, z = 0.8 }: Spring = {}): number {
  if (dt <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * dt) * (1 + w * dt);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt));
}

// 一串弹簧目标：从 from 出发，每到一个时刻换一个目标。线性系统可以叠加，所以中途改目标速度也是连续的
export type Step = readonly [at: number, to: number, opts?: Spring];
export function sp(t: number, from: number, steps: readonly Step[], def?: Spring): number {
  let v = from,
    prev = from;
  for (const [at, to, o] of steps) {
    if (t > at) v += (to - prev) * spring(t - at, o ?? def);
    prev = to;
  }
  return v;
}

// 关键帧：[时刻, 值, 进入这一帧的缓动]
export type Key = readonly [at: number, v: number, ease?: Ease];
export function kf(t: number, keys: readonly Key[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a, va] = keys[i - 1];
    const [b, vb, ease = E.inOut3] = keys[i];
    if (t <= b) return lerp(va, vb, ease(prog(t, a, b)));
  }
  return keys[keys.length - 1][1];
}

// 一个 0→1→0 的小鼓包（用来做波浪、闪一下）
export const bump = (t: number, at: number, dur: number) => {
  const p = prog(t, at, at + dur);
  return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p) ** 2;
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export const mixRect = (a: Rect, b: Rect, p: number): Rect => ({
  x: lerp(a.x, b.x, p),
  y: lerp(a.y, b.y, p),
  w: lerp(a.w, b.w, p),
  h: lerp(a.h, b.h, p)
});
export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
export const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)),
    y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

// 颜色插值（#RRGGBB 或 rgba(...)）
const parse = (c: string): [number, number, number, number] => {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/[\d.]+/g)!.map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
};
export function mixColor(a: string, b: string, p: number) {
  const x = parse(a),
    y = parse(b);
  const c = x.map((v, i) => lerp(v, y[i], p));
  return `rgba(${c[0].toFixed(1)}, ${c[1].toFixed(1)}, ${c[2].toFixed(1)}, ${c[3].toFixed(3)})`;
}

// 伪随机（同一个种子永远同一个数），给散落、闪烁这类效果用
export function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// 三次贝塞尔路径上的点（拖动文件的轨迹）
export function path(p: number, a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const u = 1 - p;
  const k = [u * u * u, 3 * u * u * p, 3 * u * p * p, p * p * p];
  return { x: k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], y: k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1] };
}

export const fmtBytes = (b: number) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

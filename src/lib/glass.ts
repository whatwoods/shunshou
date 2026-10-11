// 液态玻璃的位移图：凸面 squircle 边缘 y = (1 - (1 - x)^4)^(1/4)，按斯涅尔定律（n = 1.5）算折射偏移
// R = X 位移，G = Y 位移，128 = 不动；B = 弧面上的镜面高光（光从左上来，背光的右下有一道弱的回光）。
// magnify > 0 时中间也往里收，整块像放大镜（拖动时浮起来的透镜用）。
// 配合 backdrop-filter: url(#滤镜) 使用，目前只有 Chromium 支持

export function refractOK(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (!/Chrome\/\d+/.test(ua) || /Firefox\//.test(ua)) return false;
  return !window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
}

const f = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
};

function profile(bezel: number, thick: number, n = 256) {
  const prof = new Float32Array(n + 1);
  let max = 0;
  for (let i = 0; i <= n; i++) {
    const x = Math.min(Math.max(i / n, 0.003), 1);
    const e = 0.002;
    const dy = (f(Math.min(1, x + e)) - f(Math.max(0, x - e))) / (2 * e);
    const t1 = Math.atan((dy * thick) / bezel);
    const t2 = Math.asin(Math.sin(t1) / 1.5);
    const v = Math.tan(t1 - t2) * (f(x) * thick + thick * 0.25);
    prof[i] = v;
    if (v > max) max = v;
  }
  for (let i = 0; i <= n; i++) prof[i] /= max;
  return { prof, max };
}

// 光源方向：左上方（屏幕坐标 y 向下），已归一化
const LX = -0.6,
  LY = -0.8;

export interface GlassMap {
  url: string;
  // feDisplacementMap 的 scale：通道值 0..255 映射到 ±scale/2，正好让最大位移等于 max
  scale: number;
}

const cache = new Map<string, GlassMap>();

export function glassMap(w: number, h: number, radius: number, bezel: number, thick: number, magnify = 0): GlassMap {
  const r = Math.min(radius, w / 2, h / 2);
  const key = `${w}x${h}r${r}b${bezel}t${thick}m${magnify}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const bz = Math.min(bezel, Math.min(w, h) / 2);
  const { prof, max } = profile(bz, thick);
  const N = prof.length - 1;
  // 小元素用 2 倍分辨率，大面板 1 倍就够
  const ss = w * h * 4 <= 400_000 ? 2 : 1;
  const W = Math.round(w * ss),
    H = Math.round(h * ss);
  const hw = w / 2,
    hh = h / 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  // 先按像素算出位移，最后再按最大位移归一化写进通道
  const dx = new Float32Array(W * H),
    dy = new Float32Array(W * H);
  // 放大倍数 1 + magnify：从离中心近 1/(1+magnify) 的地方取样
  const pull = magnify > 0 ? 1 - 1 / (1 + magnify) : 0;
  let top = max;

  for (let yy = 0; yy < H; yy++) {
    const py = (yy + 0.5) / ss - hh;
    for (let xx = 0; xx < W; xx++) {
      const px = (xx + 0.5) / ss - hw;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      let sd: number, nx: number, ny: number;
      if (qx > 0 && qy > 0) {
        const L = Math.hypot(qx, qy) || 1;
        sd = L - r;
        nx = (qx / L) * (px >= 0 ? 1 : -1);
        ny = (qy / L) * (py >= 0 ? 1 : -1);
      } else if (qx > qy) {
        sd = qx - r;
        nx = px >= 0 ? 1 : -1;
        ny = 0;
      } else {
        sd = qy - r;
        nx = 0;
        ny = py >= 0 ? 1 : -1;
      }
      const dist = -sd;
      const i = yy * W + xx;
      let X = 0,
        Y = 0,
        B = 0;
      if (dist >= 0 && dist < bz) {
        const t = dist / bz;
        const m = prof[Math.min(N, Math.round(t * N))];
        X = -nx * m * max;
        Y = -ny * m * max;
        // 高光贴着外沿最亮，往里很快淡掉；朝光的一面强，背光的一面弱
        const face = nx * LX + ny * LY;
        const lit = face > 0 ? face * face : face * face * 0.55;
        B = 255 * lit * Math.exp(-t * 6);
      }
      if (pull && dist >= 0) {
        X -= px * pull;
        Y -= py * pull;
        top = Math.max(top, Math.abs(X), Math.abs(Y));
      }
      dx[i] = X;
      dy[i] = Y;
      d[i * 4 + 2] = Math.round(B);
      d[i * 4 + 3] = 255;
    }
  }
  for (let i = 0; i < W * H; i++) {
    d[i * 4] = Math.round(128 + (dx[i] / top) * 127);
    d[i * 4 + 1] = Math.round(128 + (dy[i] / top) * 127);
  }
  ctx.putImageData(img, 0, 0);

  const map = { url: canvas.toDataURL('image/png'), scale: Math.round(top * 2 * 10) / 10 };
  cache.set(key, map);
  // 窗口缩放时尺寸会一直变，只留最近用过的几十张
  if (cache.size > 48) cache.delete(cache.keys().next().value!);
  return map;
}

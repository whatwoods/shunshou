// 裁剪框的拖动计算。坐标都是占图片宽高的百分比（0–100），和设置里的 x / y / cropWidth / cropHeight 一致。
// aspect：锁定比例时“框宽百分比 ÷ 框高百分比”（= 像素比例 × 图片高 ÷ 图片宽），0 表示自由裁剪
export type CropRect = { x: number; y: number; w: number; h: number };
export type CropDrag = 'move' | 'draw' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN = 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// 以 (ax, ay) 为固定角，另一角跟着 (px, py) 走；越过固定角就翻到另一边
function fromAnchor(ax: number, ay: number, px: number, py: number, aspect: number): CropRect {
  const sx = px >= ax ? 1 : -1;
  const sy = py >= ay ? 1 : -1;
  const maxW = sx > 0 ? 100 - ax : ax;
  const maxH = sy > 0 ? 100 - ay : ay;
  let w = Math.abs(px - ax);
  let h = Math.abs(py - ay);
  if (aspect > 0) {
    w = Math.max(w, h * aspect, MIN);
    w = Math.min(w, maxW, maxH * aspect);
    h = w / aspect;
  } else {
    w = clamp(w, Math.min(MIN, maxW), maxW);
    h = clamp(h, Math.min(MIN, maxH), maxH);
  }
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}

// start：按下时的框；(px, py)：按下的位置；(dx, dy)：拖了多远
export function dragCrop(start: CropRect, kind: CropDrag, px: number, py: number, dx: number, dy: number, aspect = 0): CropRect {
  const { x, y, w, h } = start;
  const r = x + w,
    b = y + h;
  const cx = x + w / 2,
    cy = y + h / 2;
  switch (kind) {
    case 'move':
      return { x: clamp(x + dx, 0, 100 - w), y: clamp(y + dy, 0, 100 - h), w, h };
    case 'draw':
      return fromAnchor(clamp(px, 0, 100), clamp(py, 0, 100), clamp(px + dx, 0, 100), clamp(py + dy, 0, 100), aspect);
    case 'se':
      return fromAnchor(x, y, clamp(r + dx, 0, 100), clamp(b + dy, 0, 100), aspect);
    case 'sw':
      return fromAnchor(r, y, clamp(x + dx, 0, 100), clamp(b + dy, 0, 100), aspect);
    case 'ne':
      return fromAnchor(x, b, clamp(r + dx, 0, 100), clamp(y + dy, 0, 100), aspect);
    case 'nw':
      return fromAnchor(r, b, clamp(x + dx, 0, 100), clamp(y + dy, 0, 100), aspect);
  }
  // 拖边：没锁比例只动这一条边；锁了比例时另一边以框的中线为准一起变
  const horizontal = kind === 'e' || kind === 'w';
  if (horizontal) {
    const ax = kind === 'e' ? x : r;
    const px2 = clamp((kind === 'e' ? r : x) + dx, 0, 100);
    const sx = px2 >= ax ? 1 : -1;
    let nw = Math.max(Math.abs(px2 - ax), MIN);
    nw = Math.min(nw, sx > 0 ? 100 - ax : ax);
    if (!(aspect > 0)) return { x: sx > 0 ? ax : ax - nw, y, w: nw, h };
    nw = Math.min(nw, 2 * Math.min(cy, 100 - cy) * aspect);
    const nh = nw / aspect;
    return { x: sx > 0 ? ax : ax - nw, y: cy - nh / 2, w: nw, h: nh };
  }
  const ay = kind === 's' ? y : b;
  const py2 = clamp((kind === 's' ? b : y) + dy, 0, 100);
  const sy = py2 >= ay ? 1 : -1;
  let nh = Math.max(Math.abs(py2 - ay), MIN);
  nh = Math.min(nh, sy > 0 ? 100 - ay : ay);
  if (!(aspect > 0)) return { x, y: sy > 0 ? ay : ay - nh, w, h: nh };
  nh = Math.min(nh, (2 * Math.min(cx, 100 - cx)) / aspect);
  const nw2 = nh * aspect;
  return { x: cx - nw2 / 2, y: sy > 0 ? ay : ay - nh, w: nw2, h: nh };
}

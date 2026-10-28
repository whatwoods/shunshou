// 把修整的笔画画到抠图结果上：擦除直接挖掉，保留从原图（已缩放到同样尺寸）把这块补回来
import { dabs, type Stroke } from './logic';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function paintStroke(ctx: Ctx, original: CanvasImageSource | null, s: Stroke, from = 0) {
  const r = s.size / 2;
  const c = dabs(s.points, r, from);
  if (!c.length || (s.mode === 'keep' && !original)) return;
  const path = new Path2D();
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < c.length; i += 2) {
    path.moveTo(c[i] + r, c[i + 1]);
    path.arc(c[i], c[i + 1], r, 0, Math.PI * 2);
    x0 = Math.min(x0, c[i] - r);
    y0 = Math.min(y0, c[i + 1] - r);
    x1 = Math.max(x1, c[i] + r);
    y1 = Math.max(y1, c[i + 1] + r);
  }
  ctx.save();
  if (s.mode === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(path);
  } else {
    // 只拷笔刷盖住的那一小块，图很大时也跟手
    const { width, height } = ctx.canvas;
    const bx = Math.max(0, Math.floor(x0)),
      by = Math.max(0, Math.floor(y0));
    const bw = Math.min(width, Math.ceil(x1)) - bx,
      bh = Math.min(height, Math.ceil(y1)) - by;
    if (bw > 0 && bh > 0) {
      ctx.clip(path);
      ctx.drawImage(original!, bx, by, bw, bh, bx, by, bw, bh);
    }
  }
  ctx.restore();
}

// 抠图结果 + 全部笔画
export function render(ctx: Ctx, cut: CanvasImageSource, original: CanvasImageSource | null, strokes: Stroke[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(cut, 0, 0);
  for (const s of strokes) paintStroke(ctx, original, s);
}

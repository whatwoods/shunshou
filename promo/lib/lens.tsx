import { clamp } from './anim';
import { MorphGlass } from './kit';

// iOS 26/27 那种液态玻璃透镜：按住选中块时它浮起来、放大底下的字；走得快会被拉长压扁。
// 尺寸固定（只算一张位移图），浮起、拉伸都用 scale，和网站 Lens.tsx 的做法一样
export function GlideLens({
  x,
  y,
  w,
  h,
  lift,
  vx = 0,
  grow = [1.16, 1.42],
  magnify = 0.2
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  lift: number;
  vx?: number;
  grow?: readonly [number, number];
  magnify?: number;
}) {
  const lv = clamp(lift, 0, 1.2);
  if (lv <= 0.01) return null;
  const [gx, gy] = grow;
  const bw = Math.round(w * gx),
    bh = Math.round(h * gy);
  const sx = Math.min(0.22, Math.abs(vx) / 4000);
  const kx = (1 / gx) * (1 + (gx - 1) * lv) * (1 + sx);
  const ky = (1 / gy) * (1 + (gy - 1) * lv) * (1 - sx * 0.5);
  const bezel = Math.max(5, Math.round(Math.min(bw, bh) * 0.2));
  return (
    <MorphGlass
      w={bw}
      h={bh}
      r={999}
      kind="clear"
      magnify={magnify}
      bezel={bezel}
      thick={Math.round(bezel * 1.1)}
      disperse={0.04}
      saturate={115}
      blur={0}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 60,
        transform: `translate(${(x - bw / 2).toFixed(2)}px, ${(y - bh / 2).toFixed(2)}px) scale(${kx.toFixed(4)}, ${ky.toFixed(4)})`,
        opacity: clamp(lv / 0.35),
        ['--lg-tint' as string]: 'var(--lens-tint)',
        ['--lg-shadow' as string]: 'var(--lens-shadow)',
        ['--sheen' as string]: 'var(--lens-sheen)'
      }}
    />
  );
}

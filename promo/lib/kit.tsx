import { useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { glassMap, refractOK } from '../../src/lib/glass';
import { ToolIcon, hasToolIcon } from '../../src/components/ToolIcon';
import { toolById } from '../../src/tools';
import { E, clamp, prog, type Rect } from './anim';
import { useThemeHere } from './theme';
import island from '../../src/tools/image-compress/island.webp';

// ———— 定位：所有元素都按舞台坐标（1440×810）绝对定位，位置、尺寸、旋转、缩放、透明度逐帧算好写进来 ————
export interface Pose {
  rot?: number;
  s?: number;
  sx?: number;
  sy?: number;
  o?: number;
  blur?: number;
  z?: number;
}
export function pose(r: Rect, { rot = 0, s = 1, sx = 1, sy = 1, o = 1, blur = 0, z }: Pose = {}): CSSProperties {
  const tf = [`translate(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px)`];
  if (rot) tf.push(`rotate(${rot.toFixed(3)}deg)`);
  if (s !== 1 || sx !== 1 || sy !== 1) tf.push(`scale(${(s * sx).toFixed(4)}, ${(s * sy).toFixed(4)})`);
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: r.w,
    height: r.h,
    transform: tf.join(' '),
    opacity: clamp(o),
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
    zIndex: z,
    visibility: o <= 0.001 ? 'hidden' : undefined
  };
}

// 只用位置（左上角）+ 变换，不定尺寸：文字之类按内容撑开
export function at(x: number, y: number, p: Pose & { anchor?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' } = {}): CSSProperties {
  const { rot = 0, s = 1, o = 1, blur = 0, z, anchor = 'left', valign = 'middle' } = p;
  const ax = anchor === 'left' ? '0%' : anchor === 'center' ? '-50%' : '-100%';
  const ay = valign === 'top' ? '0%' : '-50%';
  const tf = [`translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`, `translate(${ax}, ${ay})`];
  if (rot) tf.push(`rotate(${rot.toFixed(3)}deg)`);
  if (s !== 1) tf.push(`scale(${s.toFixed(4)})`);
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    whiteSpace: 'nowrap',
    transform: tf.join(' '),
    transformOrigin: anchor === 'left' ? '0 50%' : anchor === 'right' ? '100% 50%' : '50% 50%',
    opacity: clamp(o),
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
    zIndex: z,
    visibility: o <= 0.001 ? 'hidden' : undefined
  };
}

// ———— 液态玻璃：和网站 Glass 同一套位移图和滤镜，但尺寸由外面逐帧给定，变形时位移图跟着重算，没有一帧的延迟 ————
const OK = refractOK();
const KIND = {
  bar: { blur: 2.6, saturate: 170, disperse: 0.1 },
  sheet: { blur: 9, saturate: 170, disperse: 0.06 },
  clear: { blur: 0.4, saturate: 150, disperse: 0.12 }
} as const;
export function MorphGlass({
  w,
  h,
  r,
  kind = 'bar',
  magnify = 0,
  bezel,
  thick,
  blur,
  disperse,
  saturate,
  brightness,
  className = '',
  style,
  children
}: {
  w: number;
  h: number;
  r: number;
  kind?: keyof typeof KIND;
  magnify?: number;
  bezel?: number;
  thick?: number;
  blur?: number;
  disperse?: number;
  saturate?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const id = 'mg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const dark = useThemeHere() === 'dark';
  const k = KIND[kind];
  // 尺寸取整到 2px，变形时少算几张位移图
  const W = Math.max(8, Math.round(w / 2) * 2),
    H = Math.max(8, Math.round(h / 2) * 2);
  const R = Math.min(r, W / 2, H / 2);
  const bz = bezel ?? Math.round(Math.min(30, Math.max(12, Math.min(W, H) * 0.4)));
  const map = OK ? glassMap(W, H, R, bz, thick ?? Math.round(bz * 1.35), magnify) : null;
  const light = brightness ?? (dark ? 0.9 : 1.04);
  const bl = blur ?? k.blur;
  const d = disperse ?? k.disperse;
  const spec = dark ? 0.42 : 0.9;
  const filter = map ? `url(#${id}) saturate(${saturate ?? k.saturate}%) brightness(${light})` : `blur(14px) saturate(180%)`;
  return (
    <div
      className={`lg lg-${kind} ${className}`}
      style={{ ...style, width: W, height: H, borderRadius: R, backdropFilter: filter, WebkitBackdropFilter: filter }}
    >
      {map && (
        <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <filter id={id} x="0" y="0" width={W} height={H} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={W} height={H} preserveAspectRatio="none" result="map" />
            {bl > 0 && <feGaussianBlur in="SourceGraphic" stdDeviation={bl} edgeMode="duplicate" result="soft" />}
            {(
              [
                ['r', 1 - d, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
                ['g', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
                ['b', 1 + d, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']
              ] as const
            ).map(([c, kk, m]) => [
              <feDisplacementMap
                key={c + 'd'}
                in={bl > 0 ? 'soft' : 'SourceGraphic'}
                in2="map"
                scale={Math.round(map.scale * kk * 10) / 10}
                xChannelSelector="R"
                yChannelSelector="G"
                result={c + 'd'}
              />,
              <feColorMatrix key={c} in={c + 'd'} type="matrix" values={m} result={c} />
            ])}
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" result="lens" />
            <feColorMatrix in="map" type="matrix" values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 ${spec} 0 0`} result="spec" />
            <feComposite in="spec" in2="lens" operator="over" />
          </filter>
        </svg>
      )}
      {children}
    </div>
  );
}

// ———— 小部件 ————
export function Led({ color, size = 6, glow = 1, style }: { color: string; size?: number; glow?: number; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: glow > 0 ? `0 0 ${(size * 0.9 * glow).toFixed(1)}px ${color}` : undefined,
        ...style
      }}
    />
  );
}

// 工具键帽（和网站 .glyph 同一个样子）：画好图标的显示图标，没画的显示键帽字
export function ToolGlyph({ id, size = 38, radius, icon, style }: { id: string; size?: number; radius?: number; icon?: number; style?: CSSProperties }) {
  const tool = toolById(id);
  const mark = tool?.mark ?? '';
  const cjk = /[一-鿿]/.test(mark);
  return (
    <span
      className={'glyph' + (hasToolIcon(id) || cjk ? '' : ' glyph-latin')}
      style={{ width: size, height: size, borderRadius: radius ?? size * 0.27, fontSize: size * 0.42, ...style }}
    >
      {hasToolIcon(id) ? <ToolIcon id={id} size={icon ?? size * 0.55} /> : mark}
    </span>
  );
}

// 线条图标逐笔画出来：p = 0..1
export function Draw({ p, children, style }: { p: number; children: ReactNode; style?: CSSProperties }) {
  const box = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    box.current?.querySelectorAll('path, rect, circle, line, polyline, ellipse').forEach((n) => {
      if (!n.closest('mask, defs, clipPath')) n.setAttribute('pathLength', '1');
    });
  });
  const q = clamp(p);
  return (
    <span ref={box} className="draw" style={{ display: 'inline-flex', ['--draw' as string]: q.toFixed(4), ...style }}>
      {children}
    </span>
  );
}

// macOS 的箭头指针
export function Cursor({ x, y, press = 0, o = 1 }: { x: number; y: number; press?: number; o?: number }) {
  return (
    <svg
      width="26"
      height="32"
      viewBox="0 0 26 32"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 200,
        transform: `translate(${(x - 4).toFixed(2)}px, ${(y - 3).toFixed(2)}px) scale(${(1 - 0.12 * press).toFixed(3)})`,
        transformOrigin: '4px 3px',
        opacity: clamp(o),
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
        overflow: 'visible',
        visibility: o <= 0.001 ? 'hidden' : undefined
      }}
    >
      <path d="M4 3v21.5l5.4-5.2 3.6 8.6 3.8-1.6-3.6-8.4h7.6z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// 逐字浮现：每个字从下面、带一点模糊淡进来
export function Chars({
  text,
  t,
  at: start,
  stagger = 0.035,
  dur = 0.7,
  rise = 16,
  blur = 8,
  out,
  style
}: {
  text: string;
  t: number;
  at: number;
  stagger?: number;
  dur?: number;
  rise?: number;
  blur?: number;
  out?: [number, number];
  style?: CSSProperties;
}) {
  const chars = Array.from(text);
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {chars.map((c, i) => {
        let p = E.soft(prog(t, start + i * stagger, start + i * stagger + dur));
        let y = (1 - p) * rise;
        if (out) {
          const q = E.in3(prog(t, out[0] + i * stagger * 0.5, out[0] + i * stagger * 0.5 + out[1]));
          p *= 1 - q;
          y -= q * rise;
        }
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${y.toFixed(2)}px)`,
              filter: p < 0.99 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : undefined
            }}
          >
            {c}
          </span>
        );
      })}
    </span>
  );
}

// 一块内容整体淡入上浮
export function rise(t: number, start: number, dur = 0.6, dist = 14, blur = 6) {
  const p = E.soft(prog(t, start, start + dur));
  return { o: p, y: (1 - p) * dist, blur: (1 - p) * blur };
}

// 航拍照片（图片压缩页的示例图），换个裁切和色调当成同一次旅行的另几张
export function Photo({ variant = 0, style }: { variant?: number; style?: CSSProperties }) {
  const v = [
    { pos: '50% 50%', size: 'cover', filter: undefined },
    { pos: '30% 42%', size: '190%', filter: 'hue-rotate(-28deg) saturate(1.15) brightness(1.04)' },
    { pos: '40% 58%', size: '210%', filter: 'hue-rotate(22deg) saturate(0.95) brightness(0.96)' }
  ][variant];
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${island})`,
        backgroundSize: v.size,
        backgroundPosition: v.pos,
        filter: v.filter,
        ...style
      }}
    />
  );
}

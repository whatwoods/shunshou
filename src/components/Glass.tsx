import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent,
  type Ref
} from 'react';
import { glassMap, refractOK } from '../lib/glass';
import { useTheme } from '../lib/theme';

// 全站的玻璃只有三种，同一种在桌面和手机上参数完全一样。底色、阴影、高光写在 styles.css 的 .lg / .lg-<kind> 里：
// bar   导航、手机顶栏、标签栏、浮动工具栏这些能点的胶囊：几乎不磨砂，透镜和色散最明显，按下去会弹
// sheet ⌘K、拖入弹层、下拉菜单、底部操作栏、轻提示：底下常有文字，先磨砂再折射，字才看得清；不弹
// clear 压在照片上的胶囊和对比手柄：尽量看清背后的画面，按下去会弹
export type GlassKind = 'bar' | 'sheet' | 'clear';
const KIND: Record<GlassKind, { blur: number; saturate: number; fallbackBlur: number; disperse: number }> = {
  bar: { blur: 2.6, saturate: 170, fallbackBlur: 14, disperse: 0.1 },
  sheet: { blur: 9, saturate: 170, fallbackBlur: 28, disperse: 0.06 },
  clear: { blur: 0.4, saturate: 150, fallbackBlur: 10, disperse: 0.12 }
};

type Props = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'header' | 'span' | 'section';
  kind?: GlassKind;
  bezel?: number; // 边缘弯曲带的宽度，默认按元素短边算
  thick?: number; // 玻璃厚度，越厚折射越明显
  blur?: number; // 折射前的磨砂程度
  magnify?: number; // 中间放大多少（0.2 = 放大 1.2 倍），拖动时浮起来的透镜用
  disperse?: number; // 色散强度，默认按 kind
  saturate?: number;
  brightness?: number;
  fallbackBlur?: number; // 不支持折射的浏览器用普通毛玻璃
  pressed?: boolean; // 由外面决定的按压（比如拖动时手柄本身收不到指针事件）
  ref?: Ref<HTMLElement>;
};

const OK = refractOK();

// 回弹用的阻尼弹簧（阻尼比 0.45）：松手时冲过头一点再回来，像一块软玻璃
const SPRING = (() => {
  if (typeof CSS === 'undefined' || !CSS.supports('animation-timing-function', 'linear(0, 1)')) return null;
  const z = 0.45,
    w = 14.5,
    wd = w * Math.sqrt(1 - z * z),
    T = 0.72;
  const pts: string[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = (i / 36) * T;
    const x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    pts.push(x.toFixed(3));
  }
  return { easing: `linear(${pts.join(', ')})`, duration: T * 1000 };
})();
const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 液态玻璃：量出自身尺寸，生成同尺寸的位移图，再用 backdrop-filter 引用 SVG 滤镜
export function Glass({
  as = 'div',
  kind = 'bar',
  bezel,
  thick,
  magnify = 0,
  disperse = KIND[kind].disperse,
  blur = KIND[kind].blur,
  saturate = KIND[kind].saturate,
  brightness,
  fallbackBlur = KIND[kind].fallbackBlur,
  pressed,
  className,
  style,
  children,
  ref,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...rest
}: Props) {
  const id = 'lg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const { theme } = useTheme();
  const dark = theme === 'dark';
  // 深色模式下玻璃要压暗一点，否则背后的内容会被提亮、发灰
  const light = brightness ?? (dark ? 0.9 : 1.04);
  const el = useRef<HTMLElement | null>(null);
  const glint = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);
  const held = useRef(false);
  const [size, setSize] = useState<{ w: number; h: number; r: number } | null>(null);
  const springy = SPRING && kind !== 'sheet';

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      el.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useLayoutEffect(() => {
    const node = el.current;
    if (!OK || !node) return;
    let raf = 0;
    // offsetWidth 不受 transform 影响，正是 backdrop-filter 所用的坐标；圆角直接读 CSS，保证和外形一致
    const measure = () => {
      const w = node.offsetWidth,
        h = node.offsetHeight;
      const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      setSize((s) => (s && s.w === w && s.h === h && s.r === r ? s : { w, h, r }));
    };
    measure();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // 按下：玻璃往手指那边鼓起一点（横竖各涨几个像素；最多涨 5%–6%，宽导航里的字不会被拉变形）
  const press = useCallback((fx = 0, fy = 0) => {
    const n = el.current;
    if (!SPRING || !n || still()) return;
    const w = n.offsetWidth || 1,
      h = n.offsetHeight || 1;
    const sx = 1 + Math.min(0.06, (4 + Math.abs(fx) * 3) / w),
      sy = 1 + Math.min(0.05, (3 + Math.abs(fy) * 2) / h);
    held.current = true;
    anim.current?.cancel();
    anim.current = n.animate(
      { scale: `${sx} ${sy}`, translate: `${(fx * 2.5).toFixed(2)}px ${(fy * 2).toFixed(2)}px` },
      { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' }
    );
  }, []);
  // 松手：从当前形状弹回原样，冲过头一点再回来
  const release = useCallback(() => {
    const n = el.current,
      a = anim.current;
    // 抬手、取消、移出会接连触发，只在真的按着时弹一次
    if (!SPRING || !n || !a || !held.current) return;
    held.current = false;
    const cs = getComputedStyle(n);
    const from = { scale: cs.scale === 'none' ? '1' : cs.scale, translate: cs.translate === 'none' ? '0px' : cs.translate };
    a.cancel();
    anim.current = n.animate([from, { scale: '1', translate: '0px' }], { duration: SPRING.duration, easing: SPRING.easing });
    anim.current.onfinish = () => (anim.current = null);
  }, []);

  useEffect(() => {
    if (pressed === undefined) return;
    if (pressed) press();
    else release();
  }, [pressed, press, release]);

  // 弯曲带随元素大小走：同样是胶囊，大的边缘弯得宽一些；玻璃厚度比弯曲带大，边缘的透镜才看得出来
  const bz = size ? (bezel ?? Math.round(Math.min(30, Math.max(12, Math.min(size.w, size.h) * 0.4)))) : 0;
  const map = OK && size && size.w > 0 && size.h > 0 ? glassMap(size.w, size.h, size.r, bz, thick ?? Math.round(bz * 1.35), magnify) : null;
  const filter = map
    ? `url(#${id}) saturate(${saturate}%) brightness(${light})`
    : `blur(${fallbackBlur}px) saturate(${saturate + 20}%) brightness(${light})`;
  // 色散：红、绿、蓝三色各自按略有不同的折射率偏移，只在边缘弯曲带里看得到彩边
  const d = disperse;
  const spec = dark ? 0.42 : 0.9;

  // 高光跟着指针或手指走（只有 bar 这种能点的胶囊才有）
  const follow = (e: PointerEvent<HTMLElement>) => {
    const g = glint.current;
    if (!g) return;
    const r = e.currentTarget.getBoundingClientRect();
    g.style.setProperty('--x', `${e.clientX - r.left}px`);
    g.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  const own = springy && pressed === undefined;

  return createElement(
    as,
    {
      ref: setRef,
      className: `lg lg-${kind}` + (className ? ' ' + className : ''),
      style: { ...style, backdropFilter: filter, WebkitBackdropFilter: filter },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        if (kind === 'bar') follow(e);
        onPointerMove?.(e);
      },
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (kind === 'bar') follow(e);
        if (own && e.button === 0) {
          const r = e.currentTarget.getBoundingClientRect();
          press(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
        }
        onPointerDown?.(e);
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        if (own) release();
        onPointerUp?.(e);
      },
      onPointerCancel: (e: PointerEvent<HTMLElement>) => {
        if (own) release();
        onPointerCancel?.(e);
      },
      onPointerLeave: (e: PointerEvent<HTMLElement>) => {
        if (own) release();
        onPointerLeave?.(e);
      },
      ...rest
    },
    map && size && (
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <filter
          id={id}
          x="0"
          y="0"
          width={size.w}
          height={size.h}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feImage href={map.url} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
          {blur > 0 && <feGaussianBlur in="SourceGraphic" stdDeviation={blur} edgeMode="duplicate" result="soft" />}
          {(
            [
              ['r', 1 - d, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
              ['g', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
              ['b', 1 + d, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']
            ] as const
          ).map(([c, k, m]) => [
            <feDisplacementMap
              key={c + 'd'}
              in={blur > 0 ? 'soft' : 'SourceGraphic'}
              in2="map"
              scale={Math.round(map.scale * k * 10) / 10}
              xChannelSelector="R"
              yChannelSelector="G"
              result={c + 'd'}
            />,
            <feColorMatrix key={c} in={c + 'd'} type="matrix" values={m} result={c} />
          ])}
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" result="lens" />
          {/* 位移图的蓝色通道是弧面高光：变成白色、按强度给透明度，叠在折射结果上 */}
          <feColorMatrix in="map" type="matrix" values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 ${spec} 0 0`} result="spec" />
          <feComposite in="spec" in2="lens" operator="over" />
        </filter>
      </svg>
    ),
    kind === 'bar' && <span ref={glint} className="lg-glint" aria-hidden="true" />,
    children
  );
}

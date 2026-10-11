import { useEffect, useLayoutEffect, useRef, type ReactNode, useId } from 'react';
import { Lens, slotOf, switchSlots, useGlide, type GlideLook, type Mode } from './Lens';
import { ToolIcon, hasToolIcon } from './ToolIcon';

// 小键帽：工具图标。画好图形的工具显示图形（ToolIcon.tsx），还没画的显示键帽字：汉字用正文字体，字母和符号用等宽字体
export function Glyph({ tool }: { tool: { id: string; mark: string } }) {
  if (hasToolIcon(tool.id))
    return (
      <span className="glyph" aria-hidden="true">
        <ToolIcon id={tool.id} />
      </span>
    );
  const mark = tool.mark;
  const cjk = /[一-鿿]/.test(mark);
  const cls = cjk ? '' : mark.length > 2 ? ' glyph-latin-long' : ' glyph-latin';
  return (
    <span className={'glyph' + cls} aria-hidden="true">
      {mark}
    </span>
  );
}

export function Led({ color, status }: { color?: string; status?: 'done' | 'work' | 'error' | 'idle' }) {
  const cls = status && status !== 'idle' ? ` led-glow-${status}` : '';
  return <span className={'led' + cls} style={color ? { background: color } : undefined} aria-hidden="true" />;
}

export function Kbd({ children, small }: { children: ReactNode; small?: boolean }) {
  return <span className={'kbd' + (small ? ' kbd-sm' : '')}>{children}</span>;
}

// 分段控件：选中块是一个单独的元素，切换时滑到新的位置（不会从左上角飞进来）。
// 按住会浮起一块玻璃透镜，可以左右拖着挑，松手吸到最近的一格（动效见 Lens.tsx）
const SEG_LOOK: GlideLook = { grow: [1.16, 1.42], magnify: 0.2 };
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
  disabled = false,
  reselect = false
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  disabled?: boolean;
  // 点已选中的那一格也回调（当导航用时：工具页点当前分类回到首页这一类）
  reselect?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [glide, lens] = useGlide(SEG_LOOK);
  const tapped = useRef(false);
  const index = options.findIndex((o) => o.value === value);
  const slots = () => [...box.current!.querySelectorAll<HTMLElement>(':scope > .seg-btn')].map(slotOf);

  useLayoutEffect(() => {
    const el = box.current!;
    glide.box = el;
    glide.thumb = thumb.current;
    const put = (mode: Mode) => glide.place(slots()[index] ?? null, mode);
    put(tapped.current ? 'travel' : 'slide');
    tapped.current = false;
    const ro = new ResizeObserver(() => put('jump'));
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, options.length]);

  // 放在 disabled 的 fieldset 里时按钮也是禁用的
  const off = () => disabled || !!box.current?.querySelector('.seg-btn:disabled');
  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      className={'seg ' + className + (disabled ? ' is-disabled' : '')}
      onPointerDown={(e) => {
        // 控件自己处理这次按压，外面那块玻璃工具栏就不要跟着鼓起来了
        if (!off() && glide.down(e.nativeEvent, slots())) e.stopPropagation();
      }}
      onPointerMove={(e) => glide.move(e.nativeEvent)}
      onPointerUp={(e) => {
        const r = glide.release(e.nativeEvent);
        const o = r && options[r.index];
        if (o && (reselect || o.value !== value)) onChange(o.value);
      }}
      onPointerCancel={(e) => glide.cancel(index, e.pointerId)}
      onLostPointerCapture={(e) => glide.cancel(index, e.pointerId)}
      onClickCapture={(e) => {
        if (e.detail > 0 && glide.justReleased()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <span ref={thumb} className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg-btn"
          disabled={disabled}
          aria-pressed={o.value === value}
          onClick={(e) => {
            tapped.current = e.detail > 0;
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
      <Lens glide={glide} on={lens} />
    </div>
  );
}

// 滑块：原生 range 负责拖动和键盘，椭圆钮是自己画的，拖动时浮起来变成玻璃透镜，稍微跟不上手指、走快了会拉长
const SLIDER_LOOK: GlideLook = { grow: [1.45, 1.4], magnify: 0.12 };
const KNOB = { w: 38, h: 24 };
export function Slider({
  id,
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled,
  label
}: {
  id?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [glide, lens] = useGlide(SLIDER_LOOK);
  const frac = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const at = useRef(frac);
  at.current = frac;

  useLayoutEffect(() => {
    const el = box.current!;
    glide.box = el;
    glide.thumb = knob.current;
    glide.fill = fill.current;
    // 椭圆钮 38×24（和 styles.css 的 .slider-knob、原生圆钮一样宽），两头各留半个钮
    const put = (mode: Mode) => glide.place({ x: KNOB.w / 2 + (el.clientWidth - KNOB.w) * at.current, y: 14, w: KNOB.w, h: KNOB.h }, mode);
    put('slide');
    const ro = new ResizeObserver(() => put('jump'));
    ro.observe(el);
    return () => ro.disconnect();
  }, [frac]);

  // 松手可能落在别处，整页听一次
  useEffect(() => {
    const end = () => glide.hold(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [glide]);

  return (
    <span ref={box} className={'slider' + (disabled ? ' is-disabled' : '')}>
      <span className="slider-track" aria-hidden="true" />
      <span ref={fill} className="slider-fill" aria-hidden="true" />
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.currentTarget.matches(':disabled')) return;
          e.stopPropagation();
          glide.hold(true);
        }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span ref={knob} className="slider-knob" aria-hidden="true" />
      <Lens glide={glide} on={lens} />
    </span>
  );
}

// 设置面板里的一行：左边名称，右边控件。block 时控件另起一行占满（滑块、选项多的分段控件）。
// 里面是 input / select 时用 label 包住，点名称也能聚焦；是分段控件（一组按钮）时传 div
export function Field({
  label,
  hint,
  children,
  block,
  div
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  block?: boolean;
  div?: boolean;
}) {
  const Tag = div ? 'div' : 'label';
  return (
    <Tag className={'field-row' + (block ? ' is-block' : '')}>
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="field-control">{children}</span>
    </Tag>
  );
}

// 工具页顶部选项栏里的分段控件：上面一行小字名称，下面是选项（替代 2–4 个选项的下拉框）
export function SegField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  disabled?: boolean;
}) {
  return (
    <div className="seg-field">
      <span>{label}</span>
      <Segmented className="seg-sm" label={label} value={value} onChange={onChange} options={options} disabled={disabled} />
    </div>
  );
}

// 文字类工具的“试试示例”：空着的时候，一键填进一段能马上看到效果的内容
export function ExampleButton({ onClick, children = '试试示例' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="example-btn" onClick={onClick}>
      <SparkIcon size={14} />
      {children}
    </button>
  );
}

// 开关：点一下切换；也可以按住椭圆钮左右拖，它会浮起来变成一块更大的玻璃
const SWITCH_LOOK: GlideLook = { grow: [1.45, 1.5], magnify: 0.08 };
export function SwitchRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const track = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const [glide, lens] = useGlide(SWITCH_LOOK);
  const tapped = useRef(false);
  const on = checked ? 1 : 0;

  useLayoutEffect(() => {
    glide.box = track.current;
    glide.thumb = knob.current;
    glide.place(switchSlots(track.current!)[on], tapped.current ? 'travel' : 'slide');
    tapped.current = false;
  }, [on]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch-row"
      onClick={(e) => {
        if (e.detail > 0 && glide.justReleased()) return;
        tapped.current = e.detail > 0;
        onChange(!checked);
      }}
    >
      {children}
      <span
        ref={track}
        className="switch"
        aria-hidden="true"
        onPointerDown={(e) => {
          if (!e.currentTarget.closest('button')!.matches(':disabled') && glide.down(e.nativeEvent, switchSlots(track.current!)))
            e.stopPropagation();
        }}
        onPointerMove={(e) => glide.move(e.nativeEvent)}
        onPointerUp={(e) => {
          // 拖过：停在哪边算哪边；没拖：就是点了一下，翻过去
          const r = glide.release(e.nativeEvent, (i, moved) => (moved ? i : 1 - on));
          if (r && r.index !== on) onChange(r.index === 1);
        }}
        onPointerCancel={(e) => glide.cancel(on, e.pointerId)}
        onLostPointerCapture={(e) => glide.cancel(on, e.pointerId)}
      >
        <span ref={knob} className="switch-knob" />
      </span>
      <Lens glide={glide} on={lens} />
    </button>
  );
}

type IconProps = { size?: number; stroke?: string; width?: number };

// stroke 可以传 CSS 变量（比如 'var(--ink-2)'），会通过 color 生效。
// 线宽统一 1.8（和 ToolIcon 一套），很简单的图形（勾、加号、箭头）用 2，不要再出这个范围
function icon(d: ReactNode, defaults: { w?: number } = {}) {
  return ({ size = 16, stroke, width }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width ?? defaults.w ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={stroke ? { color: stroke } : undefined}
    >
      {d}
    </svg>
  );
}

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </>,
  { w: 2 }
);
export const PlusIcon = icon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
  { w: 2 }
);
export const DownloadIcon = icon(
  <>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </>,
  { w: 2 }
);
export const CloseIcon = icon(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>,
  { w: 2 }
);
export const TrashIcon = icon(<path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, { w: 1.8 });
export const ImageIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-9 9" />
  </>,
  { w: 1.8 }
);
export const SwapIcon = icon(
  <>
    <path d="M9 7l-5 5 5 5" />
    <path d="M15 7l5 5-5 5" />
  </>,
  { w: 2 }
);
export const DisplayIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </>,
  { w: 1.8 }
);
export const ShieldIcon = icon(
  <>
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </>,
  { w: 1.8 }
);
export const WifiIcon = icon(
  <>
    <path d="M2 8.5a15 15 0 0 1 20 0" />
    <path d="M5.5 12a10 10 0 0 1 13 0" />
    <path d="M9 15.5a5 5 0 0 1 6 0" />
    <circle cx="12" cy="19" r="1" />
  </>,
  { w: 1.8 }
);

export const SunIcon = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
  </>,
  { w: 1.8 }
);
export const MoonIcon = icon(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />, { w: 1.8 });
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />, { w: 2 });
export const StarIcon = icon(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />, { w: 1.8 });
export const ResetIcon = icon(
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
  </>,
  { w: 1.8 }
);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
  { w: 1.8 }
);
export const HomeIcon = icon(
  <>
    <path d="M3.5 11L12 4l8.5 7" />
    <path d="M6 9.5V20h12V9.5" />
  </>,
  { w: 1.8 }
);
export const FileIcon = icon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 12v6" />
    <path d="M9 15l3-3 3 3" />
  </>,
  { w: 1.8 }
);
export const SparkIcon = icon(<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2L5 10.5l5.2-1.8z" />, { w: 1.8 });
export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />, { w: 2 });
export const ZoomIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
    <path d="M11 8v6M8 11h6" />
  </>
);
// 上下左右箭头：排序、前移后移
const arrow = (deg: number) => icon(<path d="M12 19V5M6 11l6-6 6 6" transform={deg ? `rotate(${deg} 12 12)` : undefined} />, { w: 2 });
export const ArrowUpIcon = arrow(0);
export const ArrowRightIcon = arrow(90);
export const ArrowDownIcon = arrow(180);
export const ArrowLeftIcon = arrow(270);
// 顺时针旋转 90°
export const RotateIcon = icon(
  <>
    <path d="M19.5 12A7.5 7.5 0 1 1 17.3 6.7" />
    <path d="M17.3 2.7v4h-4" />
  </>
);
export const CopyIcon = icon(
  <>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </>
);
// 拖动把手：能按住拖着排序的地方
export function GripIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

// 网站标志：暖橙底上四个圆角方块（一套工具），左上那块亮着、带一个绿色小灯（正在用的那个）。不放文字。
// 和 public/favicon.svg 是同一个图形；public 里的 apple-touch-icon.png、icon-192.png、icon-512.png 是它导出的位图（512 那张四周留了安全边），改图形时一起重新导出
export function LogoMark({ size = 26 }: { size?: number }) {
  const id = useId().replace(/[^\w-]/g, '') + 'logo';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F88A54" />
          <stop offset="1" stopColor="#E35B22" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <rect x="14" y="14" width="16.5" height="16.5" rx="5" fill="#fff" />
      {[
        [33.5, 14],
        [14, 33.5],
        [33.5, 33.5]
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="16.5" height="16.5" rx="5" fill="#fff" fillOpacity=".42" />
      ))}
      <circle cx="25.4" cy="19.1" r="2.5" fill="#22B35E" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg
      className="chevron"
      width="8"
      height="13"
      viewBox="0 0 8 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 1.5l5 5-5 5" />
    </svg>
  );
}

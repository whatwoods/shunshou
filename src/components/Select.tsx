import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { Glass } from './Glass';
import { CheckIcon } from './ui';

// 规范 E 的下拉选择：按钮照系统弹出按钮的样子做，选项浮在内容上，用和别处一样的玻璃面板。
// 写法和原生 <select> 一样（<option> 子元素、onChange 里读 e.target.value），换的时候只改标签名。
interface Opt {
  value: string;
  label: ReactNode;
  text: string;
  disabled?: boolean;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function collect(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean };
    if (child.type === 'option') {
      const text = textOf(props.children);
      out.push({ value: props.value !== undefined ? String(props.value) : text, label: props.children, text, disabled: props.disabled });
    } else if (child.type === Fragment) collect(props.children, out);
  });
  return out;
}

export interface SelectProps {
  value: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  'aria-label'?: string;
  children: ReactNode;
}

export function Select({ value, onChange, disabled, className = '', id, title, children, ...rest }: SelectProps) {
  const options = collect(children);
  const current = options.findIndex((o) => o.value === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const listId = useId();
  const typed = useRef({ text: '', at: 0 });

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  function show() {
    if (disabled || !options.length) return;
    setActive(enabled(current) ? current : step(-1, 1));
    setOpen(true);
  }
  // refocus 为 'auto' 时：焦点还在菜单里才还给按钮（滚动、改窗口大小收起时），
  // 点到别的控件上收起时不抢它的焦点
  function close(refocus: boolean | 'auto' = true) {
    const inside = !!menu.current?.contains(document.activeElement);
    setOpen(false);
    setPos(null);
    if (refocus === true || (refocus === 'auto' && inside)) button.current?.focus({ preventScroll: true });
  }
  // 菜单挂在 body 上，读屏读不到外面的 <label>：把字段名单独给它
  function fieldName() {
    const b = button.current;
    if (!b) return undefined;
    const own = rest['aria-label'] || title;
    if (own) return own;
    const label = b.labels?.[0];
    if (!label) return undefined;
    const text = (label.textContent || '').replace(b.textContent || '', '').trim();
    return text || undefined;
  }
  function choose(i: number) {
    if (!enabled(i)) return;
    close();
    if (options[i].value !== String(value)) onChange?.({ target: { value: options[i].value } });
  }

  // 打开时贴着按钮摆放；下面放不下就往上翻
  useLayoutEffect(() => {
    if (!open) return;
    const b = button.current!.getBoundingClientRect();
    const m = menu.current!;
    const gap = 6,
      edge = 8;
    const below = innerHeight - b.bottom - gap - edge;
    const above = b.top - gap - edge;
    const want = Math.min(m.scrollHeight, 360);
    const up = want > below && above > below;
    const maxHeight = Math.max(120, Math.min(360, up ? above : below));
    const width = Math.max(b.width, m.offsetWidth);
    const left = Math.min(Math.max(edge, b.left), innerWidth - edge - width);
    setPos({
      left,
      minWidth: b.width,
      maxHeight,
      ...(up ? { bottom: innerHeight - b.top + gap } : { top: b.bottom + gap }),
      transformOrigin: up ? 'bottom' : 'top'
    });
  }, [open]);
  // 摆好位置、菜单可见以后再移焦点：visibility: hidden 的元素拿不到焦点
  const placed = !!pos;
  useLayoutEffect(() => {
    if (open && placed) menu.current?.focus({ preventScroll: true });
  }, [open, placed]);

  useEffect(() => {
    if (!open || !pos) return;
    menu.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, pos, active]);

  // 点外面、滚动页面、改窗口大小都收起来
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) close('auto');
    };
    const resize = () => close('auto');
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  function onButtonKey(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      show();
    }
  }
  function onMenuKey(e: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => step(i, 1)),
      ArrowUp: () => setActive((i) => step(i, -1)),
      Home: () => setActive(step(-1, 1)),
      End: () => setActive(step(options.length, -1)),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(),
      Tab: () => close()
    };
    const fn = keys[e.key];
    if (fn) {
      // Esc 只收起菜单，不要再触发工具页的“取消”
      if (e.key !== 'Tab') e.preventDefault();
      e.stopPropagation();
      fn();
      return;
    }
    // 输入开头的字直接跳到对应选项
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o, i) => enabled(i) && o.text.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  const selected = options[current];
  return (
    <>
      <button
        ref={button}
        type="button"
        id={id}
        title={title}
        aria-label={rest['aria-label']}
        className={'picker ' + className}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
      >
        <span className="picker-value">{selected ? selected.label : ' '}</span>
        <svg className="picker-chevron" width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
          <path d="M2 5l3-3 3 3M2 9l3 3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <Glass
            ref={menu}
            kind="sheet"
            id={listId}
            role="listbox"
            aria-label={fieldName()}
            tabIndex={-1}
            aria-activedescendant={`${listId}-${active}`}
            className="picker-menu"
            style={pos || { visibility: 'hidden', top: 0, left: 0 }}
            onKeyDown={onMenuKey}
          >
            <div className="picker-scroll">
              {options.map((o, i) => (
                <div
                  key={o.value + i}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === current}
                  aria-disabled={o.disabled || undefined}
                  className={'picker-option' + (i === active ? ' is-active' : '')}
                  onPointerMove={() => enabled(i) && i !== active && setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="picker-check">{i === current && <CheckIcon size={15} />}</span>
                  <span className="picker-label">{o.label}</span>
                </div>
              ))}
            </div>
          </Glass>,
          document.body
        )}
    </>
  );
}

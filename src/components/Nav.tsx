import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react';
import { Link, usePath } from '../router';
import { toggleTheme, useTheme } from '../lib/theme';
import { CATEGORIES, TOOLS, prefetchTool, type CatId } from '../tools';
import { Glass } from './Glass';
import { CheckIcon, Glyph, Led, LogoMark, MoonIcon, SearchIcon, Segmented, SunIcon } from './ui';

export const PaletteContext = createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => useContext(PaletteContext);

// 首页的三个章节；滚到哪一节，导航上那一项就垫一块滑块
const SECTIONS = [
  ['tools', '全部工具'],
  ['privacy', '隐私'],
  ['deploy', '自行部署']
] as const;

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

// 当前在看哪一节：章节顶部过了视口 40% 的位置就算进入；回到首屏时一个都不亮
function useSection(enabled: boolean) {
  const [active, setActive] = useState('');
  useEffect(() => {
    if (!enabled) return setActive('');
    const update = () => {
      let cur = '';
      for (const [id] of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= innerHeight * 0.4) cur = id;
      }
      setActive(cur);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);
  return active;
}

function Brand() {
  return (
    <Link to="/" className="nav-link nav-brand" aria-label="顺手 首页">
      <span className="logo" aria-hidden="true">
        <LogoMark />
      </span>
      <b>顺手</b>
    </Link>
  );
}

function NavButtons() {
  const palette = usePalette();
  const { theme } = useTheme();
  return (
    <>
      <span className="nav-sep" aria-hidden="true" />
      <button type="button" className="icon-btn" aria-label="搜索工具" title="搜索工具（⌘K）" onClick={palette.open}>
        <SearchIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
        title="切换深浅色"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }}
      >
        <span className="theme-icon">
          <span className="sun">
            <SunIcon />
          </span>
          <span className="moon">
            <MoonIcon />
          </span>
        </span>
      </button>
    </>
  );
}

// 章节导航（首页、开源许可页）：品牌 · 三个章节 · 搜索和深浅色
export function Nav() {
  const path = usePath();
  const scrolled = useScrolled();
  const active = useSection(path === '/');
  const links = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const a = active ? links.current?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
    setPill(a ? { left: a.offsetLeft, width: a.offsetWidth } : null);
  }, [active]);

  return (
    <div className="nav-wrap">
      <Glass as="header" className={'nav' + (scrolled ? ' is-scrolled' : '')}>
        <Brand />
        <nav ref={links} aria-label="主导航" className="nav-links">
          <span
            className="nav-pill"
            aria-hidden="true"
            style={pill ? { transform: `translateX(${pill.left}px)`, width: pill.width, opacity: 1 } : { opacity: 0 }}
          />
          {SECTIONS.map(([id, label]) => (
            <Link key={id} to={`/#${id}`} data-section={id} className="nav-link" aria-current={active === id ? 'location' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <NavButtons />
      </Glass>
    </div>
  );
}

// 分类导航：首页滚到“全部工具”时它吸顶，把章节导航顶走；工具页上直接用它。
// brand：左边放品牌、右边放搜索和深浅色（首页吸顶以后才出现）。
// current：工具页传当前工具的 id，分类就不再跳回首页，而是展开这一类的工具清单（鼠标悬停或点击；再点一下收起）
export function CatNav({
  value,
  onChange,
  brand = true,
  current,
  className = ''
}: {
  value: CatId | 'all';
  onChange: (v: CatId | 'all') => void;
  brand?: boolean;
  current?: string;
  className?: string;
}) {
  const scrolled = useScrolled();
  const menu = useCatMenu(current !== undefined);
  const options: (CatId | 'all')[] = ['all', ...CATEGORIES.map((c) => c.id)];
  return (
    <>
      <Glass
        as="div"
        ref={menu.bar}
        className={'nav cat-nav' + (brand ? ' has-brand' : '') + (scrolled ? ' is-scrolled' : '') + (className ? ' ' + className : '')}
        {...menu.barProps}
      >
        <span className="cat-nav-side" aria-hidden={!brand} inert={!brand}>
          <Brand />
        </span>
        <div
          className="cat-nav-scroll"
          onPointerOver={
            menu.on
              ? (e) => {
                  const btn = (e.target as HTMLElement).closest('.seg-btn');
                  const i = btn ? [...btn.parentElement!.querySelectorAll(':scope > .seg-btn')].indexOf(btn) : -1;
                  menu.hover(e, i > 0 ? (options[i] as CatId) : null);
                }
              : undefined
          }
          onKeyDown={menu.on ? menu.barKey : undefined}
        >
          <Segmented<CatId | 'all'>
            className="seg-cat"
            label={menu.on ? '分类' : '按分类筛选'}
            value={menu.open ?? value}
            onChange={(c) => (menu.on && c !== 'all' ? menu.toggle(c) : onChange(c))}
            reselect
            options={[{ id: 'all' as const, name: '全部', led: 'var(--accent)' }, ...CATEGORIES].map((c) => ({
              value: c.id,
              label: (
                <span className="cat-label">
                  <Led color={c.led} />
                  {c.name}
                </span>
              ) as ReactNode
            }))}
          />
        </div>
        <span className="cat-nav-side is-end" aria-hidden={!brand} inert={!brand}>
          <NavButtons />
        </span>
      </Glass>
      {menu.on && <CatMenu menu={menu} current={current} />}
    </>
  );
}

// 展开菜单的开合：悬停 120ms 才展开（划过导航不乱弹）；已经展开时移到别的分类 90ms 就换过去；
// 离开导航和菜单 200ms 后收起（斜着移向菜单时不会误关）。只认鼠标，触屏上靠点击
const OPEN_DELAY = 120,
  SWITCH_DELAY = 90,
  CLOSE_DELAY = 200;
function useCatMenu(on: boolean) {
  const [open, setOpen] = useState<CatId | null>(null);
  const bar = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const openedAt = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const hoverOK = useRef(false);
  const muted = useRef<CatId | null>(null);
  // 按 ↓ 展开时，菜单渲染出来后把焦点放到第一个工具上
  const focusIn = useRef(false);

  useEffect(() => {
    if (!on) return;
    const mq = matchMedia('(hover: hover) and (pointer: fine)');
    hoverOK.current = mq.matches;
    const sync = () => (hoverOK.current = mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [on]);

  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };
  const show = (c: CatId | null) => {
    clearTimeout(timer.current);
    if (c && c !== openRef.current) openedAt.current = performance.now();
    setOpen(c);
  };
  const close = () => show(null);

  // 点到导航和菜单以外、按 Esc、焦点移走：收起
  useEffect(() => {
    if (!open) return;
    const inside = (n: EventTarget | null) => n instanceof Node && (bar.current?.contains(n) || panel.current?.contains(n));
    const down = (e: globalThis.PointerEvent) => !inside(e.target) && close();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const btn = panel.current?.contains(document.activeElement) ? catButton(bar.current, openRef.current) : null;
      close();
      btn?.focus({ preventScroll: true });
    };
    const focus = (e: FocusEvent) => !inside(e.target) && close();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focus);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', focus);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = (e: PointerEvent) => e.pointerType === 'mouse' && hoverOK.current && clearTimeout(timer.current);
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !hoverOK.current || !openRef.current) return;
    later(close, CLOSE_DELAY);
  };
  return {
    on,
    open,
    bar,
    panel,
    close,
    focusIn,
    barProps: on ? { onPointerEnter: enter, onPointerLeave: leave } : {},
    panelProps: { onPointerEnter: enter, onPointerLeave: leave },
    // 鼠标停在某个分类上（null：停在“全部”或分类之间的空隙）
    hover(e: PointerEvent, c: CatId | null) {
      // 按着键时不算悬停：分段控件按下会捕获指针，松手后浏览器还会在按钮上补发一次 pointerover
      if (e.pointerType !== 'mouse' || !hoverOK.current || e.buttons) return;
      // 刚点击收起的那个分类，鼠标离开它之前不再悬停展开
      if (c === muted.current) return;
      muted.current = null;
      if (!c) {
        if (openRef.current) later(close, CLOSE_DELAY);
        else clearTimeout(timer.current);
      } else if (c !== openRef.current) later(() => show(c), openRef.current ? SWITCH_DELAY : OPEN_DELAY);
      else clearTimeout(timer.current);
    },
    // 点击：没开就展开，开着就收起；刚被悬停展开的那一下点击不算收起
    toggle(c: CatId) {
      if (c === openRef.current && performance.now() - openedAt.current > 500) {
        muted.current = c;
        close();
      } else show(c);
    },
    // 焦点在分类上时按 ↓：展开并进入菜单
    barKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown') return;
      const btn = (e.target as HTMLElement).closest('.seg-btn');
      const i = btn ? [...btn.parentElement!.querySelectorAll(':scope > .seg-btn')].indexOf(btn) : -1;
      if (i < 1) return;
      e.preventDefault();
      const c = CATEGORIES[i - 1].id;
      if (c === openRef.current) panel.current?.querySelector<HTMLElement>('.cat-menu-item')?.focus({ preventScroll: true });
      else {
        focusIn.current = true;
        show(c);
      }
    }
  };
}
type CatMenuState = ReturnType<typeof useCatMenu>;

function catButton(bar: HTMLElement | null, c: CatId | null) {
  const i = c ? CATEGORIES.findIndex((x) => x.id === c) + 1 : -1;
  return i > 0 ? (bar?.querySelectorAll<HTMLElement>('.seg-cat > .seg-btn')[i] ?? null) : null;
}

// 工具清单：挂在分类按钮正下方的一块玻璃；换分类时滑过去换内容，不收起再展开
function CatMenu({ menu, current }: { menu: CatMenuState; current?: string }) {
  const { open, panel, bar } = menu;
  const last = useRef<CatId | null>(open);
  if (open) last.current = open;
  const cat = last.current;
  const tools = cat ? TOOLS.filter((t) => t.cat === cat) : [];
  const cols = tools.length > 6 ? 2 : 1;
  const [pos, setPos] = useState<{ x: number; y: number; w: number; origin: number; glide: boolean } | null>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    const p = panel.current,
      btn = catButton(bar.current, open);
    if (!open || !p || !btn || !bar.current) {
      wasOpen.current = false;
      return;
    }
    const place = () => {
      const wrap = p.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const b = btn.getBoundingClientRect(),
        n = bar.current!.getBoundingClientRect();
      const w = Math.min(cols === 2 ? 560 : 320, innerWidth - 32);
      const center = b.left + b.width / 2;
      const left = Math.max(16, Math.min(innerWidth - 16 - w, center - w / 2));
      return { x: left - wrap.left, y: n.bottom - wrap.top + 10, w, origin: center - left };
    };
    setPos({ ...place(), glide: wasOpen.current });
    wasOpen.current = true;
    const onResize = () => setPos({ ...place(), glide: false });
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [open, cols, panel, bar]);

  useEffect(() => {
    if (!open || !menu.focusIn.current) return;
    menu.focusIn.current = false;
    panel.current?.querySelector<HTMLElement>('.cat-menu-item')?.focus({ preventScroll: true });
  }, [open, menu.focusIn, panel]);

  // 键盘：↑↓ 在工具之间走，最上面再按 ↑ 回到分类按钮
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...panel.current!.querySelectorAll<HTMLElement>('.cat-menu-item, .cat-menu-all')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    if (e.key === 'ArrowUp' && i <= 0) catButton(bar.current, open)?.focus({ preventScroll: true });
    else items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus({ preventScroll: true });
  };
  const info = cat ? CATEGORIES.find((c) => c.id === cat)! : null;

  return (
    <Glass
      as="div"
      kind="sheet"
      ref={panel}
      className={'cat-menu' + (open && pos ? ' is-open' : '') + (pos?.glide ? ' is-gliding' : '')}
      style={
        pos ? ({ transform: `translate(${pos.x}px, ${pos.y}px)`, width: pos.w, '--origin': `${pos.origin}px` } as CSSProperties) : undefined
      }
      inert={!open}
      aria-hidden={!open}
      onKeyDown={onKey}
      {...menu.panelProps}
    >
      {info && (
        <nav key={cat} className="cat-menu-body" aria-label={`${info.name}工具`}>
          <ul className={'cat-menu-list' + (cols === 2 ? ' is-two' : '')}>
            {tools.map((t) => (
              <li key={t.id}>
                <Link
                  to={t.path}
                  className="cat-menu-item"
                  aria-current={t.id === current ? 'page' : undefined}
                  onPointerEnter={() => prefetchTool(t.id)}
                  onFocus={() => prefetchTool(t.id)}
                  onClick={menu.close}
                >
                  <Glyph tool={t} />
                  <span className="text">
                    <span className="name">
                      {t.name}
                      {!t.ready && <span className="soon">即将上线</span>}
                    </span>
                    <span className="desc">{t.desc}</span>
                  </span>
                  {t.id === current && <CheckIcon size={16} />}
                </Link>
              </li>
            ))}
          </ul>
          <Link to={`/?cat=${info.id}#tools`} className="cat-menu-all" onClick={menu.close}>
            {info.name} · 全部 {tools.length} 个工具
            <span aria-hidden="true">→</span>
          </Link>
        </nav>
      )}
    </Glass>
  );
}

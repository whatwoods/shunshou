import { useSyncExternalStore } from 'react';

// 外观偏好：跟随系统 / 浅色 / 深色。实际生效的深浅色写在 <html data-theme>
export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'shunshou:theme';
const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '"system"');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref: ThemePref = readPref();

const resolve = (p: ThemePref): Theme => (p === 'system' ? (media?.matches ? 'dark' : 'light') : p);

function paint(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121211' : '#FFFFFF');
}

// 从 origin（通常是按钮中心）以圆形展开新的配色；不支持 View Transitions 或减少动态效果时直接切换。
// 切换期间关掉页面自己的颜色过渡（.theme-switching），否则新画面截图时颜色只过渡了一点，
// 圆形展开结束后各处还在继续变色，看起来一顿一顿的。按钮图标单独成组，在圆形上面转着换
function apply(theme: Theme, origin?: { x: number; y: number }) {
  const html = document.documentElement;
  if (html.dataset.theme === theme) return;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce || !origin) {
    paint(theme);
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  html.classList.add('theme-switching');
  const t = doc.startViewTransition(() => paint(theme));
  t.ready
    .then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 460, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    })
    .catch(() => {});
  t.finished.finally(() => html.classList.remove('theme-switching'));
}

export function setThemePref(next: ThemePref, origin?: { x: number; y: number }) {
  pref = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 存不了也照样切换 */
  }
  apply(resolve(next), origin);
  listeners.forEach((l) => l());
}

media?.addEventListener('change', () => {
  if (pref === 'system') {
    paint(resolve('system'));
    listeners.forEach((l) => l());
  }
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// 快照要带上实际生效的深浅色：跟随系统时 pref 一直是 'system'，只比 pref 的话系统切换后不会重渲染
const snapshot = () => `${pref}:${resolve(pref)}`;

export function useTheme(): { pref: ThemePref; theme: Theme } {
  const [p, t] = useSyncExternalStore(subscribe, snapshot).split(':') as [ThemePref, Theme];
  return { pref: p, theme: t };
}

// 导航上的按钮：在浅色和深色之间切换；如果切完正好和系统一致，就回到“跟随系统”
export function toggleTheme(origin?: { x: number; y: number }) {
  const next: Theme = resolve(pref) === 'dark' ? 'light' : 'dark';
  setThemePref(next === resolve('system') ? 'system' : next, origin);
}

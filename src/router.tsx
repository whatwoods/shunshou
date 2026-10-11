import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// 一个够用的小路由：History API + useSyncExternalStore
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', notify);
  // 每条记录记下自己是本站里的第几步、从哪一页来，页面里的“返回”才能真的退回去，而不是再压一条新记录
  if (typeof history.state?.idx !== 'number') history.replaceState({ idx: 0, from: null }, '');
}

type Entry = { idx: number; from: string | null };
const entry = (): Entry => (typeof history.state?.idx === 'number' ? history.state : { idx: 0, from: null });

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

// 查询参数也要能驱动界面，比如手机首页的标签（?tab=recent）和分类（?cat=pdf）
export function useSearch(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => location.search);
  return new URLSearchParams(search);
}

function scrollToHash(hash: string, smooth: boolean) {
  const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  else window.scrollTo(0, 0);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = new URL(to, location.href);
  const samePage = url.pathname === location.pathname && url.search === location.search;
  const next = url.pathname + url.search + url.hash;
  if (next !== location.pathname + location.search + location.hash) {
    const cur = entry();
    const state: Entry = opts.replace ? cur : { idx: cur.idx + 1, from: location.pathname + location.search };
    history[opts.replace ? 'replaceState' : 'pushState'](state, '', next);
  }
  if (!samePage) notify();
  // 等新页面渲染完再滚动
  requestAnimationFrame(() => scrollToHash(url.hash, samePage));
}

// 上一页（本站里的）地址；直接打开、刷新后第一页或从别的网站来时是 null
export function usePrevious(): string | null {
  return useSyncExternalStore(subscribe, () => entry().from);
}

// 页面里的“返回”：本站里有上一页就退回去（和系统返回手势一致），没有就替换成 fallback，不堆新记录
export function goBack(fallback: string) {
  if (entry().idx > 0) history.back();
  else navigate(fallback, { replace: true });
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean; back?: boolean };

// back：当返回按钮用（见 goBack）；replace：不新增记录（底部标签栏这类平级切换）
export function Link({ to, replace, back, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (back) goBack(to);
    else navigate(to, { replace });
  };
  return <a href={to} onClick={handle} {...rest} />;
}

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, usePath } from './router';
import { PAGE_LOADERS, POPULAR, prefetchTool, toolByPath } from './tools';
import { Home } from './pages/Home';
import { ToolSoon } from './pages/ToolSoon';
import { Licenses } from './pages/Licenses';
import { Nav, PaletteContext } from './components/Nav';
import { CommandPalette } from './components/CommandPalette';
import { Toaster } from './components/Toast';
import { CheckLens } from './components/Lens';
import { ErrorBoundary } from './components/ErrorBoundary';

// 每个工具单独打包，首页不用加载工具代码
const PAGES = Object.fromEntries(
  Object.entries(PAGE_LOADERS).map(([id, load]) => [id, lazy(load as () => Promise<{ default: ComponentType }>)])
);

function NotFound() {
  useEffect(() => {
    document.title = '找不到页面 · 顺手';
  }, []);
  return (
    <div className="tool-page">
      <Nav />
      <main className="tool-main" style={{ textAlign: 'center', paddingTop: 180 }}>
        <h1 style={{ margin: 0, fontSize: 40, fontWeight: 600 }}>这个页面不存在。</h1>
        <p style={{ margin: '14px 0 0', fontSize: 17, color: 'var(--ink-2)' }}>
          可能是地址打错了。<Link to="/#tools">看看全部工具 ›</Link>
        </p>
      </main>
    </div>
  );
}

export function App() {
  const path = usePath();
  const [palette, setPalette] = useState<'closed' | 'open' | 'closing'>('closed');
  const open = useCallback(() => setPalette('open'), []);
  const close = useCallback(() => {
    // 先播放收起动画，再卸载
    setPalette((p) => (p === 'open' ? 'closing' : p));
    setTimeout(() => setPalette((p) => (p === 'closing' ? 'closed' : p)), 160);
  }, []);
  const ctx = useMemo(() => ({ open }), [open]);

  // ⌘K / Ctrl+K 在任何页面都能打开搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => (p === 'open' ? p : 'open'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setPalette('closed'), [path]);

  // 页面空闲时，一个一个地把最常用的几个工具的页面代码下载好（Service Worker 会顺手缓存，断网也能打开）。
  // 省流量模式和 2G 网络下不做；开发时也不做，免得触发依赖预构建刷新页面
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /2g/.test(conn?.effectiveType || '')) return;
    const queue = [...POPULAR];
    let timer = 0;
    const idle = (fn: () => void) => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 8000 });
      else setTimeout(fn, 500);
    };
    const next = () => {
      const id = queue.shift();
      if (!id) return;
      prefetchTool(id);
      timer = window.setTimeout(() => idle(next), 1200);
    };
    timer = window.setTimeout(() => idle(next), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  let page;
  if (path === '/') {
    page = <Home />;
  } else if (path === '/licenses') {
    page = <Licenses />;
  } else {
    const tool = toolByPath(path);
    const Page = tool && PAGES[tool.id];
    page = !tool ? <NotFound /> : Page ? <Page /> : <ToolSoon tool={tool} />;
  }

  return (
    <PaletteContext.Provider value={ctx}>
      <ErrorBoundary resetKey={path}>
        <Suspense
          fallback={
            <div className="tool-page">
              <Nav />
              <div className="page-loading" aria-label="正在打开">
                <span className="led" />
              </div>
            </div>
          }
        >
          {page}
        </Suspense>
      </ErrorBoundary>
      {palette !== 'closed' && <CommandPalette onClose={close} closing={palette === 'closing'} />}
      <Toaster />
      <CheckLens />
    </PaletteContext.Provider>
  );
}

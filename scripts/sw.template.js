// 离线缓存：首页的脚本和样式在安装时预先缓存；工具的分包、wasm、字体等第一次用到时再缓存
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
// 当前版本的全部带哈希文件，旧版本留下的分包在激活时删掉，缓存不会越积越多
const CURRENT = new Set(__ASSETS__);
const ROUTES = new Set(__ROUTES__);
const SHELL = 'shunshou-shell-' + VERSION;
const ASSETS = 'shunshou-assets';

// 新版本装好后不抢先接管（不 skipWaiting）：还开着的旧页面继续由旧版本服务，用得到的旧分包也还在缓存里，
// 等这些页面都关掉才激活、清理。新打开的页面照样拿到新版本：页面本身总是先联网取
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

// 激活时已经没有旧版本的页面了，可以放心删旧文件；clients.claim 只对第一次安装有意义（让当前页面马上有离线缓存）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shunshou-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => caches.open(ASSETS))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => !CURRENT.has(new URL(r.url).pathname)).map((r) => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 预渲染页面按路径分别缓存；查询参数只控制界面状态，不改变 HTML。
  // 只有已知的应用路由能在离线时借用首页壳，独立页面和 iframe 必须保持隔离。
  if (req.mode === 'navigate') {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const appRoute = req.destination !== 'iframe' && ROUTES.has(path);
    const key = appRoute ? path : url.pathname;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            event.waitUntil(
              caches
                .open(SHELL)
                .then((c) => c.put(key, copy))
                .catch(() => {})
            );
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL);
          return (await cache.match(key)) || (appRoute && (await cache.match('/'))) || Response.error();
        })
    );
    return;
  }

  // 带哈希的静态资源：内容不会变，命中缓存就直接用
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

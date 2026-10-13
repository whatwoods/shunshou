// Service Worker 的更新策略和导航缓存必须同时保留离线功能与各页面的独立内容。
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const ORIGIN = 'https://x.test';
const SHELL = 'shunshou-shell-v2';
const keyOf = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;

function load() {
  const source = readFileSync(new URL('../../scripts/sw.template.js', import.meta.url), 'utf8')
    .replace('__VERSION__', 'v2')
    .replace('__PRECACHE__', JSON.stringify(['/']))
    .replace('__ASSETS__', JSON.stringify(['/assets/Page-new.js']))
    .replace('__ROUTES__', JSON.stringify(['/', '/image/compress', '/licenses', '/office']));
  const handlers: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>([
    ['shunshou-shell-v1', new Map([[keyOf('/'), new Response('old home')]])],
    [
      'shunshou-assets',
      new Map([
        [keyOf('/assets/Page-old.js'), new Response('old asset')],
        [keyOf('/assets/Page-new.js'), new Response('new asset')]
      ])
    ]
  ]);
  const write = vi.fn(async () => {});
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(keyOf(u), new Response('cached home'))),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: { url: string }) => m.delete(keyOf(r)),
      match: async (request: string | { url: string }) => m.get(keyOf(request))?.clone(),
      put: async (request: string | { url: string }, response: Response) => {
        await write();
        m.set(keyOf(request), response.clone());
      }
    };
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) }
  };
  const caches = {
    open: async (name: string) => cache(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: string | { url: string }) => {
      for (const store of stores.values()) {
        const response = store.get(keyOf(request));
        if (response) return response.clone();
      }
    }
  };
  const network = vi.fn(async (_request: unknown): Promise<Response> => {
    throw new Error('offline');
  });
  runInNewContext(source, { self, caches, URL, Promise, Set, Response, fetch: network });
  const run = async (type: string) => {
    const pending: Promise<unknown>[] = [];
    handlers[type]({ waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  };
  const request = async (path: string, overrides: Partial<Pick<Request, 'method' | 'mode' | 'destination'>> = {}) => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    handlers.fetch({
      request: { url: keyOf(path), method: 'GET', mode: 'navigate', destination: 'document', ...overrides },
      respondWith: (p: Promise<Response>) => (response = p),
      waitUntil: (p: Promise<unknown>) => pending.push(p)
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  };
  const cached = async (path: string) => stores.get(SHELL)?.get(keyOf(path))?.clone().text();
  return { self, stores, network, write, run, request, cached };
}

it('安装新版本时不抢先接管旧页面', async () => {
  const sw = load();
  await sw.run('install');
  expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  // 旧版本的缓存在激活前原样保留，旧页面还能用到它们。
  expect(sw.stores.has('shunshou-shell-v1')).toBe(true);
  expect(sw.stores.get('shunshou-assets')!.has(keyOf('/assets/Page-old.js'))).toBe(true);
});

it('激活后才清掉旧版本的文件', async () => {
  const sw = load();
  await sw.run('install');
  await sw.run('activate');
  expect(sw.stores.has('shunshou-shell-v1')).toBe(false);
  expect([...sw.stores.get('shunshou-assets')!.keys()]).toEqual([keyOf('/assets/Page-new.js')]);
});

it('工具和分类页面独立缓存，查询参数不产生重复 HTML，也不覆盖首页', async () => {
  const sw = load();
  await sw.run('install');
  sw.network.mockResolvedValueOnce(new Response('image page')).mockResolvedValueOnce(new Response('office page'));
  expect(await (await sw.request('/image/compress?quality=80'))!.text()).toBe('image page');
  expect(await (await sw.request('/office'))!.text()).toBe('office page');
  expect(await sw.cached('/')).toBe('cached home');
  expect(await sw.cached('/image/compress')).toBe('image page');
  expect(await sw.cached('/image/compress?quality=80')).toBeUndefined();
  expect(await (await sw.request('/image/compress/?quality=60'))!.text()).toBe('image page');
  expect(await (await sw.request('/office'))!.text()).toBe('office page');
});

it('只有已知应用路由可以离线回退到当前版本的首页壳', async () => {
  const sw = load();
  await sw.run('install');
  expect(await (await sw.request('/licenses'))!.text()).toBe('cached home');
  expect((await sw.request('/does-not-exist'))!.type).toBe('error');
  expect((await sw.request('/robots.txt'))!.type).toBe('error');
  expect((await sw.request('/image/compress', { destination: 'iframe' }))!.type).toBe('error');
});

it('没有当前版本首页缓存时不会借用旧版本页面', async () => {
  const sw = load();
  expect((await sw.request('/licenses'))!.type).toBe('error');
});

it('独立静态页与 iframe 只读写自己的导航缓存', async () => {
  const sw = load();
  await sw.run('install');
  sw.network.mockResolvedValueOnce(new Response('robots')).mockResolvedValueOnce(new Response('isolated preview'));
  await sw.request('/robots.txt');
  await sw.request('/html-preview-frame', { destination: 'iframe' });
  expect(await sw.cached('/')).toBe('cached home');
  expect(await (await sw.request('/robots.txt'))!.text()).toBe('robots');
  expect(await (await sw.request('/html-preview-frame', { destination: 'iframe' }))!.text()).toBe('isolated preview');
  expect((await sw.request('/missing-preview', { destination: 'iframe' }))!.type).toBe('error');
});

it('404 原样返回，不缓存错误页面或覆盖已有页面', async () => {
  const sw = load();
  await sw.run('install');
  sw.network.mockResolvedValueOnce(new Response('image page'));
  await sw.request('/image/compress');
  sw.network.mockResolvedValue(new Response('missing', { status: 404 }));
  expect((await sw.request('/does-not-exist'))!.status).toBe(404);
  expect((await sw.request('/image/compress'))!.status).toBe(404);
  expect(await sw.cached('/does-not-exist')).toBeUndefined();
  expect(await sw.cached('/image/compress')).toBe('image page');
  expect(await sw.cached('/')).toBe('cached home');
});

it('重定向响应不写入原路径缓存', async () => {
  const sw = load();
  await sw.run('install');
  const redirected = new Response('redirected page');
  Object.defineProperty(redirected, 'redirected', { value: true });
  sw.network.mockResolvedValueOnce(redirected);
  expect(await (await sw.request('/licenses'))!.text()).toBe('redirected page');
  expect(await sw.cached('/licenses')).toBeUndefined();
});

it('缓存写入失败不影响成功的网络响应', async () => {
  const sw = load();
  await sw.run('install');
  sw.network.mockResolvedValueOnce(new Response('image page'));
  sw.write.mockRejectedValueOnce(new Error('storage unavailable'));
  expect(await (await sw.request('/image/compress'))!.text()).toBe('image page');
});

it('不接管非 GET 或其他来源的请求', async () => {
  const sw = load();
  expect(await sw.request('/image/compress', { method: 'POST' })).toBeUndefined();
  expect(await sw.request('https://other.test/')).toBeUndefined();
  expect(sw.network).not.toHaveBeenCalled();
});

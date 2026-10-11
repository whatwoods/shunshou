// Service Worker 的更新策略：新版本装好后不抢先接管还开着的旧页面，激活（旧页面都关掉）后才清理旧分包
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function load() {
  const source = readFileSync(new URL('../../scripts/sw.template.js', import.meta.url), 'utf8')
    .replace('__VERSION__', 'v2')
    .replace('__PRECACHE__', JSON.stringify(['/']))
    .replace('__ASSETS__', JSON.stringify(['/assets/Page-new.js']));
  const handlers: Record<string, (e: unknown) => void> = {};
  const stores = new Map<string, Map<string, unknown>>([
    ['shunshou-shell-v1', new Map([['/', 1]])],
    [
      'shunshou-assets',
      new Map([
        ['https://x.test/assets/Page-old.js', 1],
        ['https://x.test/assets/Page-new.js', 1]
      ])
    ]
  ]);
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (urls: string[]) => urls.forEach((u) => m.set(u, 1)),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: { url: string }) => m.delete(r.url)
    };
  };
  const self = {
    location: { origin: 'https://x.test' },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) }
  };
  const caches = {
    open: async (name: string) => cache(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name)
  };
  runInNewContext(source, { self, caches, URL, Promise, Set, fetch: () => Promise.reject(new Error('offline')) });
  const run = async (type: string) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  return { self, stores, run };
}

it('安装新版本时不抢先接管旧页面', async () => {
  const sw = load();
  await sw.run('install');
  expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  // 旧版本的缓存在激活前原样保留，旧页面还能用到它们
  expect(sw.stores.has('shunshou-shell-v1')).toBe(true);
  expect(sw.stores.get('shunshou-assets')!.has('https://x.test/assets/Page-old.js')).toBe(true);
});

it('激活后才清掉旧版本的文件', async () => {
  const sw = load();
  await sw.run('install');
  await sw.run('activate');
  expect(sw.stores.has('shunshou-shell-v1')).toBe(false);
  expect([...sw.stores.get('shunshou-assets')!.keys()]).toEqual(['https://x.test/assets/Page-new.js']);
});

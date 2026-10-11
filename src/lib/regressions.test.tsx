// @vitest-environment jsdom
// 几个跨模块的回归：交接只给目标页、任务池取消后继续派活、跟随系统时主题 hook 会更新
import { afterEach, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useHandOff } from './useHandOff';
import { handOff, takeHandOff } from './store';
import { Pool } from '../tools/image-compress/pool';

afterEach(() => {
  takeHandOff();
  vi.unstubAllGlobals();
});

test('在别的工具页发起交接时，文件只交给目标页', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const current = vi.fn(),
    target = vi.fn();
  const root = createRoot(document.createElement('div'));
  function Page({ receive }: { receive: (files: File[]) => void }) {
    useHandOff(receive);
    return null;
  }
  history.pushState(null, '', '/code/hash');
  await act(async () => root.render(createElement(Page, { key: 'current', receive: current })));
  const file = new File(['x'], 'photo.png');
  await act(async () => {
    handOff([file], '/image/compress');
    history.pushState(null, '', '/image/compress');
    root.render(createElement(Page, { key: 'target', receive: target }));
  });
  expect(current).not.toHaveBeenCalled();
  expect(target).toHaveBeenCalledWith([file]);
  await act(async () => root.unmount());
  history.pushState(null, '', '/');
});

test('取消正在处理的任务后，排队的任务接着开始', () => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
  let posted = 0;
  vi.stubGlobal(
    'Worker',
    class {
      postMessage() {
        posted++;
      }
      terminate() {}
    }
  );
  const pool = new Pool(
    () => {},
    () => {}
  );
  const jobs = ['a', 'b'].map((id) => ({
    id,
    gen: 0,
    file: new File(['x'], id),
    fmt: 'keep' as const,
    quality: 80,
    maxWidth: 0,
    stripExif: true
  }));
  pool.submit(jobs);
  expect(posted).toBe(1);
  pool.cancel('a');
  expect(posted).toBe(2);
  pool.dispose();
});

test('跟随系统时，系统切换深浅色会让主题 hook 重新渲染', async () => {
  let changed = () => {};
  let dark = false;
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark;
    },
    addEventListener(_type: string, cb: () => void) {
      changed = cb;
    }
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  vi.resetModules();
  const { useTheme } = await import('./theme');
  const root = createRoot(document.createElement('div'));
  let latest = '';
  function T() {
    latest = useTheme().theme;
    return null;
  }
  await act(async () => root.render(createElement(T)));
  expect(latest).toBe('light');
  await act(async () => {
    dark = true;
    changed();
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(latest).toBe('dark');
  await act(async () => root.unmount());
});

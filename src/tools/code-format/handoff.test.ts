// @vitest-environment jsdom
import { act, createElement, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
vi.mock('../../components/ToolPage', () => ({ ToolPage: () => null }));
vi.mock('../../components/DropZone', () => ({ DropOverlay: () => null }));
import { CodeFiles } from '../../components/kit/CodeKit';
import { handOff, takeHandOff } from '../../lib/store';
test('首页文件在 StrictMode effect 重放后启动处理', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let running = false;
  let calls = 0;
  function Harness() {
    useEffect(
      () => () => {
        running = false;
      },
      []
    );
    return createElement(CodeFiles, {
      onFiles: () => {
        running = true;
        calls++;
      }
    });
  }
  takeHandOff();
  handOff([new File(['test'], 'test.txt')]);
  try {
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(Harness)));
    });
    expect(calls).toBe(1);
    expect(running).toBe(true);
    await act(async () => {
      handOff([new File(['next'], 'next.txt')]);
    });
    expect(calls).toBe(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    takeHandOff();
  }
});

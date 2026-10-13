// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Page from './Page';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('空文本算完哈希后恢复默认，旧算法的摘要与完成状态失效', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  let reply: ((event: { data: unknown }) => void) | undefined;
  vi.stubGlobal(
    'Worker',
    class {
      set onmessage(callback: typeof reply) {
        reply = callback;
      }
      postMessage() {}
      terminate() {}
    }
  );
  localStorage.setItem('shunshou:code-hash', JSON.stringify({ algorithms: ['MD5'] }));
  const box = document.createElement('div');
  document.body.append(box);
  const root = createRoot(box);
  try {
    await act(async () => root.render(createElement(Page)));
    const button = (label: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.includes(label))!;
    await act(async () => button('开始计算').click());
    expect(button('恢复默认').disabled).toBe(true);
    await act(async () => reply!({ data: { result: { MD5: 'd41d8cd98f00b204e9800998ecf8427e' } } }));
    expect(box.textContent).toContain('d41d8cd98f00b204e9800998ecf8427e');
    await act(async () => button('恢复默认').click());
    expect(JSON.parse(localStorage.getItem('shunshou:code-hash')!)).toEqual({ algorithms: ['SHA-256'] });
    expect(box.textContent).not.toContain('摘要结果');
    expect(box.textContent).not.toContain('计算完成');
  } finally {
    await act(async () => root.unmount());
    box.remove();
  }
});

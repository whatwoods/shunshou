// @vitest-environment jsdom
// 生成 ULID 后点标题旁的“恢复默认”：设置回到 UUID v4，旧结果不能还挂着、下载名也不能变成 uuid4.txt
import { afterEach, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Page from './Page';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('恢复默认后旧结果作废', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  localStorage.setItem('shunshou:code-id', JSON.stringify({ kind: 'ulid', count: 1 }));
  const box = document.createElement('div');
  document.body.append(box);
  const root = createRoot(box);
  await act(async () => root.render(createElement(Page)));
  const output = () => box.querySelector<HTMLTextAreaElement>('textarea[readonly]')!.value;

  await act(async () => {
    box.querySelector('form')!.requestSubmit();
    await import('./logic');
  });
  await vi.waitFor(() => expect(output()).toMatch(/^[0-9A-Z]{26}$/));

  const reset = [...box.querySelectorAll('button')].find((b) => b.textContent?.includes('恢复默认'))!;
  await act(async () => reset.click());
  expect(JSON.parse(localStorage.getItem('shunshou:code-id')!)).toEqual({ kind: 'uuid4', count: 10 });
  expect(output()).toBe('');
  expect(box.textContent).not.toContain('处理完成');
  await act(async () => root.unmount());
  box.remove();
});

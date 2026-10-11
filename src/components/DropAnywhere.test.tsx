// @vitest-environment jsdom
// 文件推荐层是模态的：焦点进来、Tab 不跑到背后、Esc 关掉后焦点回到打开它的按钮
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, createElement as h, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DropAnywhere } from './DropAnywhere';

let box: HTMLDivElement;
let root: Root;
function App() {
  const [files, setFiles] = useState<File[] | null>(null);
  return h(
    'div',
    null,
    h('button', { id: 'open', onClick: () => setFiles([new File(['a'], 'a.png', { type: 'image/png' })]) }, '打开文件'),
    files && h(DropAnywhere, { files, onClose: () => setFiles(null) })
  );
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  act(() => root.render(h(App)));
});
afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.unstubAllGlobals();
});

const key = (k: string, shiftKey = false) =>
  act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true })));

test('打开时焦点进入弹层，背后的按钮不可用', () => {
  const opener = document.getElementById('open')!;
  opener.focus();
  act(() => opener.click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(opener.inert).toBe(true);
});

test('Shift+Tab 从第一个控件绕到最后一个', () => {
  act(() => document.getElementById('open')!.click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const buttons = dialog.querySelectorAll<HTMLElement>('button');
  buttons[0].focus();
  key('Tab', true);
  expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  key('Tab');
  expect(document.activeElement).toBe(buttons[0]);
});

test('Esc 关闭后焦点回到“打开文件”', () => {
  const opener = document.getElementById('open')!;
  opener.focus();
  act(() => opener.click());
  key('Escape');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(opener.inert).toBe(false);
  expect(document.activeElement).toBe(opener);
});

// @vitest-environment jsdom
// 自绘下拉的焦点和名称：读屏要知道菜单属于哪个字段；收起后焦点回到合适的地方
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Select } from './Select';

let box: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.scrollIntoView = () => {};
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  act(() =>
    root.render(
      h(
        'div',
        null,
        h(
          'label',
          null,
          '输出格式',
          h(Select, {
            value: 'png',
            onChange: () => {},
            children: [h('option', { key: 'p', value: 'png' }, 'PNG'), h('option', { key: 'j', value: 'jpg' }, 'JPEG')]
          })
        ),
        h('button', { id: 'other' }, '别的按钮')
      )
    )
  );
});
afterEach(() => {
  act(() => root.unmount());
  box.remove();
  vi.unstubAllGlobals();
});

const trigger = () => box.querySelector<HTMLButtonElement>('.picker')!;
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const open = () => act(() => trigger().click());

test('菜单带上字段名，不含当前取值；摆好位置后焦点在菜单上', () => {
  open();
  expect(listbox()!.style.visibility).not.toBe('hidden');
  expect(listbox()?.getAttribute('aria-label')).toBe('输出格式');
  expect(document.activeElement).toBe(listbox());
});

test('Esc 收起后焦点回到按钮', () => {
  open();
  act(() => listbox()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(listbox()).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test('改窗口大小收起时焦点不丢到 body', () => {
  open();
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  expect(listbox()).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

test('点别的控件收起时不抢它的焦点', () => {
  open();
  const other = document.getElementById('other')!;
  act(() => {
    other.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    other.focus();
  });
  expect(listbox()).toBeNull();
  expect(document.activeElement).toBe(other);
});

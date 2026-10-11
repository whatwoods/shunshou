// @vitest-environment jsdom
// 液态玻璃控件的拖动：松手吸到离手指最近的一格；松手后浏览器补发的那次 click 不能再切一次
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Segmented, SwitchRow } from './ui';
import { CheckLens } from './Lens';

let box: HTMLDivElement;
let root: Root;
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
});
afterEach(async () => {
  await act(async () => root.unmount());
  box.remove();
  vi.unstubAllGlobals();
});

const pointer = (el: Element, type: string, x: number) =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 15, button: 0, pointerId: 1 }));
// 浏览器在 pointerup 之后补发的 click（detail = 1 表示是指针点出来的）
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
// jsdom 不排版：按钮按 60px 一格摆好
function layout(buttons: NodeListOf<HTMLElement>) {
  buttons.forEach((b, i) => {
    Object.defineProperty(b, 'offsetLeft', { value: 3 + i * 60 });
    Object.defineProperty(b, 'offsetTop', { value: 3 });
    Object.defineProperty(b, 'offsetWidth', { value: 60 });
    Object.defineProperty(b, 'offsetHeight', { value: 30 });
  });
}

test('分段控件：拖到哪格选哪格，补发的 click 不再处理', async () => {
  const changes: string[] = [];
  function Demo() {
    const [v, setV] = useState('a');
    return createElement(Segmented<string>, {
      label: '测试',
      value: v,
      onChange: (x: string) => {
        changes.push(x);
        setV(x);
      },
      options: ['a', 'b', 'c'].map((value) => ({ value, label: value }))
    });
  }
  await act(async () => root.render(createElement(Demo)));
  const seg = box.querySelector<HTMLElement>('.seg')!;
  const btns = seg.querySelectorAll<HTMLElement>('.seg-btn');
  layout(btns);

  // 从 a 按下，拖过 b，停在 c 上松手
  await act(async () => {
    pointer(btns[0], 'pointerdown', 30);
    pointer(seg, 'pointermove', 100);
    pointer(seg, 'pointermove', 160);
    pointer(seg, 'pointerup', 160);
    click(seg);
  });
  expect(changes).toEqual(['c']);
  expect(btns[2].getAttribute('aria-pressed')).toBe('true');

  // 拖出控件右边很远：橡皮筋拉不出去，还是 c；回到 b 附近松手就是 b
  await act(async () => {
    pointer(btns[2], 'pointerdown', 160);
    pointer(seg, 'pointermove', 400);
    pointer(seg, 'pointermove', 95);
    pointer(seg, 'pointerup', 95);
    click(btns[1]);
  });
  expect(changes).toEqual(['c', 'b']);

  // 键盘（click 的 detail = 0）照常切换
  await act(async () => btns[0].click());
  expect(changes).toEqual(['c', 'b', 'a']);
});

test('开关：点一下翻一次，拖过去看停在哪边', async () => {
  const changes: boolean[] = [];
  function Demo() {
    const [on, setOn] = useState(false);
    return createElement(SwitchRow, {
      checked: on,
      onChange: (v: boolean) => {
        changes.push(v);
        setOn(v);
      },
      children: '测试'
    });
  }
  await act(async () => root.render(createElement(Demo)));
  const row = box.querySelector<HTMLElement>('.switch-row')!;
  const track = box.querySelector<HTMLElement>('.switch')!;
  // 64×28 的轨道，椭圆钮 38×24：关在 x=21，开在 x=43
  Object.defineProperty(track, 'clientWidth', { value: 64 });
  Object.defineProperty(track, 'clientHeight', { value: 28 });

  // 点椭圆钮：开，补发的 click 不再翻回去
  await act(async () => {
    pointer(track, 'pointerdown', 20);
    pointer(track, 'pointerup', 20);
    click(track);
  });
  expect(changes).toEqual([true]);
  expect(row.getAttribute('aria-checked')).toBe('true');

  // 从右边拖到左边又拖回右边松手：还是开着，不触发
  await act(async () => {
    pointer(track, 'pointerdown', 44);
    pointer(track, 'pointermove', 12);
    pointer(track, 'pointermove', 50);
    pointer(track, 'pointerup', 50);
    click(track);
  });
  expect(changes).toEqual([true]);

  // 拖到左边松手：关
  await act(async () => {
    pointer(track, 'pointerdown', 44);
    pointer(track, 'pointermove', 10);
    pointer(track, 'pointerup', 10);
    click(track);
  });
  expect(changes).toEqual([true, false]);

  // 点文字那边（不在圆钮上）：普通的点击，翻一次
  await act(async () => click(row));
  expect(changes).toEqual([true, false, true]);
});

test('画成开关的复选框：点一下只翻一次，拖回原处不翻', async () => {
  const changes: boolean[] = [];
  function Demo() {
    const [on, setOn] = useState(false);
    return createElement(
      'div',
      { className: 'tool-main' },
      createElement('input', {
        type: 'checkbox',
        checked: on,
        onChange: (e: { target: HTMLInputElement }) => {
          changes.push(e.target.checked);
          setOn(e.target.checked);
        }
      }),
      createElement(CheckLens)
    );
  }
  await act(async () => root.render(createElement(Demo)));
  const input = box.querySelector<HTMLInputElement>('input')!;
  // 52×23，椭圆钮 30×19：关在 x=17，开在 x=35
  Object.defineProperty(input, 'clientWidth', { value: 52 });
  Object.defineProperty(input, 'clientHeight', { value: 23 });

  await act(async () => {
    pointer(input, 'pointerdown', 14);
    pointer(input, 'pointerup', 14);
    click(input);
  });
  expect(changes).toEqual([true]);
  expect(input.checked).toBe(true);

  await act(async () => {
    pointer(input, 'pointerdown', 36);
    pointer(input, 'pointermove', 6);
    pointer(input, 'pointermove', 40);
    pointer(input, 'pointerup', 40);
    click(input);
  });
  expect(changes).toEqual([true]);
  expect(input.checked).toBe(true);

  await act(async () => {
    pointer(input, 'pointerdown', 36);
    pointer(input, 'pointermove', 5);
    pointer(input, 'pointerup', 5);
    click(input);
  });
  expect(changes).toEqual([true, false]);
  expect(input.checked).toBe(false);
});

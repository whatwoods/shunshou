// 宣传片的时间表：每一场从哪一秒开始，鼠标什么时候移到哪、什么时候按下
import { E, clamp, kf, lerp, prog, type Ease } from './lib/anim';
import { PREVIEW, TOOLBAR, SEG_X, SEG_W, sliderKnobX, nextChip, pageSlot, ACTION, RES_Y } from './layout';

export const T = {
  logo: 0, // 标志亮起来
  hero: 2.3, // 四个方块变成首页的键帽，卡片长出来
  drop: 7.3, // 拖进一张照片，推荐工具
  bench: 11.6, // 点“图片压缩”，变成工具页
  pdf: 19.0, // 接着用：图片转 PDF
  palette: 25.4, // ⌘K
  wall: 29.4, // 全部工具
  privacy: 33.4, // 文件不离开设备
  phone: 38.6, // 手机
  dark: 41.6, // 深色
  finale: 44.6, // 收回成标志
  end: 51
};
export const DURATION = T.end;
// ⌘K 面板散开、工具墙接上来的时刻（比 T.wall 早一点，标题在 T.wall 前后写完）
export const PAL_OUT = T.wall - 0.95;
export const CHAPTERS: [string, number][] = [
  ['标志', T.logo],
  ['首页', T.hero],
  ['拖入', T.drop],
  ['压缩', T.bench],
  ['转 PDF', T.pdf],
  ['⌘K', T.palette],
  ['工具墙', T.wall],
  ['隐私', T.privacy],
  ['手机', T.phone],
  ['结尾', T.finale]
];

// ———— 鼠标 ————
// 移动：[开始, 结束, x, y, 缓动]；按下：[按下, 松开]；拖文件时右下角带一个绿色的“+”
type Move = readonly [number, number, number, number, Ease?];
const KNOB = { from: sliderKnobX((80 - 10) / 90), to: sliderKnobX((60 - 10) / 90) };
export const SLIDER_DRAG = { down: 14.35, up: 15.25, a: 14.45, b: 15.15, ...KNOB };
export const SPLIT_DRAG = { down: 16.5, up: 17.95 };
export const PAGE_DRAG = { down: 20.45, up: 21.45, a: 20.55, b: 21.35 };
const avif = { x: TOOLBAR.x + SEG_X[2] + SEG_W[2] / 2, y: TOOLBAR.y + 30 };
const pdfChip = nextChip(4);
const page3 = pageSlot(2),
  page1 = pageSlot(0);
const knobY = PREVIEW.y + PREVIEW.h / 2;

const START = { x: 1530, y: 930 };
const MOVES: Move[] = [
  [7.45, 8.85, 1010, 548, E.hand],
  [10.25, 10.95, 330, RES_Y + 280, E.hand],
  [12.35, 13.1, avif.x, avif.y, E.hand],
  [13.55, 14.2, KNOB.from, TOOLBAR.y + 30, E.hand],
  [SLIDER_DRAG.a, SLIDER_DRAG.b, KNOB.to, TOOLBAR.y + 30, E.inOut3],
  [15.75, 16.35, PREVIEW.x + PREVIEW.w / 2, knobY, E.hand],
  [16.6, 17.1, PREVIEW.x + 230, knobY, E.inOut3],
  [17.15, 17.65, PREVIEW.x + 620, knobY, E.inOut3],
  [17.7, 17.95, PREVIEW.x + 470, knobY, E.inOut3],
  [18.05, 18.6, pdfChip.x + pdfChip.w / 2, pdfChip.y + 19, E.hand],
  [19.7, 20.3, page3.x + page3.w / 2, page3.y + page3.h / 2, E.hand],
  [PAGE_DRAG.a, PAGE_DRAG.b, page1.x + page1.w / 2, page1.y + page1.h / 2, E.inOut3],
  [21.65, 22.25, ACTION.x + ACTION.w - 76, ACTION.y + ACTION.h / 2, E.hand],
  [22.7, 23.3, ACTION.x + ACTION.w + 160, ACTION.y + 120, E.in3]
];
const CLICKS: [number, number][] = [
  [11.3, 11.42],
  [13.25, 13.37],
  [SLIDER_DRAG.down, SLIDER_DRAG.up],
  [SPLIT_DRAG.down, SPLIT_DRAG.up],
  [18.7, 18.82],
  [PAGE_DRAG.down, PAGE_DRAG.up],
  [22.35, 22.47]
];
export const DRAG_FILE = { show: 7.35, release: 9.0 };

export function cursorAt(t: number) {
  let x = START.x,
    y = START.y;
  for (const [a, b, tx, ty, ease = E.hand] of MOVES) {
    if (t >= b) {
      x = tx;
      y = ty;
    } else if (t > a) {
      const p = ease(prog(t, a, b));
      x = lerp(x, tx, p);
      y = lerp(y, ty, p);
      break;
    } else break;
  }
  let press = 0;
  for (const [d, u] of CLICKS) press = Math.max(press, kf(t, [[d, 0], [d + 0.07, 1, E.out2], [u, 1], [u + 0.12, 0, E.out2]]));
  const o = clamp(prog(t, 7.3, 7.45)) * (1 - prog(t, 23.0, 23.3));
  const copy = t < DRAG_FILE.release ? 1 : 1 - prog(t, DRAG_FILE.release, DRAG_FILE.release + 0.12);
  return { x, y, press, o, copy };
}

// 求导：某个随时间变化的量的速度（每秒）
export const vel = (f: (t: number) => number, t: number) => (f(t + 1 / 240) - f(t - 1 / 240)) * 120;

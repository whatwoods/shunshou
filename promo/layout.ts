// 各场景的版式：坐标都是 1440×810 舞台上的 CSS 像素，尺寸照着网站在 1440 宽窗口里的样子量出来
import { rect, type Rect } from './lib/anim';
import { CATEGORIES, TOOLS, type CatId } from '../src/tools';

export const W = 1440,
  H = 810;

// ———— 标志：暖橙底 + 四个圆角方块，左上那块亮着、带绿灯（和 LogoMark 同一套比例）————
export function logoParts(cx: number, cy: number, size: number) {
  const u = size / 64,
    x0 = cx - size / 2,
    y0 = cy - size / 2;
  const sq = (ux: number, uy: number) => rect(x0 + ux * u, y0 + uy * u, 16.5 * u, 16.5 * u);
  return {
    base: rect(x0, y0, size, size),
    r: 15 * u,
    // 左上、右上、左下、右下
    sq: [sq(14, 14), sq(33.5, 14), sq(14, 33.5), sq(33.5, 33.5)],
    sr: 5 * u,
    led: { x: x0 + 25.4 * u, y: y0 + 19.1 * u, d: 5 * u }
  };
}
export const LOGO = logoParts(720, 405, 150);
export const LOGO_END = logoParts(720, 300, 150);

// ———— 首页大卡片 ————
export const HERO_Y = 300;
export const CARD = rect(200, HERO_Y, 1040, 336);
export const CARD_R = 30;
// 六个键帽：PDF、图片、视频、表格、JSON、文本
export const HERO_KINDS = ['pdf', 'image', 'video', 'sheet', 'json', 'text'] as const;
export const HERO_LEDS = ['#F0442E', '#22B35E', '#8B5CF6', '#14A39A', '#3B82F6', '#F5A524'];
export const heroKey = (i: number) => rect(522 + i * 68, HERO_Y + 44, 56, 56);
export const H1_Y = HERO_Y - 113;
export const SUB_Y = HERO_Y - 54;
export const CARD_TITLE_Y = HERO_Y + 146;
export const CARD_SUB_Y = HERO_Y + 186;
export const CTA_Y = HERO_Y + 242;
export const NOTE_Y = HERO_Y + 289;
export const PICK_BTN = rect(605, CTA_Y - 22, 104, 44);

// 收到文件以后的卡片（三张照片：上面一行文件标签，“做成一份 PDF”的推荐，再是图片能用的工具）
export const RES_Y = 135;
export const RESULT = rect(200, RES_Y, 1040, 539);
export const FILES = [
  { name: 'IMG_2048.HEIC', size: 3.2, out: 'IMG_2048.avif' },
  { name: 'IMG_2051.HEIC', size: 2.8, out: 'IMG_2051.avif' },
  { name: 'IMG_2077.HEIC', size: 3.1, out: 'IMG_2077.avif' }
];
export const chipRect = (i: number) => rect(230 + i * 201, RES_Y + 101, 193, 32);
export const COMBO = rect(230, RES_Y + 147, 980, 64);
export const GROUP = rect(230, RES_Y + 223, 980, 252);
export const MATCH = ['image-compress', 'image-convert', 'image-resize', 'image-crop'];
export const matchRow = (j: number) => rect(236, RES_Y + 258 + j * 44, 968, 44);
export const matchGlyph = (j: number) => rect(246, RES_Y + 265 + j * 44, 30, 30);

// ———— 工具页 ————
export const NAV = rect(355, 12, 730, 52);
export const NAV_CATS: { id: CatId | 'all'; name: string; led: string; w: number }[] = [
  { id: 'all', name: '全部', led: '#C2410C', w: 69 },
  ...CATEGORIES.map((c) => ({ id: c.id, name: c.name, led: c.led, w: [97, 69, 69, 83, 97, 69][CATEGORIES.indexOf(c)] }))
];
// 分类按钮在导航里的位置（品牌占 79）
export const navCat = (i: number) => {
  let x = NAV.x + 6 + 79;
  for (let k = 0; k < i; k++) x += NAV_CATS[k].w;
  return rect(x, NAV.y + 7, NAV_CATS[i].w, 38);
};
export const PAGE_X = 112;
export const CRUMB_Y = 96;
export const TITLE_Y = 130;
export const TSUB_Y = 170;
export const PREVIEW = rect(112, 204, 832, 500);
export const TOOLBAR = rect(248, 624, 560, 60);
// 工具栏里：分段（原格式、WebP、AVIF、JPEG）、画质滑块
export const SEG_X = [11, 81, 147, 203];
export const SEG_W = [70, 66, 56, 58];
export const SLIDER = { x: TOOLBAR.x + 318, w: 194, y: TOOLBAR.y + 30 };
export const sliderKnobX = (f: number) => SLIDER.x + 19 + (SLIDER.w - 38) * f;
export const SIDE_X = 968;
export const SIDE_W = 360;
export const fileRow = (i: number) => rect(974, 236 + i * 60, 348, 60);
export const OPTIONS = rect(968, 488, 360, 104);
export const NEXT_Y = 762;
export const NEXT = [
  { id: 'image-convert', name: '格式转换', w: 110 },
  { id: 'image-resize', name: '尺寸调整', w: 110 },
  { id: 'image-crop', name: '裁剪', w: 82 },
  { id: 'image-cutout', name: '抠图', w: 82 },
  { id: 'pdf-from-image', name: '图片转 PDF', w: 126 }
];
export const nextChip = (i: number) => {
  let x = 160;
  for (let k = 0; k < i; k++) x += NEXT[k].w + 10;
  return rect(x, NEXT_Y - 19, NEXT[i].w, 38);
};

// 图片转 PDF：三页纸
export const PAGE = { w: 172, h: 243 };
export const pageSlot = (i: number) => rect(136 + i * 196, 270, PAGE.w, PAGE.h);
export const pagePhoto = (r: Rect) => rect(r.x, r.y + (r.h - r.w * 0.75) / 2, r.w, r.w * 0.75);
export const ACTION = rect(463, 736, 514, 56);

// ———— ⌘K（和网站 .palette 同一套尺寸：头 64，正文上下留 8，分组标题 24，每行 54，动作行 44，底栏 44） ————
export const PAL = rect(400, 100, 640, 480);
export const palRowY = (j: number) => PAL.y + 102 + j * 54;
export const palGlyph = (j: number) => rect(PAL.x + 22, palRowY(j) + 10, 34, 34);
// 两颗大键帽 ⌘ K
export const CMD_KEYS = [rect(598, 349, 112, 112), rect(730, 349, 112, 112)];

// ———— 工具墙：一行一个分类 ————
export const READY = TOOLS.filter((t) => t.ready);
// 左边 200 宽放分类名，右边最多 12 个键帽；整块在舞台上居中
export const WALL = { x: 431, y: 250, key: 52, pitch: 66, row: 74, label: 200 };
export const wallKey = (id: string): Rect => {
  const t = READY.find((x) => x.id === id)!;
  const r = CATEGORIES.findIndex((c) => c.id === t.cat);
  const c = READY.filter((x) => x.cat === t.cat).indexOf(t);
  return rect(WALL.x + c * WALL.pitch, WALL.y + r * WALL.row, WALL.key, WALL.key);
};

// ———— 隐私：浏览器窗口里 11×5 的小键帽 ————
export const WIN = rect(760, 165, 560, 440);
export const winIndex = (id: string) => READY.findIndex((x) => x.id === id);
export const winKey = (i: number) => rect(803 + (i % 11) * 44, 255 + Math.floor(i / 11) * 44, 34, 34);

// ———— 手机：网站手机首页的原生尺寸（390×844），缩小 0.8 放进来 ————
export const PHONE_K = 0.8;
export const SCREEN = rect(844, 67.4, 390 * PHONE_K, 844 * PHONE_K);
export const BEZEL = 9;
export const ptoW = (r: Rect): Rect => rect(SCREEN.x + r.x * PHONE_K, SCREEN.y + r.y * PHONE_K, r.w * PHONE_K, r.h * PHONE_K);
export const M_TOP = 50;
export const mCat = (i: number) => rect(16 + (i % 2) * 185, M_TOP + 280 + Math.floor(i / 2) * 100, 173, 88);
export const PHONE = inflateRect(SCREEN, BEZEL);
export const SCREEN_R = 38;
// 灵动岛（手机坐标）
export const ISLAND = rect(390 / 2 - 62, 11, 124, 36);
function inflateRect(r: Rect, d: number) {
  return rect(r.x - d, r.y - d, r.w + 2 * d, r.h + 2 * d);
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Glass } from './Glass';

// iOS 26 液态玻璃控件的拖动动效：手机标签栏、分段控件、开关、滑块共用这一套。
// 选中块平时是控件里一块实心的小胶囊（thumb，压在文字下面）；一按下去它就浮起来，变成一块更大的玻璃透镜（lens），
// 透过它能看到被放大的文字和图标。透镜跟着手指走，走得快会被拉长压扁；松手吸到最近的一格，冲过头一点再弹回来，
// 同时缩回实心胶囊。点另一格也一样：透镜浮起来滑过去再落下。键盘切换只滑实心胶囊，不浮起来。
// 透镜挂在 body 上，不放在控件里：祖先里只要有一块玻璃（backdrop-filter），透镜就只读得到那块玻璃里面的东西，
// 半透明的底色还会叠出重影；祖先 overflow: hidden 也会把浮出来的部分裁掉

export interface Slot {
  // 中心点和尺寸，相对容器的内边距盒（和 offsetLeft / offsetTop 同一个坐标）
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Mode = 'jump' | 'slide' | 'travel';

export const slotOf = (el: HTMLElement): Slot => ({
  x: el.offsetLeft + el.offsetWidth / 2,
  y: el.offsetTop + el.offsetHeight / 2,
  w: el.offsetWidth,
  h: el.offsetHeight
});

// 开关的两格：iOS 27 式的横向椭圆钮，贴着轨道内侧 2px，宽是高的 1.58 倍（28px 高的轨道里是 38×24）；左边是关，右边是开
const OVAL = 1.58;
export function switchSlots(track: HTMLElement): Slot[] {
  const W = track.clientWidth,
    H = track.clientHeight,
    kh = H - 4,
    kw = Math.round(kh * OVAL);
  return [
    { x: 2 + kw / 2, y: H / 2, w: kw, h: kh },
    { x: W - 2 - kw / 2, y: H / 2, w: kw, h: kh }
  ];
}

const media = (q: string) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;
const still = () => media('(prefers-reduced-motion: reduce)');
// 减弱透明度时玻璃是实心的，浮起来会把底下的字盖住，只留滑动
const lensOK = () => !still() && !media('(prefers-reduced-transparency: reduce)');
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// 拖过头时的橡皮筋：越往外拉越拉不动，最多十几像素
const rub = (d: number) => (d * 0.3) / (1 + d / 60);
const band = (v: number, lo: number, hi: number) => (v < lo ? lo - rub(lo - v) : v > hi ? hi + rub(v - hi) : v);

// 阻尼弹簧（k 刚度，z 阻尼比）
class Spring {
  v = 0;
  t: number;
  constructor(
    public x: number,
    public k: number,
    public z: number
  ) {
    this.t = x;
  }
  tune([k, z]: readonly [number, number]) {
    this.k = k;
    this.z = z;
  }
  step(dt: number) {
    const a = this.k * (this.t - this.x) - 2 * this.z * Math.sqrt(this.k) * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }
  settled(eps: number) {
    return Math.abs(this.t - this.x) < eps && Math.abs(this.v) < eps * 20;
  }
  set(x: number) {
    this.x = this.t = x;
    this.v = 0;
  }
}

// 跟手：紧，几乎不晃；松手吸附：冲过头一点再回来；键盘、外部改值：稍软，不怎么晃
const FOLLOW = [1300, 0.82] as const;
const SNAP = [520, 0.58] as const;
const SLIDE = [420, 0.8] as const;
const RISE = [700, 0.72] as const;
const DROP = [380, 0.6] as const;

export interface GlideLook {
  grow: readonly [number, number]; // 浮起来以后横竖各放大多少
  magnify: number; // 透镜中间的放大倍数 - 1
}

export class Glide {
  box: HTMLElement | null = null; // 坐标原点
  thumb: HTMLElement | null = null; // 实心胶囊
  fill: HTMLElement | null = null; // 滑块已填充的那段，跟着圆钮走
  lens: HTMLElement | null = null;
  showLens: (on: boolean) => void = () => {};
  onNear?: (i: number) => void; // 拖动时离透镜最近的一格（标签栏用来给图标上色），-1 = 没在拖
  onLift?: (up: boolean) => void; // 浮起来、落回去（没有实心胶囊元素的控件用来藏自己的圆钮）

  private x = new Spring(0, ...SLIDE);
  private y = new Spring(0, ...SLIDE);
  private w = new Spring(0, ...SLIDE);
  private h = new Spring(0, ...SLIDE);
  private lift = new Spring(0, ...RISE);
  private placed = false;
  private hidden = false;
  private travel = false;
  private lensOn = false;
  private up = false;
  private base = { w: 0, h: 0, r: 0 };
  private slots: Slot[] = [];
  private pointer = -1;
  private held = false;
  private start = { x: 0, y: 0 };
  private moved = false;
  private near = -1;
  private released = -1e9;
  private raf = 0;
  private last = 0;

  constructor(public look: GlideLook) {}

  // 选中的那一格变了（值变了、尺寸变了）
  place(s: Slot | null, mode: Mode) {
    if (!s) {
      this.hidden = true;
      this.paint();
      return;
    }
    if (this.pointer >= 0) return; // 正拖着，听手指的
    const same =
      this.placed && !this.hidden && [this.x.t - s.x, this.y.t - s.y, this.w.t - s.w, this.h.t - s.h].every((d) => Math.abs(d) < 0.5);
    if (same) return;
    if (!this.placed || this.hidden || mode === 'jump' || still()) {
      this.placed = true;
      this.hidden = false;
      this.x.set(s.x);
      this.y.set(s.y);
      this.w.set(s.w);
      this.h.set(s.h);
      if (!this.raf) this.paint();
      return;
    }
    this.tune(this.held ? FOLLOW : mode === 'travel' ? SNAP : SLIDE);
    this.aimAt(s);
    if (mode === 'travel' && !this.held && lensOK()) {
      this.travel = true;
      this.rise();
    }
    this.run();
  }

  // 按下：浮起来，透镜奔向手指
  down(e: PointerEvent, slots: Slot[]): boolean {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || this.pointer >= 0 || !this.box || !slots.length) return false;
    this.slots = slots;
    this.pointer = e.pointerId;
    try {
      this.box.setPointerCapture(e.pointerId);
    } catch {
      /* 有的元素（比如已经移出文档的）拿不到捕获，照样能用 */
    }
    this.start = { x: e.clientX, y: e.clientY };
    this.moved = false;
    this.travel = false;
    if (lensOK()) this.rise();
    this.tune(FOLLOW);
    this.aim(e);
    this.run();
    return true;
  }

  move(e: PointerEvent) {
    if (e.pointerId !== this.pointer) return;
    if (!this.moved && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 4) this.moved = true;
    this.aim(e);
    this.run();
  }

  // 松手：吸到 pick 选出的那一格（默认是离手指最近的）
  release(e: PointerEvent, pick: (nearest: number, moved: boolean) => number = (i) => i) {
    if (e.pointerId !== this.pointer) return null;
    this.pointer = -1;
    const index = pick(this.nearest(this.x.t, this.y.t), this.moved);
    this.settle(index);
    this.released = performance.now();
    return { index, moved: this.moved };
  }

  // 被打断（浏览器接手去滚动了）：回到原来那一格
  cancel(index: number, pointerId?: number) {
    if (this.pointer < 0 || (pointerId !== undefined && pointerId !== this.pointer)) return;
    this.pointer = -1;
    this.settle(index);
  }

  // 刚松手跟着来的那次 click 不要再处理一遍；只拦一次，之后马上再点照常处理
  justReleased() {
    const hit = performance.now() - this.released < 400;
    this.released = -1e9;
    return hit;
  }

  // 滑块：拖动由原生 input 处理，这里只管浮起来、落回去，值变化时用 place 跟上
  hold(on: boolean) {
    if (on === this.held) return;
    this.held = on;
    if (on && lensOK()) {
      this.rise();
      this.run();
    } else if (!on) {
      this.tune(SNAP);
      this.drop();
      this.run();
    }
  }

  // 透镜的弯曲带比普通玻璃窄得多：中间要留出一大片平的地方，透过去的字和图标只是放大，不被扭曲
  get bezel() {
    return Math.max(5, Math.round(Math.min(this.base.w, this.base.h) * 0.2));
  }

  setLens = (el: HTMLElement | null) => {
    this.lens = el;
    if (!el) return;
    el.style.width = `${this.base.w}px`;
    el.style.height = `${this.base.h}px`;
    el.style.borderRadius = `${this.base.r}px`;
    this.paint();
  };

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tune(p: readonly [number, number]) {
    for (const s of [this.x, this.y, this.w, this.h]) s.tune(p);
  }

  private aimAt(s: Slot) {
    this.x.t = s.x;
    this.y.t = s.y;
    this.w.t = s.w;
    this.h.t = s.h;
  }

  private aim(e: PointerEvent) {
    const b = this.box!;
    const r = b.getBoundingClientRect();
    const xs = this.slots.map((s) => s.x),
      ys = this.slots.map((s) => s.y);
    const px = band(e.clientX - r.left - b.clientLeft, Math.min(...xs), Math.max(...xs));
    const py = band(e.clientY - r.top - b.clientTop, Math.min(...ys), Math.max(...ys));
    const i = this.nearest(px, py);
    const s = this.slots[i];
    if (still()) {
      // 不要动效：直接跟着手指
      this.x.set(px);
      this.y.set(py);
      this.w.set(s.w);
      this.h.set(s.h);
    } else {
      this.x.t = px;
      this.y.t = py;
      this.w.t = s.w;
      this.h.t = s.h;
    }
    if (i !== this.near) {
      this.near = i;
      this.onNear?.(i);
    }
  }

  private nearest(px: number, py: number) {
    let best = 0,
      d = Infinity;
    this.slots.forEach((s, i) => {
      const dd = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
    return best;
  }

  private settle(index: number) {
    const s = this.slots[index];
    if (s) {
      this.tune(SNAP);
      if (still()) {
        this.x.set(s.x);
        this.y.set(s.y);
        this.w.set(s.w);
        this.h.set(s.h);
      } else this.aimAt(s);
    }
    this.drop();
    if (this.near !== -1) {
      this.near = -1;
      this.onNear?.(-1);
    }
    this.run();
  }

  private rise() {
    if (!this.lensOn) {
      // 透镜按浮起来以后的样子定尺寸，圆角照实心胶囊等比放大；拖动途中尺寸变化都用 scale，不重新生成位移图
      const [gx, gy] = this.look.grow;
      const r = this.thumb ? parseFloat(getComputedStyle(this.thumb).borderTopLeftRadius) || 0 : 999;
      this.base = {
        w: Math.round((this.w.t || this.w.x) * gx),
        h: Math.round((this.h.t || this.h.x) * gy),
        r: Math.min(999, r * gy)
      };
      this.lensOn = true;
      this.showLens(true);
    }
    this.lift.tune(RISE);
    this.lift.t = 1;
  }

  private drop() {
    this.travel = false;
    this.lift.tune(DROP);
    this.lift.t = 0;
  }

  private run() {
    if (this.raf) return;
    if (typeof requestAnimationFrame === 'undefined') {
      for (const s of [this.x, this.y, this.w, this.h, this.lift]) s.set(s.t);
      this.paint();
      return;
    }
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const n = Math.max(1, Math.ceil(dt * 240));
      const springs = [this.x, this.y, this.w, this.h, this.lift];
      for (let i = 0; i < n; i++) for (const s of springs) s.step(dt / n);
      // 点另一格：透镜滑到离目标不远时开始落下
      if (this.travel && Math.hypot(this.x.t - this.x.x, this.y.t - this.y.x) < Math.max(this.w.t, this.h.t) * 0.3) this.drop();
      const done = this.pointer < 0 && !this.held && !this.travel && springs.every((s) => s.settled(s === this.lift ? 0.004 : 0.25));
      if (done) {
        this.raf = 0;
        for (const s of springs) s.set(s.t);
        if (this.lensOn) {
          this.lensOn = false;
          this.showLens(false);
        }
      } else this.raf = requestAnimationFrame(tick);
      this.paint();
    };
    this.raf = requestAnimationFrame(tick);
  }

  private paint() {
    const { x, y, w, h } = this;
    const lv = this.lensOn ? this.lift.x : 0;
    const up = lv > 0.3;
    if (up !== this.up) {
      this.up = up;
      this.onLift?.(up);
    }
    const t = this.thumb;
    if (t) {
      t.style.visibility = this.hidden ? 'hidden' : '';
      t.style.width = `${w.x}px`;
      t.style.height = `${h.x}px`;
      t.style.transform = `translate(${x.x - w.x / 2}px, ${y.x - h.x / 2}px)`;
      t.style.opacity = this.lensOn ? String(1 - clamp01(lv / 0.3)) : '';
    }
    if (this.fill) this.fill.style.width = `${x.x}px`;
    const L = this.lens,
      b = this.box;
    if (!L || !b || !this.base.w) return;
    const r = b.getBoundingClientRect();
    const [gx, gy] = this.look.grow;
    // 走得快会被拉长、压扁，体积大致不变
    const sx = Math.min(0.22, Math.abs(x.v) / 4000),
      sy = Math.min(0.22, Math.abs(y.v) / 4000);
    const kx = (w.x / this.base.w) * (1 + (gx - 1) * lv) * (1 + sx - sy * 0.5);
    const ky = (h.x / this.base.h) * (1 + (gy - 1) * lv) * (1 + sy - sx * 0.5);
    const left = r.left + b.clientLeft + x.x - this.base.w / 2,
      top = r.top + b.clientTop + y.x - this.base.h / 2;
    L.style.transform = `translate(${left.toFixed(2)}px, ${top.toFixed(2)}px) scale(${kx.toFixed(4)}, ${ky.toFixed(4)})`;
    L.style.opacity = String(clamp01(lv / 0.35));
  }
}

export function useGlide(look: GlideLook) {
  const ref = useRef<Glide | null>(null);
  const g = (ref.current ??= new Glide(look));
  const [lens, setLens] = useState(false);
  g.showLens = setLens;
  useEffect(() => () => g.stop(), [g]);
  return [g, lens] as const;
}

// 透镜本身：只在按住和回落的那一小会儿挂到 body 上
export function Lens({ glide, on }: { glide: Glide; on: boolean }) {
  if (!on || typeof document === 'undefined') return null;
  return createPortal(
    <Glass
      as="span"
      kind="clear"
      className="lens"
      aria-hidden="true"
      ref={glide.setLens}
      pressed={false}
      magnify={glide.look.magnify}
      bezel={glide.bezel}
      thick={Math.round(glide.bezel * 1.1)}
      disperse={0.04}
      saturate={115}
      blur={0}
      fallbackBlur={0}
    />,
    document.body
  );
}

// 工具页里画成开关样子的原生复选框（.tool-main input[type=checkbox]:not(.native)，二十几处）也有同样的透镜：
// 在整个页面上监听，按到这种复选框上就接管；拖完由这里决定开还是关，浏览器随后补发的那次 click 拦掉
const CHECK = '.tool-main input[type="checkbox"]:not(.native)';
const CHECK_LOOK: GlideLook = { grow: [1.45, 1.5], magnify: 0.08 };

export function CheckLens() {
  const [g, lens] = useGlide(CHECK_LOOK);
  useEffect(() => {
    let el: HTMLInputElement | null = null;
    let guard: { el: HTMLInputElement; until: number } | null = null;
    let pass = false;
    g.onLift = (up) => el?.classList.toggle('is-lifted', up);
    const down = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !t.matches(CHECK) || t.matches(':disabled')) return;
      if (el && el !== t) el.classList.remove('is-lifted');
      el = t;
      g.box = t;
      g.thumb = null;
      const s = switchSlots(t);
      g.place(s[t.checked ? 1 : 0], 'jump');
      g.down(e, s);
    };
    const move = (e: PointerEvent) => g.move(e);
    const up = (e: PointerEvent) => {
      const t = el;
      if (!t) return;
      const r = g.release(e, (i, moved) => (moved ? i : t.checked ? 0 : 1));
      if (!r) return;
      guard = { el: t, until: performance.now() + 600 };
      if ((r.index === 1) !== t.checked) {
        pass = true;
        t.click();
        pass = false;
      }
    };
    const cancel = (e: PointerEvent) => {
      if (el) g.cancel(el.checked ? 1 : 0, e.pointerId);
    };
    const click = (e: MouseEvent) => {
      if (pass || !guard || e.target !== guard.el) return;
      if (performance.now() < guard.until) {
        // 在捕获阶段拦住：React 收不到这次 click，复选框也不会再翻一次
        e.preventDefault();
        e.stopPropagation();
      }
      guard = null;
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('click', click, true);
    };
  }, [g]);
  return <Lens glide={g} on={lens} />;
}

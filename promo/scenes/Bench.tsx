// 第二幕：点“图片压缩”，那一行变成工具页的预览区；调格式、拖画质、拖对比线；处理完“接着用”图片转 PDF，
// 照片缩进一页纸、排序、合成一份。导航、标题、侧栏、底部玻璃条都在原地变形，不切镜头
import type { CSSProperties, ReactNode } from 'react';
import { E, clamp, fmtBytes, inflate, kf, lerp, mixColor, mixRect, prog, rect, sp, spring, tw, type Rect } from '../lib/anim';
import { Led, MorphGlass, Photo, ToolGlyph, at, pose, rise } from '../lib/kit';
import { GlideLens } from '../lib/lens';
import { KindIcon } from '../../src/components/ToolIcon';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  DownloadIcon,
  LogoMark,
  PlusIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  SwapIcon
} from '../../src/components/ui';
import {
  ACTION,
  FILES,
  NAV,
  NAV_CATS,
  NEXT,
  OPTIONS,
  PAGE_X,
  PREVIEW,
  RES_Y,
  SEG_W,
  SEG_X,
  SIDE_X,
  SLIDER,
  TITLE_Y,
  TOOLBAR,
  TSUB_Y,
  CRUMB_Y,
  fileRow,
  matchRow,
  navCat,
  nextChip,
  pagePhoto,
  pageSlot,
  sliderKnobX
} from '../layout';
import { PAGE_DRAG, PAL_OUT, SLIDER_DRAG, SPLIT_DRAG, T, cursorAt, vel } from '../timeline';

const B = T.bench;
const P = T.pdf;
const GREEN = '#22B35E';
const BLUE = '#3D6BE6';
const ACCENT = '#C2410C';
const MB = 1024 * 1024;

// 照片在预览区里按原比例（4:3）居中
const IMG = rect(PREVIEW.x + (PREVIEW.w - (PREVIEW.h * 4) / 3) / 2, PREVIEW.y, (PREVIEW.h * 4) / 3, PREVIEW.h);

// ———— 压缩任务：每改一次设置，三张图依次重压 ————
const RUNS = [
  { start: B + 0.95, d: 0.22, fmt: 'WebP', q: 80, kb: [412, 371, 430] },
  { start: 13.4, d: 0.18, fmt: 'AVIF', q: 80, kb: [338, 297, 352] },
  { start: 15.3, d: 0.2, fmt: 'AVIF', q: 60, kb: [286, 251, 302] }
];
function fileState(i: number, t: number) {
  let run = -1;
  RUNS.forEach((r, k) => {
    if (t >= r.start) run = k;
  });
  if (run < 0) return { status: 'wait' as const, run, size: 0 };
  const r = RUNS[run];
  const done = t >= r.start + (i + 1) * r.d;
  return { status: done ? ('done' as const) : ('work' as const), run, size: r.kb[i] * 1024 };
}
const ORIG = FILES.map((f) => f.size * MB);
const pct = (a: number, b: number) => `−${Math.round((1 - b / a) * 100)}%`;
function totals(t: number) {
  const st = FILES.map((_, i) => fileState(i, t));
  const done = st.filter((s) => s.status === 'done').length;
  const all = done === 3;
  const after = st.reduce((n, s) => n + s.size, 0);
  const before = ORIG.reduce((n, s) => n + s, 0);
  return { st, done, all, after, before };
}

// ⌘K 面板散开、工具墙出现时，整页退场
const pageOut = (t: number) => tw(t, PAL_OUT, PAL_OUT + 0.45, E.inOut2);
const toPdf = (t: number) => tw(t, P + 0.1, P + 0.45, E.inOut2);

// ———— 顶部的分类导航（液态玻璃），选中块从“图像”滑到“PDF” ————
const navSel = (t: number) => {
  const a = navCat(3),
    b = navCat(2);
  const s = { w: 11, z: 0.62 };
  return { x: sp(t, a.x, [[P + 0.08, b.x, s]]), w: sp(t, a.w, [[P + 0.08, b.w, s]]) };
};
function Nav({ t }: { t: number }) {
  const v = rise(t, B + 0.45, 0.7, -16);
  const sel = navSel(t);
  const lift = sp(t, 0, [[P + 0.05, 1, { w: 16, z: 0.75 }], [P + 0.36, 0, { w: 11, z: 0.6 }]]);
  const pick = t < P + 0.2 ? 3 : 2;
  return (
    <>
      <MorphGlass w={NAV.w} h={NAV.h} r={26} style={{ ...pose(NAV, { o: v.o, z: 40 }), transform: `translate(${NAV.x}px, ${NAV.y + v.y}px)` }}>
        <span style={{ position: 'absolute', left: 14, top: 13, width: 26, height: 26, display: 'flex', borderRadius: 7, boxShadow: '0 1px 2px rgba(190,70,20,0.3)' }}>
          <LogoMark />
        </span>
        <b style={{ position: 'absolute', left: 48, top: 0, lineHeight: '52px', fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}>顺手</b>
        <span
          style={{
            position: 'absolute',
            left: sel.x - NAV.x,
            top: 7,
            width: sel.w,
            height: 38,
            borderRadius: 999,
            background: 'var(--seg-on)',
            boxShadow: 'var(--seg-on-shadow)',
            opacity: 1 - clamp(lift / 0.3)
          }}
        />
        {NAV_CATS.map((c, i) => {
          const r = navCat(i);
          return (
            <span
              key={c.id}
              style={{
                position: 'absolute',
                left: r.x - NAV.x,
                top: 7,
                width: r.w,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 14,
                fontWeight: i === pick ? 600 : 400
              }}
            >
              <Led color={c.led} size={6} glow={0} />
              {c.name}
            </span>
          );
        })}
        <span style={{ position: 'absolute', left: 642, top: 17, width: 0.5, height: 18, background: 'var(--divider)' }} />
        <span style={{ position: 'absolute', left: 647, top: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SearchIcon />
        </span>
        <span style={{ position: 'absolute', left: 683, top: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SunIcon />
        </span>
      </MorphGlass>
      <GlideLens x={sel.x + sel.w / 2} y={NAV.y + 26} w={sel.w} h={38} lift={lift} vx={vel((u) => navSel(u).x, t)} />
    </>
  );
}

// ———— 面包屑、标题、副标题、右上角按钮 ————
function swap(t: number, at0: number, a: ReactNode, b: ReactNode, x: number, y: number, style: CSSProperties, v: { o: number; y: number; blur: number }) {
  // 旧的先走（0.25 秒），新的晚一点进来，两行不会糊在一起
  const q = tw(t, at0, at0 + 0.25, E.in2);
  const s = tw(t, at0 + 0.12, at0 + 0.5, E.out3);
  return (
    <>
      {q < 1 && (
        <div style={{ ...at(x, y + v.y - 8 * q, { o: v.o * (1 - q), blur: v.blur + 4 * q }), ...style }}>{a}</div>
      )}
      {s > 0 && <div style={{ ...at(x, y + 10 * (1 - s), { o: s, blur: 4 * (1 - s) }), ...style }}>{b}</div>}
    </>
  );
}
function Head({ t }: { t: number }) {
  const crumb = rise(t, B + 0.5, 0.6);
  const sub = rise(t, B + 0.6, 0.6);
  const star = rise(t, B + 0.75, 0.6);
  // “图片压缩”四个字从被点的那一行飞上来，变成大标题
  const f = spring(t - (B + 0.02), { w: 7.5, z: 0.9 });
  const tx = lerp(288, PAGE_X, f),
    ty = lerp(RES_Y + 280, TITLE_Y, f);
  const s = lerp(15 / 40, 1, f);
  const sw = tw(t, P + 0.24, P + 0.62, E.out3);
  const swOut = tw(t, P + 0.12, P + 0.37, E.in2);
  const tot = totals(t);
  const acts = rise(t, B + 1.65, 0.6) ;
  const actsOut = tw(t, P, P + 0.25, E.out2);
  const crumbStyle: CSSProperties = { fontSize: 15, color: 'var(--accent)', display: 'flex', gap: 4 };
  return (
    <>
      {swap(
        t,
        P + 0.1,
        <>
          图像<span style={{ color: 'var(--ink-3)' }}>›</span>
        </>,
        <>
          PDF<span style={{ color: 'var(--ink-3)' }}>›</span>
        </>,
        PAGE_X,
        CRUMB_Y,
        crumbStyle,
        crumb
      )}
      <div style={{ ...at(tx, ty - 8 * swOut, { s, o: 1 - swOut, blur: 4 * swOut }), fontSize: 40, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1 }}>图片压缩</div>
      {sw > 0 && (
        <div style={{ ...at(PAGE_X, TITLE_Y + 10 * (1 - sw), { o: sw, blur: 4 * (1 - sw) }), fontSize: 40, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
          图片转 PDF
        </div>
      )}
      <span style={{ ...at(lerp(293, 336, sw), TITLE_Y + star.y, { anchor: 'center', o: star.o }), display: 'flex', color: 'var(--ink-2)' }}>
        <StarIcon size={18} />
      </span>
      {swap(
        t,
        P + 0.16,
        <>
          3 张图片，都在这台设备上处理。
          <UploadLed />
        </>,
        <>
          多张图片合成一份 PDF。
          <UploadLed />
        </>,
        PAGE_X,
        TSUB_Y,
        { fontSize: 17, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 10 },
        sub
      )}
      {tot.done > 0 && (
        <div style={{ ...at(1328, TITLE_Y + acts.y, { anchor: 'right', o: acts.o * (1 - actsOut) }), display: 'flex', gap: 10 }}>
          <span className="btn-soft">
            <PlusIcon size={16} />
            添加图片
          </span>
          <span className="btn">
            <DownloadIcon size={16} />
            全部下载（{fmtBytes(tot.after)}）<span className="key-hint">⌘S</span>
          </span>
        </div>
      )}
    </>
  );
}
function UploadLed() {
  return (
    <span className="upload-led">
      <Led color={GREEN} size={6} glow={0.8} />0 B 上传
    </span>
  );
}

// ———— 预览区：从被点的那一行长出来 ————
function Panel({ t }: { t: number }) {
  const p = spring(t - (B + 0.02), { w: 7.5, z: 0.88 });
  const r = mixRect(matchRow(0), PREVIEW, p);
  const lp = clamp(p);
  const photo = tw(t, B + 0.12, B + 0.5, E.inOut2);
  const pdf = toPdf(t);
  const bg = mixColor('#F2F1EE', '#DAD8D3', lp);
  return (
    <div style={{ ...pose(r), borderRadius: lerp(12, 26, lp), overflow: 'hidden', background: pdf > 0 ? mixColor('#DAD8D3', '#FFFFFF', pdf) : bg, isolation: 'isolate' }}>
      <span style={{ position: 'absolute', inset: -60, opacity: 0.6 * photo * (1 - pdf), filter: 'blur(40px) saturate(1.1)' }}>
        <Photo />
      </span>
      {/* 被选中的那张照片：转 PDF 时交给第一页 */}
      {t < P + 0.15 && (
        <span
          style={{ position: 'absolute', inset: 0, opacity: photo }}
        >
          <ContainPhoto />
        </span>
      )}
    </div>
  );
}
function ContainPhoto() {
  return (
    <span style={{ position: 'absolute', left: '50%', top: 0, height: '100%', aspectRatio: '4 / 3', transform: 'translateX(-50%)', overflow: 'hidden' }}>
      <Photo />
    </span>
  );
}

// 对比：左原图、右压缩后，中间一条线和一颗玻璃圆钮；两角是玻璃标签
const splitAt = (t: number) => {
  const c = cursorAt(t);
  if (t < SPLIT_DRAG.down) return 0.5;
  const x = t > SPLIT_DRAG.up ? cursorAt(SPLIT_DRAG.up).x : c.x;
  return clamp((x - IMG.x) / IMG.w, 0.03, 0.97);
};
function Compare({ t }: { t: number }) {
  const pill = rise(t, B + 0.9, 0.6, 8);
  const out = Math.max(toPdf(t) * 1.4, 0);
  if (pill.o <= 0 || out >= 1) return null;
  const tot = totals(t);
  const s0 = tot.st[0];
  const run = s0.run >= 0 ? RUNS[s0.run] : RUNS[0];
  const line = clamp(prog(t, B + 1.25, B + 1.6)) * (1 - out);
  const split = splitAt(t);
  const lx = IMG.x + split * IMG.w;
  const grab = kf(t, [
    [SPLIT_DRAG.down, 0],
    [SPLIT_DRAG.down + 0.12, 1],
    [SPLIT_DRAG.up, 1],
    [SPLIT_DRAG.up + 0.3, 0, E.out3]
  ]);
  const o = pill.o * (1 - out);
  return (
    <>
      <span className="p-line" style={{ left: lx, top: PREVIEW.y, bottom: 'auto', height: PREVIEW.h, opacity: line, zIndex: 6 }} />
      <MorphGlass
        w={48}
        h={48}
        r={24}
        kind="clear"
        bezel={24}
        thick={20}
        blur={0}
        saturate={140}
        brightness={1.08}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 7,
          transform: `translate(${lx - 24}px, ${PREVIEW.y + PREVIEW.h / 2 - 24}px) scale(${1 + 0.08 * grab})`,
          opacity: line,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ['--lg-tint' as string]: 'rgba(255,255,255,0.1)',
          ['--lg-shadow' as string]: '0 6px 18px rgba(0,0,0,0.25)'
        }}
      >
        <span style={{ display: 'flex', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
          <SwapIcon size={20} />
        </span>
      </MorphGlass>
      <MorphGlass
        w={196}
        h={52}
        r={26}
        kind="clear"
        className="p-pill"
        style={{ position: 'absolute', left: 0, top: 0, zIndex: 8, transform: `translate(${PREVIEW.x + 18}px, ${PREVIEW.y + 18 + pill.y}px)`, opacity: o }}
      >
        <small>原图</small>
        <b>3.2 MB · 4032×3024</b>
      </MorphGlass>
      <MorphGlass
        w={196}
        h={52}
        r={26}
        kind="clear"
        className="p-pill"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 8,
          alignItems: 'flex-end',
          transform: `translate(${PREVIEW.x + PREVIEW.w - 18 - 196}px, ${PREVIEW.y + 18 + pill.y}px)`,
          opacity: o
        }}
      >
        <small>
          {run.fmt} · 画质 {run.q}
        </small>
        {s0.status === 'done' ? (
          <b>
            {fmtBytes(s0.size)} · <span style={{ color: ACCENT }}>{pct(ORIG[0], s0.size)}</span>
          </b>
        ) : (
          <b>正在压缩…</b>
        )}
      </MorphGlass>
    </>
  );
}

// ———— 浮在照片上的工具栏 → 转 PDF 时变成底部的操作条 ————
const quality = (t: number) => {
  if (t < SLIDER_DRAG.down) return 80;
  const x = t > SLIDER_DRAG.up ? SLIDER_DRAG.to : cursorAt(t).x;
  const f = clamp((x - SLIDER.x - 19) / (SLIDER.w - 38));
  return Math.round(10 + f * 90);
};
const knobX = (t: number) => sliderKnobX((quality(t) - 10) / 90);
const segX = (t: number) => sp(t, SEG_X[1], [[13.28, SEG_X[2], { w: 11, z: 0.62 }]]);
const segW = (t: number) => sp(t, SEG_W[1], [[13.28, SEG_W[2], { w: 11, z: 0.62 }]]);

function Bar({ t }: { t: number }) {
  const v = rise(t, B + 0.85, 0.7, 30, 0);
  if (v.o <= 0) return null;
  const m = spring(t - (P + 0.2), { w: 7.5, z: 0.85 });
  const r = mixRect(TOOLBAR, ACTION, m);
  const radius = lerp(30, 28, clamp(m));
  const a = 1 - tw(t, P + 0.12, P + 0.3, E.out2);
  const b = tw(t, P + 0.45, P + 0.75, E.out3);
  const segLift = sp(t, 0, [[13.26, 1, { w: 16, z: 0.75 }], [13.55, 0, { w: 11, z: 0.6 }]]);
  const knobLift = sp(t, 0, [[SLIDER_DRAG.down + 0.01, 1, { w: 16, z: 0.75 }], [SLIDER_DRAG.up + 0.01, 0, { w: 11, z: 0.6 }]]);
  const kx = knobX(t) - TOOLBAR.x;
  const sel = t < 13.3 ? 1 : 2;
  const q = quality(t);
  return (
    <>
      <MorphGlass
        w={r.w}
        h={r.h}
        r={radius}
        blur={1.5}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 30,
          transform: `translate(${r.x.toFixed(2)}px, ${(r.y + v.y).toFixed(2)}px)`,
          opacity: v.o,
          ['--lg-shadow' as string]: 'var(--shadow-float)'
        }}
      >
        {a > 0 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: TOOLBAR.w, height: TOOLBAR.h, opacity: a, fontSize: 13.5 }}>
            <span style={{ position: 'absolute', left: 8, top: 8, width: 256, height: 44, borderRadius: 22, background: 'var(--seg-track)' }} />
            <span
              style={{
                position: 'absolute',
                left: segX(t),
                top: 11,
                width: segW(t),
                height: 38,
                borderRadius: 19,
                background: 'var(--seg-on)',
                boxShadow: 'var(--seg-on-shadow)',
                opacity: 1 - clamp(segLift / 0.3)
              }}
            />
            {['原格式', 'WebP', 'AVIF', 'JPEG'].map((s, i) => (
              <span
                key={s}
                style={{ position: 'absolute', left: SEG_X[i], top: 11, width: SEG_W[i], lineHeight: '38px', textAlign: 'center', fontWeight: i === sel ? 600 : 400 }}
              >
                {s}
              </span>
            ))}
            <span style={{ position: 'absolute', left: 280, top: 0, lineHeight: '60px' }}>画质</span>
            <span style={{ position: 'absolute', left: 318, top: 28, width: 194, height: 4, borderRadius: 2, background: 'var(--slider-track)' }} />
            <span style={{ position: 'absolute', left: 318, top: 28, width: kx - 318, height: 4, borderRadius: 2, background: 'var(--fill)' }} />
            <span
              className="slider-knob"
              style={{ left: kx - 19, top: 18, opacity: 1 - clamp(knobLift / 0.3) }}
            />
            <span style={{ position: 'absolute', right: 20, top: 0, lineHeight: '60px', fontVariantNumeric: 'tabular-nums' }}>{q}</span>
          </div>
        )}
        {b > 0 && <ActionContent t={t} o={b} />}
      </MorphGlass>
      <GlideLens
        x={TOOLBAR.x + segX(t) + segW(t) / 2}
        y={TOOLBAR.y + 30 + v.y}
        w={segW(t)}
        h={38}
        lift={segLift}
        vx={vel(segX, t)}
      />
      <GlideLens x={TOOLBAR.x + kx} y={TOOLBAR.y + 30} w={38} h={24} lift={knobLift} vx={vel(knobX, t)} grow={[1.45, 1.4]} magnify={0.12} />
    </>
  );
}

// 底部操作条：图片转 PDF 的“3 页 · 撤销 · 清空 · 添加 · 开始处理”，处理完变成下载
const MAKE = { click: 22.35, start: 22.45, done: 23.2 };
function ActionContent({ t, o }: { t: number; o: number }) {
  const working = t >= MAKE.start && t < MAKE.done;
  const done = t >= MAKE.done;
  const d = tw(t, MAKE.done, MAKE.done + 0.3, E.inOut2);
  const press = kf(t, [
    [MAKE.click, 0],
    [MAKE.click + 0.07, 1],
    [MAKE.click + 0.18, 0]
  ]);
  const row: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 16px', fontSize: 15 };
  const status: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, paddingRight: 6, fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap' };
  return (
    <>
      <div style={{ ...row, opacity: o * (1 - d) }}>
        <span style={status}>
          {working ? <Led color={BLUE} size={6} glow={0.5 + 0.5 * Math.sin(t * 10)} /> : <Led color="var(--led-idle)" size={6} glow={0} />}
          {working ? '正在生成…' : '3 页 · 839 KB'}
        </span>
        <span className="btn-soft" style={{ opacity: 0.45 }}>
          撤销
        </span>
        <span className="btn-soft">清空</span>
        <span className="btn-soft">
          <PlusIcon size={16} />
          添加
        </span>
        <span className="btn" style={{ transform: `scale(${1 - 0.03 * press})`, filter: press ? `brightness(${1 - 0.06 * press})` : undefined }}>
          开始处理<span className="key-hint">⌘↵</span>
        </span>
      </div>
      {done && (
        <div style={{ ...row, opacity: o * d, justifyContent: 'space-between' }}>
          <span style={status}>
            <Led color={GREEN} size={6} glow={0.8} />
            旅行相册.pdf · 3 页 · 812 KB
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <span className="btn-soft">清空</span>
            <span className="btn">
              <DownloadIcon size={16} />
              下载 PDF<span className="key-hint">⌘S</span>
            </span>
          </span>
        </div>
      )}
    </>
  );
}

// ———— 右侧：文件列表和选项（压缩）→ 输出设置和来源文件（转 PDF） ————
function sideLine(t: number, start: number, out: number) {
  const v = rise(t, start, 0.6, 0, 4);
  const x = (1 - E.soft(prog(t, start, start + 0.6))) * 24 + out * 16;
  return { o: v.o * (1 - out), x, blur: v.blur + out * 3 };
}
function Side({ t }: { t: number }) {
  const out = tw(t, P, P + 0.25, E.in2);
  const tot = totals(t);
  const head = sideLine(t, B + 0.6, out);
  const card = sideLine(t, B + 0.68, out);
  const opt = sideLine(t, B + 0.78, out);
  const text = (x: number, y: number, v: { o: number; x: number; blur: number }, style: CSSProperties, children: ReactNode, anchor: 'left' | 'right' = 'left') => (
    <div style={{ ...at(x + v.x, y, { o: v.o, blur: v.blur, anchor }), ...style }}>{children}</div>
  );
  const box = (r: Rect, v: { o: number; x: number; blur: number }, children?: ReactNode, style?: CSSProperties) => (
    <div style={{ ...pose({ ...r, x: r.x + v.x }, { o: v.o, blur: v.blur }), borderRadius: 20, background: 'var(--surface)', ...style }}>{children}</div>
  );
  if (out >= 1) return <SidePdf t={t} />;
  return (
    <>
      {text(984, 214, head, { fontSize: 13, color: 'var(--ink-2)' }, `文件 · 已完成 ${tot.done} / 3`)}
      {tot.all &&
        text(
          1312,
          214,
          { ...head, o: head.o * tw(t, RUNS[0].start + 0.66, RUNS[0].start + 0.9) },
          { fontSize: 13, color: 'var(--ink-2)' },
          <>
            省下{' '}
            <b style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {fmtBytes(tot.before - tot.after)}（{Math.round((1 - tot.after / tot.before) * 100)}%）
            </b>
          </>,
          'right'
        )}
      {box(rect(SIDE_X, 230, 360, 192), card)}
      {FILES.map((f, i) => {
        const s = tot.st[i];
        const r = fileRow(i);
        const sel = i === 0;
        return (
          <div key={f.name} style={{ ...pose({ ...r, x: r.x + card.x }, { o: card.o, blur: card.blur }), borderRadius: 14, background: sel ? 'var(--accent-tint)' : undefined }}>
            <span style={{ position: 'absolute', left: 10, top: 8, width: 44, height: 44, borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)' }}>
              <Photo variant={i} />
            </span>
            <span style={{ position: 'absolute', left: 66, top: 9, fontSize: 15, fontWeight: sel ? 600 : 400 }}>{f.name}</span>
            {s.status === 'done' ? (
              <span style={{ position: 'absolute', left: 66, top: 33, fontSize: 13, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                {f.size} MB → {fmtBytes(s.size)}
              </span>
            ) : s.status === 'work' ? (
              <span style={{ position: 'absolute', left: 66, top: 39, width: 150, height: 4, borderRadius: 2, background: 'var(--track)', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 2, background: 'var(--fill)', left: `${((t * 1.6) % 1) * 140 - 40}%` }} />
              </span>
            ) : (
              <span style={{ position: 'absolute', left: 66, top: 33, fontSize: 13, color: 'var(--ink-3)' }}>等待中 · {f.size} MB</span>
            )}
            <span style={{ position: 'absolute', right: sel ? 82 : 14, top: 0, height: 60, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              {!sel && s.status === 'done' && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(ORIG[i], s.size)}</span>}
              <Led
                color={s.status === 'done' ? GREEN : s.status === 'work' ? BLUE : 'var(--led-idle)'}
                size={6}
                glow={s.status === 'work' ? 0.6 + 0.4 * Math.sin(t * 12) : s.status === 'done' ? 0.8 : 0}
              />
            </span>
            {sel && (
              <span style={{ position: 'absolute', right: 6, top: 15, display: 'flex', gap: 2, color: 'var(--ink-2)' }}>
                <span style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DownloadIcon size={16} />
                </span>
                <span style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CloseIcon size={16} />
                </span>
              </span>
            )}
          </div>
        );
      })}
      {text(1312, 438, card, { fontSize: 13, color: 'var(--accent)' }, '清空列表', 'right')}
      {text(984, 472, opt, { fontSize: 13, color: 'var(--ink-2)' }, '选项')}
      {box(
        OPTIONS,
        opt,
        <>
          <span style={{ position: 'absolute', left: 16, top: 0, lineHeight: '52px', fontSize: 15 }}>去除 EXIF 信息</span>
          <span style={{ position: 'absolute', right: 16, top: 12, width: 64, height: 28, borderRadius: 999, background: 'var(--switch-on)' }}>
            <span className="switch-knob" style={{ left: 24, top: 2 }} />
          </span>
          <span style={{ position: 'absolute', left: 0, right: 0, top: 52, height: 0.5, background: 'var(--divider)' }} />
          <span style={{ position: 'absolute', left: 16, top: 52, lineHeight: '52px', fontSize: 15 }}>最大宽度</span>
          <span style={{ position: 'absolute', right: 16, top: 52, lineHeight: '52px', fontSize: 15, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            不限
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5l3-3 3 3M2 9l3 3 3-3" />
            </svg>
          </span>
        </>
      )}
      {text(984, 610, opt, { fontSize: 13, color: 'var(--ink-2)' }, '抹掉拍摄地点、相机型号和时间。')}
      <SidePdf t={t} />
    </>
  );
}

// 转 PDF 的侧栏
const ORDER_AT = PAGE_DRAG.up + 0.15;
function SidePdf({ t }: { t: number }) {
  if (t < P + 0.3) return null;
  const a = sideLine(t, P + 0.35, 0),
    b = sideLine(t, P + 0.45, 0),
    c = sideLine(t, P + 0.55, 0);
  const seg = (labels: string[], on: number, r: Rect, ws: number[]) => {
    let x = 3;
    return (
      <span style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 999, background: 'var(--seg-track)', fontSize: 13 }}>
        {labels.map((l, i) => {
          const el = (
            <span
              key={l}
              style={{
                position: 'absolute',
                left: x,
                top: 3,
                width: ws[i],
                height: r.h - 6,
                lineHeight: `${r.h - 6}px`,
                textAlign: 'center',
                borderRadius: 999,
                background: i === on ? 'var(--seg-on)' : undefined,
                boxShadow: i === on ? 'var(--seg-on-shadow)' : undefined,
                fontWeight: i === on ? 600 : 400
              }}
            >
              {l}
            </span>
          );
          x += ws[i];
          return el;
        })}
      </span>
    );
  };
  const reorder = tw(t, ORDER_AT, ORDER_AT + 0.4, E.inOut3);
  const order = [0, 1, 2]; // 第几行（文件序号 → 行）
  const rowY = (i: number) => lerp([0, 1, 2][i], [1, 2, 0][i], reorder) * 64;
  void order;
  return (
    <>
      <div style={{ ...at(984 + a.x, 214, { o: a.o, blur: a.blur }), fontSize: 13, color: 'var(--ink-2)' }}>输出设置</div>
      <div style={{ ...pose(rect(SIDE_X + a.x, 230, 360, 250), { o: a.o, blur: a.blur }), borderRadius: 20, background: 'var(--surface)', fontSize: 15 }}>
        <span style={{ position: 'absolute', left: 16, top: 0, lineHeight: '52px' }}>文件名</span>
        <span style={{ position: 'absolute', left: 122, right: 16, top: 9, height: 34, borderRadius: 11, background: 'var(--track)', padding: '0 12px', lineHeight: '34px', fontSize: 14, color: 'var(--ink-3)' }}>
          沿用原文件名
        </span>
        <span style={{ position: 'absolute', left: 0, right: 0, top: 52, height: 0.5, background: 'var(--divider)' }} />
        <span style={{ position: 'absolute', left: 16, top: 62, lineHeight: '24px' }}>纸张</span>
        {seg(['A4', 'Letter', '和图片一样'], 0, rect(16, 96, 328, 36), [88, 88, 146])}
        <span style={{ position: 'absolute', left: 0, right: 0, top: 146, height: 0.5, background: 'var(--divider)' }} />
        <span style={{ position: 'absolute', left: 16, top: 146, lineHeight: '52px' }}>方向</span>
        {seg(['纵向', '横向'], 0, rect(240, 154, 104, 36), [50, 48])}
        <span style={{ position: 'absolute', left: 0, right: 0, top: 198, height: 0.5, background: 'var(--divider)' }} />
        <span style={{ position: 'absolute', left: 16, top: 198, lineHeight: '52px' }}>边距（毫米）</span>
        <span style={{ position: 'absolute', right: 16, top: 207, width: 100, height: 34, borderRadius: 11, background: 'var(--track)', lineHeight: '34px', textAlign: 'right', padding: '0 12px', fontSize: 14 }}>
          12
        </span>
      </div>
      <div style={{ ...at(984 + b.x, 504, { o: b.o, blur: b.blur }), fontSize: 13, color: 'var(--ink-2)' }}>来源文件</div>
      <div style={{ ...pose(rect(SIDE_X + c.x, 520, 360, 192), { o: c.o, blur: c.blur }), borderRadius: 20, background: 'var(--surface)', overflow: 'hidden' }}>
        {FILES.map((f, i) => (
          <span key={f.name} style={{ position: 'absolute', left: 0, right: 0, top: rowY(i), height: 64 }}>
            <span style={{ position: 'absolute', left: 16, top: 13, fontSize: 13.5 }}>{f.out}</span>
            <span style={{ position: 'absolute', left: 16, top: 35, fontSize: 11.5, color: 'var(--ink-2)' }}>1 页 · {fmtBytes(RUNS[2].kb[i] * 1024)}</span>
            {rowY(i) > 1 && <span style={{ position: 'absolute', left: 16, right: 0, top: 0, height: 0.5, background: 'var(--divider)' }} />}
          </span>
        ))}
      </div>
    </>
  );
}

// ———— 照片下面的说明和“接着用” ————
function Below({ t }: { t: number }) {
  const out = tw(t, P, P + 0.25, E.out2);
  const cap = rise(t, B + 1.7, 0.6, 6);
  const chipPress = kf(t, [
    [18.7, 0],
    [18.77, 1],
    [18.9, 0]
  ]);
  const hover = clamp(prog(t, 18.5, 18.62));
  return (
    <>
      <div style={{ ...at(PREVIEW.x + PREVIEW.w / 2, 722 + cap.y, { anchor: 'center', o: cap.o * (1 - out) }), fontSize: 13, color: 'var(--ink-3)' }}>
        左原图，右压缩后，拖中间的线对比 · 双击放大到 100%
      </div>
      {(() => {
        const v = rise(t, 15.95, 0.6, 8);
        return (
          <div style={{ ...at(PAGE_X, 762 + v.y, { o: v.o * (1 - out) }), fontSize: 13, color: 'var(--ink-2)' }}>接着用</div>
        );
      })()}
      {NEXT.map((n, i) => {
        const r = nextChip(i);
        const g = spring(t - (16.0 + i * 0.06), { w: 12, z: 0.7 });
        const last = i === NEXT.length - 1;
        return (
          <div
            key={n.id}
            style={{
              ...pose(r, { o: clamp(prog(t, 16.0 + i * 0.06, 16.15 + i * 0.06)) * (1 - out), s: (0.8 + 0.2 * g) * (last ? 1 - 0.03 * chipPress : 1) }),
              borderRadius: 999,
              background: 'var(--surface)',
              boxShadow: last && hover > 0 ? `0 0 0 0.5px var(--hairline), 0 10px 30px rgba(0,0,0,${0.08 * hover})` : '0 0 0 0.5px var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 14px 0 4px',
              fontSize: 13.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              marginTop: last ? -hover : 0
            }}
          >
            <ToolGlyph id={n.id} size={30} radius={999} icon={17} />
            {n.name}
          </div>
        );
      })}
    </>
  );
}

// ———— 转 PDF：三页纸，第三页拖到最前，生成后叠成一份 ————
const PAGE_IN = [P + 0.15, P + 0.45, P + 0.55];
const MERGE = { start: 23.35, stack: 23.85 };
function slotX(i: number, t: number) {
  // 每页现在在第几格：B 先让出第二格，A 再让出第一格；C 被拖到第一格
  const S = { w: 10, z: 0.8 };
  const s = pageSlot;
  if (i === 0) return sp(t, s(0).x, [[PAGE_DRAG.a + 0.42, s(1).x, S]]);
  if (i === 1) return sp(t, s(1).x, [[PAGE_DRAG.a + 0.18, s(2).x, S]]);
  return s(2).x;
}
function pageRect(i: number, t: number): { r: Rect; lift: number; rot: number } {
  const y = pageSlot(0).y;
  let r = rect(slotX(i, t), y, 172, 243);
  let lift = 0,
    rot = 0;
  if (i === 2) {
    lift = sp(t, 0, [[PAGE_DRAG.down, 1, { w: 14, z: 0.7 }], [PAGE_DRAG.up, 0, { w: 12, z: 0.65 }]]);
    if (t >= PAGE_DRAG.down) {
      const c = cursorAt(Math.min(t, PAGE_DRAG.up));
      const held = rect(c.x - 86, c.y - 121.5, 172, 243);
      if (t <= PAGE_DRAG.up) r = held;
      else {
        const p = spring(t - PAGE_DRAG.up, { w: 12, z: 0.75 });
        r = mixRect(held, pageSlot(0), p);
      }
      rot = clamp(vel((u) => cursorAt(Math.min(u, PAGE_DRAG.up)).x, t) / 260, -4, 4) * clamp(lift) + 1.5 * clamp(lift);
    }
  }
  // 生成以后叠到中间
  const m = spring(t - (MERGE.start + [0.08, 0.04, 0][i]), { w: 8, z: 0.85 });
  const stack = rect(PREVIEW.x + PREVIEW.w / 2 - 86 + [10, 5, 0][i], 250 + [10, 5, 0][i], 172, 243);
  r = mixRect(r, stack, m);
  rot = lerp(rot, [5, -4, 0][i], clamp(m));
  return { r, lift, rot };
}
function Pages({ t }: { t: number }) {
  if (t < P + 0.15) return null;
  const head = rise(t, P + 0.5, 0.6, 8);
  const merged = tw(t, MERGE.stack, MERGE.stack + 0.4, E.inOut3);
  const order = (i: number) => (t < ORDER_AT ? i : [1, 2, 0][i]);
  const numSwap = tw(t, ORDER_AT, ORDER_AT + 0.3, E.inOut2);
  const draw = [0, 1, 2].sort((a, b) => (a === 2 && t >= PAGE_DRAG.down ? 1 : b === 2 && t >= PAGE_DRAG.down ? -1 : a - b));
  return (
    <>
      <div style={{ ...at(136, 236 + head.y, { o: head.o * (1 - merged) }), fontSize: 15, fontWeight: 600 }}>3 页</div>
      <div style={{ ...at(920, 236 + head.y, { anchor: 'right', o: head.o * (1 - merged) }), fontSize: 12, color: 'var(--ink-2)' }}>拖动或用箭头排序</div>
      {draw.map((i) => {
        const { r: slot, lift, rot } = pageRect(i, t);
        const enter = i === 0 ? 1 : spring(t - PAGE_IN[i], { w: 10, z: 0.85 });
        let r = { ...slot, x: slot.x + (1 - enter) * 90 };
        let photo = pagePhoto(r);
        let paper = 1;
        if (i === 0) {
          // 第一页：预览区里的整张照片缩进纸里
          const p = spring(t - PAGE_IN[0], { w: 8, z: 0.86 });
          photo = mixRect(IMG, pagePhoto(r), p);
          paper = clamp(prog(t, P + 0.32, P + 0.6));
          r = mixRect(inflate(photo, 0), r, clamp(p));
        }
        const o = i === 0 ? 1 : clamp(prog(t, PAGE_IN[i], PAGE_IN[i] + 0.25));
        const s = 1 + 0.05 * lift;
        const status = t < MAKE.start ? 'idle' : t < MAKE.start + 0.2 + i * 0.18 ? 'work' : 'done';
        // 每页自成一层（纸、照片、说明一起），叠起来时后面那页的照片不会盖到前面那页的纸上
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, zIndex: 10 + draw.indexOf(i) }}>
            <div
              className="p-page"
              style={{
                ...pose(r, { o: o * paper, s, rot }),
                boxShadow: `0 0 0 1px var(--divider), 0 ${8 + 18 * lift}px ${20 + 30 * lift}px -12px rgba(0,0,0,${0.35 + 0.15 * lift})`
              }}
            />
            <div style={{ ...pose(photo, { o, s, rot }), overflow: 'hidden', transformOrigin: `${r.x + r.w / 2 - photo.x}px ${r.y + r.h / 2 - photo.y}px` }}>
              <Photo variant={i} />
            </div>
            {/* 页面下面的文件名、页码和箭头 */}
            <div style={{ ...pose(rect(r.x, r.y + 243 + 12, 172, 80), { o: o * clamp(prog(t, P + 0.55, P + 0.9)) * (1 - clamp(lift * 3)) * (1 - tw(t, MERGE.start, MERGE.start + 0.2)) }) }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                <Led
                  color={status === 'done' ? GREEN : status === 'work' ? BLUE : GREEN}
                  size={6}
                  glow={status === 'work' ? 0.6 + 0.4 * Math.sin(t * 12) : 0.6}
                />
                {FILES[i].out}
              </span>
              <span style={{ position: 'relative', display: 'block', height: 18, marginTop: 4, fontSize: 12, color: 'var(--ink-2)' }}>
                <span style={{ position: 'absolute', opacity: 1 - numSwap }}>第 {i + 1} 页 · 来源第 1 页</span>
                <span style={{ position: 'absolute', opacity: numSwap }}>第 {order(i) + 1} 页 · 来源第 1 页</span>
              </span>
              <span style={{ display: 'flex', gap: 2, marginTop: 14 }}>
                {[ArrowLeftIcon, ArrowRightIcon, CloseIcon].map((Icon, k) => (
                  <span
                    key={k}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--track)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: (k === 0 && order(i) === 0) || (k === 1 && order(i) === 2) ? 0.4 : 1
                    }}
                  >
                    <Icon size={15} />
                  </span>
                ))}
              </span>
            </div>
          </div>
        );
      })}
      <PdfDoc t={t} />
    </>
  );
}

// 叠好的三页：盖上 PDF 的标，下面写文件名
function PdfDoc({ t }: { t: number }) {
  const v = spring(t - (MERGE.stack + 0.15), { w: 11, z: 0.6 });
  if (v <= 0.001) return null;
  const x = PREVIEW.x + PREVIEW.w / 2;
  const lab = rise(t, MERGE.stack + 0.3, 0.6, 8);
  return (
    <>
      <span
        style={{
          ...at(x + 70, 280, { anchor: 'center', s: v, z: 20 }),
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 12px 0 9px',
          borderRadius: 999,
          background: '#F0442E',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          boxShadow: '0 6px 16px -6px rgba(240,68,46,0.7)'
        }}
      >
        <KindIcon kind="pdf" size={16} />
        PDF
      </span>
      <div style={{ ...at(x, 540 + lab.y, { anchor: 'center', o: lab.o }), fontSize: 17, fontWeight: 600 }}>旅行相册.pdf</div>
      <div style={{ ...at(x, 566 + lab.y, { anchor: 'center', o: lab.o }), fontSize: 13, color: 'var(--ink-2)' }}>3 页 · 812 KB · A4</div>
    </>
  );
}

export function Bench({ t }: { t: number }) {
  if (t < B || t > PAL_OUT + 0.5) return null;
  const out = pageOut(t);
  return (
    <div className="layer" style={{ opacity: 1 - out, zIndex: 5 }}>
      <Panel t={t} />
      <Compare t={t} />
      <Pages t={t} />
      <Head t={t} />
      <Side t={t} />
      <Below t={t} />
      <Bar t={t} />
      <Nav t={t} />
    </div>
  );
}

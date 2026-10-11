// 第一幕：标志亮起来 → 四个方块变成首页的键帽，卡片长出来 → 拖进一张照片，键帽分裂成推荐的四个工具
import type { CSSProperties } from 'react';
import { E, bump, clamp, inflate, kf, lerp, mixColor, mixRect, prog, rect, sp, spring, tw, union, type Rect } from '../lib/anim';
import { Chars, Draw, Led, Photo, at, pose, rise } from '../lib/kit';
import { KindIcon, ToolIcon } from '../../src/components/ToolIcon';
import { Chevron, Kbd } from '../../src/components/ui';
import { ToolGlyph } from '../lib/kit';
import { toolById } from '../../src/tools';
import {
  CARD,
  CARD_R,
  CARD_SUB_Y,
  CARD_TITLE_Y,
  COMBO,
  CTA_Y,
  FILES,
  GROUP,
  H1_Y,
  HERO_KINDS,
  HERO_LEDS,
  LOGO,
  MATCH,
  NOTE_Y,
  PICK_BTN,
  RES_Y,
  RESULT,
  SUB_Y,
  chipRect,
  heroKey,
  matchGlyph,
  matchRow
} from '../layout';
import { DRAG_FILE, T, cursorAt, vel } from '../timeline';

const GREEN = '#22B35E';
// 卡片的几个时刻
const CARD_IN = T.hero + 1.85;
const OVER = T.drop + 1.15;
const SPLIT = T.drop + 1.85;
// 拖着文件经过卡片时的“松手”状态
const overAt = (t: number) => sp(t, 0, [[OVER, 1, { w: 14, z: 0.85 }], [SPLIT - 0.03, 0, { w: 12, z: 1 }]]);

// ———— 标志的暖橙底 ————
function LogoBase({ t }: { t: number }) {
  if (t < 0.5 || t > T.hero + 0.6) return null;
  const g = spring(t - 0.55, { w: 9, z: 0.72 });
  const size = 150 * g;
  const out = tw(t, T.hero, T.hero + 0.45, E.out3);
  const r = rect(720 - size / 2, 405 - size / 2, size, size);
  const shine = kf(t, [
    [1.45, -120],
    [2.2, 220, E.inOut2]
  ]);
  return (
    <div
      style={{
        ...pose(r, { s: 1 + out * 0.15, o: 1 - out }),
        borderRadius: (15 / 64) * size,
        background: 'linear-gradient(180deg, #F88A54, #E35B22)',
        boxShadow: `0 ${size * 0.14}px ${size * 0.3}px -${size * 0.12}px rgba(227, 91, 34, 0.55)`,
        overflow: 'hidden'
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.32) 50%, transparent 65%)',
          transform: `translateX(${shine}%)`
        }}
      />
    </div>
  );
}

// ———— 标志上的绿灯：先在正中亮起，再落到左上那块方块上 ————
function LogoLed({ t }: { t: number }) {
  if (t < 0.2 || t >= T.hero) return null;
  const s = spring(t - 0.25, { w: 16, z: 0.5 });
  const m = spring(t - 1.0, { w: 9, z: 0.8 });
  const x = lerp(720, LOGO.led.x, m),
    y = lerp(405, LOGO.led.y, m);
  const d = lerp(16, LOGO.led.d, m);
  const ring = prog(t, 0.32, 1.0);
  return (
    <>
      <span
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: '50%',
          background: GREEN,
          transform: `scale(${s})`,
          boxShadow: `0 0 ${d * 0.8}px rgba(34, 179, 94, 0.9)`,
          zIndex: 5
        }}
      />
      {ring > 0 && ring < 1 && (
        <span
          style={{
            position: 'absolute',
            left: 720 - 40,
            top: 405 - 40,
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '1.5px solid rgba(34, 179, 94, 0.6)',
            transform: `scale(${0.2 + E.out3(ring) * 1.2})`,
            opacity: 1 - ring
          }}
        />
      )}
    </>
  );
}

// ———— 键帽 ————
// 前四个从标志的方块变来：图片 ← 左上（带灯），PDF ← 左下，视频 ← 右上，表格 ← 右下；JSON 和文本后面弹出来
const FROM_SQ: Record<number, number> = { 1: 0, 0: 2, 2: 1, 3: 3 };
const POP = [1.09, 0.85, 0.93, 1.01]; // 方块弹出的时刻（按键帽序号）
const MOVE = [0.06, 0, 0.12, 0.18, 0.4, 0.5]; // 变成键帽的先后
const tilt = (i: number) => (i - 2.5) * 2.4;

function keyState(i: number, t: number) {
  const from = FROM_SQ[i];
  const start = T.hero + MOVE[i];
  const p = spring(t - start, { w: 8.5, z: 0.78 });
  const home = heroKey(i);
  let r: Rect, s: number, o: number, radius: number, alpha: number;
  if (from !== undefined) {
    const sq = LOGO.sq[from];
    r = mixRect(sq, home, p);
    s = spring(t - POP[i], { w: 13, z: 0.62 });
    o = clamp(prog(t, POP[i], POP[i] + 0.15));
    radius = lerp(LOGO.sr, 15, clamp(p));
    // 标志上：左上那块全白，其余 42%；依次闪一下
    const flash = i === 1 ? 0 : bump(t, 1.48 + [0, 0, 0.12, 0.24][i] * 1, 0.5);
    alpha = lerp(i === 1 ? 1 : 0.42 + 0.5 * flash, 1, clamp(p * 1.6));
  } else {
    r = home;
    s = 0.35 + 0.65 * spring(t - start, { w: 11, z: 0.62 });
    o = clamp(prog(t, start, start + 0.2));
    radius = 15;
    alpha = 1;
  }
  const settle = clamp(prog(t, T.hero + 0.6, T.hero + 1.4));
  const float = -5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t + 0.85 * i)) / 5)) * settle;
  const over = overAt(t);
  const rot = lerp(0, tilt(i), clamp(p)) * (1 - over);
  return { r: { ...r, y: r.y + float - 10 * over }, s, o, radius, alpha, p, rot };
}

function HeroKeys({ t }: { t: number }) {
  if (t < 0.8 || t > T.bench + 0.4) return null;
  return (
    <>
      {HERO_KINDS.map((kind, i) => {
        const k = keyState(i, t);
        let { o, s } = k;
        let blur = 0;
        // 收到文件：除了图片，其余键帽缩回去
        if (i !== 1) {
          const q = E.in2(prog(t, SPLIT + Math.abs(i - 1) * 0.04, SPLIT + Math.abs(i - 1) * 0.04 + 0.32));
          o *= 1 - q;
          s *= 1 - 0.45 * q;
          blur = 6 * q;
        } else if (t >= SPLIT + 0.05) return null; // 图片键帽交给下面的分身
        if (o <= 0) return null;
        const shadow = clamp(k.p);
        const draw = prog(t, T.hero + 0.45 + i * 0.07, T.hero + 1.15 + i * 0.07);
        const led = i === 1 ? 1 : spring(t - (T.hero + 0.75 + i * 0.06), { w: 14, z: 0.55 });
        const lp = clamp(k.p);
        const lx = i === 1 ? lerp(0.69, 0.8125, lp) : 0.8125,
          ly = i === 1 ? lerp(0.31, 0.1875, lp) : 0.1875;
        const ld = i === 1 ? lerp(LOGO.led.d, 5, lp) : 5;
        return (
          <div
            key={kind}
            className="p-key"
            style={{
              ...pose(k.r, { s, o, rot: k.rot, blur }),
              borderRadius: k.radius,
              background: `rgba(255, 255, 255, ${k.alpha.toFixed(3)})`,
              boxShadow:
                shadow > 0.01
                  ? `inset 0 -1.5px 0 rgba(0,0,0,${0.08 * shadow}), 0 0 0 0.5px rgba(0,0,0,${0.06 * shadow}), 0 10px 22px -12px rgba(0,0,0,${0.3 * shadow})`
                  : undefined,
              zIndex: 3
            }}
          >
            {draw > 0 && (
              <Draw p={E.inOut2(draw)}>
                <KindIcon kind={kind} size={26.6} />
              </Draw>
            )}
            {(i === 1 ? t >= T.hero : led > 0) && (
              <span
                style={{
                  position: 'absolute',
                  left: lx * k.r.w - ld / 2,
                  top: ly * k.r.h - ld / 2,
                  width: ld,
                  height: ld,
                  borderRadius: '50%',
                  background: HERO_LEDS[i],
                  boxShadow: `0 0 ${ld}px ${HERO_LEDS[i]}`,
                  transform: `scale(${led})`,
                  opacity: i === 1 ? 1 - clamp(prog(t, SPLIT - 0.05, SPLIT + 0.1)) : 1
                }}
              />
            )}
          </div>
        );
      })}
      <GlyphSplit t={t} />
    </>
  );
}

// 图片键帽一分为四：每个分身飞到一行推荐工具的键帽位置，图标从“图片”换成各自工具的
function GlyphSplit({ t }: { t: number }) {
  if (t < SPLIT) return null;
  const out = tw(t, T.bench, T.bench + 0.2, E.out2);
  if (out >= 1) return null;
  return (
    <>
      {MATCH.map((id, j) => {
        const s0 = SPLIT + j * 0.07;
        const from = keyState(1, s0).r;
        const p = spring(t - s0, { w: 9, z: 0.8 });
        const lp = clamp(p);
        const r = mixRect(from, matchGlyph(j), p);
        const sw = clamp(p * 2.2 - 0.3);
        const o = (j === 0 ? 1 : clamp(prog(t, s0, s0 + 0.12))) * (1 - out);
        return (
          <div
            key={id}
            className="p-key"
            style={{
              ...pose(r, { o, rot: lerp(tilt(1), 0, lp) * (1 - overAt(s0)) }),
              borderRadius: lerp(15, 8, lp),
              background: mixColor('#FFFFFF', '#F4F3F0', lp),
              boxShadow: `inset 0 -1.5px 0 rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06), 0 10px 22px -12px rgba(0,0,0,${(0.3 * (1 - lp)).toFixed(3)})`,
              zIndex: 4
            }}
          >
            <span style={{ position: 'absolute', display: 'flex', opacity: 1 - sw, transform: `scale(${lerp(1, 0.68, lp)})` }}>
              <KindIcon kind="image" size={26.6} />
            </span>
            <span style={{ position: 'absolute', display: 'flex', opacity: sw, transform: `scale(${lerp(1.46, 1, lp)})` }}>
              <ToolIcon id={id} size={18.2} />
            </span>
          </div>
        );
      })}
    </>
  );
}

// ———— 标题 ————
function HeroText({ t }: { t: number }) {
  if (t < T.hero + 0.7 || t > T.drop + 0.8) return null;
  const sub = rise(t, T.hero + 1.3, 0.7);
  const subOut = tw(t, T.drop + 0.05, T.drop + 0.45, E.in2);
  return (
    <>
      <div style={{ ...at(720, H1_Y, { anchor: 'center' }), fontSize: 58, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.12 }}>
        <Chars text="顺手的小工具，全在浏览器里。" t={t} at={T.hero + 0.75} stagger={0.032} dur={0.75} rise={22} blur={10} out={[T.drop, 0.35]} />
      </div>
      <div
        style={{
          ...at(720, SUB_Y + sub.y - subOut * 14, { anchor: 'center', o: sub.o * (1 - subOut), blur: sub.blur + subOut * 6 }),
          fontSize: 19,
          color: 'var(--ink-2)'
        }}
      >
        图片、PDF、音视频、表格和代码，打开就用，文件不上传。
      </div>
    </>
  );
}

// ———— 卡片本身：从键帽周围长出来，收到文件后往上长成推荐列表，点工具后铺满整个画面变成工具页的底色 ————
export function cardRect(t: number): { r: Rect; radius: number } {
  const pill = inflate(union(HERO_KINDS.map((_, i) => heroKey(i))), 18);
  const a = spring(t - CARD_IN, { w: 7, z: 0.86 });
  let r = mixRect(pill, CARD, a);
  let radius = lerp(46, CARD_R, clamp(a));
  const b = spring(t - SPLIT, { w: 8, z: 0.86 });
  r = mixRect(r, RESULT, b);
  const c = spring(t - (T.bench + 0.08), { w: 6, z: 0.95 });
  r = mixRect(r, rect(0, 0, 1440, 810), c);
  radius = lerp(radius, 0, clamp(c));
  return { r, radius };
}

function HeroCard({ t }: { t: number }) {
  if (t < CARD_IN) return null;
  const { r, radius } = cardRect(t);
  const over = overAt(t);
  const o = clamp(prog(t, CARD_IN, CARD_IN + 0.3));
  const page = tw(t, T.bench + 0.08, T.bench + 0.6, E.inOut2);
  const dash = E.soft(prog(t, CARD_IN + 0.35, CARD_IN + 0.9)) * (1 - tw(t, SPLIT, SPLIT + 0.2, E.out2));
  const inset = lerp(lerp(24, 10, dash), 6, over);
  return (
    <div
      style={{
        ...pose(r, { o, s: 1 + 0.01 * over }),
        borderRadius: radius,
        background: 'var(--bg-warm)',
        overflow: 'hidden'
      }}
    >
      {/* 顶部那片白色柔光；铺满成工具页时褪掉 */}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1 - page,
          background: 'radial-gradient(70% 90% at 50% 0%, color-mix(in srgb, var(--surface) 75%, transparent), transparent 75%)'
        }}
      />
      <span style={{ position: 'absolute', inset: 0, background: 'var(--accent-tint)', opacity: over }} />
      {dash > 0.01 && (
        <span
          style={{
            position: 'absolute',
            inset,
            borderRadius: radius - 8,
            border: `1.5px dashed ${over > 0.01 ? mixColor('rgba(60, 58, 54, 0.2)', '#C2410C', over) : 'var(--divider)'}`,
            opacity: dash
          }}
        />
      )}
    </div>
  );
}

// ———— 卡片里的字：空状态 → 收到文件 ————
function CardContent({ t }: { t: number }) {
  if (t < CARD_IN + 0.3 || t > T.bench + 0.4) return null;
  const gone = tw(t, SPLIT, SPLIT + 0.22, E.out2);
  const over = overAt(t);
  const line = (start: number, y: number, style: CSSProperties, children: React.ReactNode, extra: number = 0) => {
    const v = rise(t, start, 0.6);
    return (
      <div style={{ ...at(720 + extra, y + v.y - 6 * gone, { anchor: 'center', o: v.o * (1 - gone), blur: v.blur + 4 * gone }), ...style }}>
        {children}
      </div>
    );
  };
  const btn = spring(t - (CARD_IN + 0.65), { w: 12, z: 0.6 });
  const titleSwap = clamp(over * 1.4);
  return (
    <>
      {gone < 1 && (
        <>
          {line(
            CARD_IN + 0.4,
            CARD_TITLE_Y - 8 * titleSwap,
            { fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', opacity: 1 - titleSwap },
            '把任意文件拖到这里'
          )}
          {titleSwap > 0 &&
            line(
              CARD_IN + 0.4,
              CARD_TITLE_Y + 8 * (1 - titleSwap),
              { fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', opacity: titleSwap },
              '松手，看看能做什么'
            )}
          {line(CARD_IN + 0.53, CARD_SUB_Y, { fontSize: 16, color: 'var(--ink-2)' }, '自动认出类型，推荐能用的工具。')}
          <button
            type="button"
            className="btn btn-lg"
            style={{ ...pose(PICK_BTN, { s: 0.6 + 0.4 * btn, o: clamp(prog(t, CARD_IN + 0.65, CARD_IN + 0.8)) * (1 - gone) }), padding: 0 }}
          >
            选择文件
          </button>
          {line(
            CARD_IN + 0.77,
            CTA_Y,
            { fontSize: 14, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4 },
            <>
              或按 <Kbd small>⌘</Kbd>
              <Kbd small>V</Kbd> 粘贴
            </>,
            60
          )}
          {line(
            CARD_IN + 0.9,
            NOTE_Y,
            { fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 7 },
            <>
              <Led color={GREEN} size={6} glow={0.8} />0 B 上传 · 只在浏览器里读取
            </>
          )}
        </>
      )}
      <ResultContent t={t} />
    </>
  );
}

function ResultContent({ t }: { t: number }) {
  if (t < SPLIT) return null;
  const out = tw(t, T.bench, T.bench + 0.22, E.out2);
  const v = (start: number, dx = 0, dy = 10) => {
    const p = E.soft(prog(t, start, start + 0.55));
    return { o: p * (1 - out), x: (1 - p) * dx, y: (1 - p) * dy, blur: (1 - p) * 4 };
  };
  const head = v(SPLIT + 0.3),
    sub = v(SPLIT + 0.4),
    act = v(SPLIT + 0.45),
    lab = v(SPLIT + 0.35),
    more = v(SPLIT + 0.7),
    note = v(SPLIT + 0.75);
  const g = spring(t - (SPLIT + 0.18), { w: 10, z: 0.85 });
  // 鼠标停在第一行上
  const hover = clamp(prog(t, 10.9, 11.05));
  const press = kf(t, [
    [11.3, 0],
    [11.37, 1],
    [11.45, 0]
  ]);
  return (
    <>
      <div style={{ ...at(230 + head.x, RES_Y + 44 + head.y, { o: head.o, blur: head.blur }), fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
        收到 3 个文件
      </div>
      <div style={{ ...at(230, RES_Y + 75 + sub.y, { o: sub.o, blur: sub.blur }), fontSize: 14, color: 'var(--ink-2)' }}>点一下工具，文件会一起带过去。</div>
      <div style={{ ...at(1210, RES_Y + 44 + act.y, { anchor: 'right', o: act.o }), display: 'flex', alignItems: 'center', gap: 14, fontSize: 14 }}>
        <span className="btn-soft btn-sm" style={{ height: 32 }}>
          换一批
        </span>
        <span style={{ color: 'var(--accent)' }}>清空</span>
      </div>
      <div style={{ ...pose(GROUP, { o: clamp(g * 1.5) * (1 - out), s: 0.97 + 0.03 * g }), borderRadius: 20, background: 'var(--surface)', zIndex: 2 }} />
      <Combo t={t} out={out} />
      <div
        style={{
          ...at(249, RES_Y + 244 + lab.y, { o: lab.o, z: 3 }),
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-soft)'
        }}
      >
        <Led color={GREEN} size={6} glow={0.8} />3 张图片可以
      </div>
      {MATCH.map((id, j) => {
        const tool = toolById(id)!;
        const row = matchRow(j);
        const r = v(SPLIT + 0.45 + j * 0.07, -12, 0);
        // 第一行交给工具页去变形
        const gone = j === 0 && t >= T.bench ? 0 : 1;
        return (
          <div key={id} style={{ ...pose(row, { o: gone, s: j === 0 ? 1 - 0.015 * press : 1, z: 3 }), borderRadius: 12 }}>
            {j === 0 && <span style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'var(--hover)', opacity: hover }} />}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 52,
                paddingRight: 10,
                opacity: r.o,
                transform: `translateX(${r.x}px)`,
                filter: r.blur > 0.05 ? `blur(${r.blur}px)` : undefined
              }}
            >
              <b style={{ fontSize: 15, fontWeight: 600 }}>{tool.name}</b>
              <small style={{ flex: '1 1 auto', fontSize: 13, color: 'var(--ink-2)' }}>{tool.desc}</small>
              <Chevron />
            </div>
          </div>
        );
      })}
      <div style={{ ...at(288, RES_Y + 452 + more.y, { o: more.o, z: 3 }), fontSize: 13, color: 'var(--accent)' }}>还有 7 个工具</div>
      <div
        style={{ ...at(233, RES_Y + 501 + note.y, { o: note.o, z: 3 }), display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink-2)' }}
      >
        <Led color={GREEN} size={6} glow={0.8} />
        只在浏览器内存里，关掉页面就释放
      </div>
    </>
  );
}

// “把 3 张图片做成一份 PDF”的推荐
function Combo({ t, out }: { t: number; out: number }) {
  const g = spring(t - (SPLIT + 0.25), { w: 10, z: 0.85 });
  const v = E.soft(prog(t, SPLIT + 0.35, SPLIT + 0.9));
  return (
    <div
      style={{
        ...pose(COMBO, { o: clamp(g * 1.5) * (1 - out), s: 0.97 + 0.03 * g, z: 2 }),
        borderRadius: 20,
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px 10px 14px'
      }}
    >
      <span style={{ display: 'flex', opacity: v }}>
        <ToolGlyph id="pdf-from-image" size={38} radius={10} icon={22} />
      </span>
      <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', lineHeight: 1.35, opacity: v, transform: `translateX(${(1 - v) * -10}px)` }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}>
          把 3 张图片做成一份 PDF
          <span className="badge">推荐</span>
        </b>
        <small style={{ fontSize: 13, color: 'var(--ink-2)' }}>一张图一页，纸张和边距可调</small>
      </span>
      <span className="btn" style={{ opacity: v }}>
        做成 PDF
      </span>
    </div>
  );
}

// ———— 拖进来的照片：松手后缩成一枚文件标签 ————
const THUMB = { w: 132, h: 99 };
function thumbAt(t: number) {
  const c = cursorAt(t);
  const vx = vel((u) => cursorAt(u).x, t);
  const rot = -3 + clamp(vx / 140, -8, 8);
  return { r: rect(c.x - 10 - THUMB.w / 2, c.y + 14 - THUMB.h / 2, THUMB.w, THUMB.h), rot };
}
const LAND = DRAG_FILE.release + 0.2;
// 三张叠在一起拖：后面两张错开一点
const FAN = [
  { dx: 0, dy: 0, rot: 0 },
  { dx: 7, dy: -5, rot: 5 },
  { dx: -6, dy: -8, rot: -6 }
];

function DragFile({ t }: { t: number }) {
  if (t < DRAG_FILE.show || t > T.bench + 0.4) return null;
  const held = thumbAt(Math.min(t, DRAG_FILE.release));
  const drop = kf(t, [
    [DRAG_FILE.release, 0],
    [DRAG_FILE.release + 0.1, 1, E.out2],
    [LAND, 0.6, E.inOut2]
  ]);
  const o = clamp(prog(t, DRAG_FILE.show, DRAG_FILE.show + 0.2)) * (1 - tw(t, T.bench, T.bench + 0.22, E.out2));
  const label = 1 - clamp(prog(t, DRAG_FILE.release, DRAG_FILE.release + 0.15));
  return (
    <>
      {[2, 1, 0].map((i) => {
        const f = FAN[i];
        const s0 = LAND + i * 0.06;
        const p = spring(t - s0, { w: 9, z: 0.85 });
        const lp = clamp(p);
        const from = { ...held.r, x: held.r.x + f.dx, y: held.r.y + f.dy };
        const r = mixRect(from, chipRect(i), p);
        const photo = 1 - clamp(lp * 1.6);
        const chip = clamp(lp * 1.8 - 0.7);
        return (
          <div key={i} style={{ ...pose(r, { rot: lerp(held.rot + f.rot, 0, lp), s: 1 - 0.05 * drop * (1 - lp), o: o * lerp(0.95, 1, lp), z: 20 - i }) }}>
            <div
              className="p-thumb"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: lerp(12, 16, lp),
                borderWidth: 4 * (1 - lp),
                borderColor: `rgba(255,255,255,${photo})`,
                background: 'var(--surface)',
                boxShadow: `0 0 0 0.5px var(--hairline), 0 ${18 * (1 - lp)}px ${40 * (1 - lp)}px -12px rgba(0,0,0,${0.45 * (1 - lp)})`
              }}
            >
              <span style={{ position: 'absolute', inset: 0, opacity: photo }}>
                <Photo variant={i} />
              </span>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 12px',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  opacity: chip,
                  color: GREEN
                }}
              >
                <KindIcon kind="image" />
                <span style={{ color: 'var(--ink)' }}>{FILES[i].name}</span>
                <small style={{ color: 'var(--ink-2)', fontSize: 12 }}>{FILES[i].size} MB</small>
              </span>
            </div>
          </div>
        );
      })}
      {label > 0 && (
        <>
          <span
            style={{
              ...at(held.r.x + THUMB.w / 2, held.r.y + THUMB.h + 18, { anchor: 'center', o: label * o, z: 21 }),
              padding: '2px 7px',
              borderRadius: 5,
              background: 'rgba(30, 90, 220, 0.92)',
              color: '#fff',
              fontSize: 11.5
            }}
          >
            3 个项目
          </span>
          <span
            style={{
              ...at(held.r.x + THUMB.w - 4, held.r.y + 2, { anchor: 'center', o: label * o, z: 21 }),
              minWidth: 22,
              height: 22,
              padding: '0 6px',
              borderRadius: 11,
              background: '#F0442E',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }}
          >
            3
          </span>
        </>
      )}
    </>
  );
}

// 拖文件时鼠标旁边的绿色“+”（拷贝）
export function CopyBadge({ t }: { t: number }) {
  const c = cursorAt(t);
  if (c.copy <= 0 || c.o <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        left: c.x + 10,
        top: c.y + 16,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#34C759',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1,
        zIndex: 201,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        opacity: c.copy * c.o,
        transform: `scale(${c.copy})`
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M5 1.5v7M1.5 5h7" />
      </svg>
    </span>
  );
}

export function Intro({ t }: { t: number }) {
  if (t > T.bench + 1.2) return null;
  return (
    <>
      <HeroCard t={t} />
      <CardContent t={t} />
      <LogoBase t={t} />
      <HeroText t={t} />
      <HeroKeys t={t} />
      <LogoLed t={t} />
      <DragFile t={t} />
    </>
  );
}

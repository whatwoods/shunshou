// ⌘K：两颗大键帽按下去，合成一块玻璃面板；输入“压缩”，列表原地重排；最后结果里的四个键帽飞去工具墙
import type { CSSProperties, ReactNode } from 'react';
import { E, clamp, kf, lerp, mixRect, rect, sp, spring, tw, union } from '../lib/anim';
import { Led, MorphGlass, ToolGlyph, at, pose, rise } from '../lib/kit';
import { MoonIcon, PlusIcon, SearchIcon } from '../../src/components/ui';
import { categoryOf, toolById } from '../../src/tools';
import { CMD_KEYS, PAL, palRowY } from '../layout';
import { PAL_OUT, T } from '../timeline';

const P0 = T.palette;
const PRESS = [P0 + 0.38, P0 + 0.46];
const MORPH = P0 + 0.6;
const TYPE = [P0 + 1.6, P0 + 1.76]; // 压、缩
const Q = TYPE[0] + 0.05; // 列表换成搜索结果
const DOWN = P0 + 2.25; // ↓
// 结果里的四个工具：散场时飞去工具墙
export const PAL_RESULTS = ['pdf-compress', 'image-compress', 'av-compress', 'code-json'];
const SPR = { w: 13, z: 0.78 };

// 面板（含两颗键帽变过来的过程）
const sheetP = (t: number) => spring(t - MORPH, { w: 8.5, z: 0.8 });
function keycap(i: number, t: number) {
  const up = spring(t - (P0 + i * 0.08), { w: 11, z: 0.68 });
  const press = kf(t, [
    [PRESS[i], 0],
    [PRESS[i] + 0.06, 1, E.out2],
    [MORPH + 0.02, 1],
    [MORPH + 0.2, 0, E.out2]
  ]);
  const base = { ...CMD_KEYS[i], y: CMD_KEYS[i].y + (1 - up) * 40 + 3 * press };
  return { r: mixRect(base, PAL, sheetP(t)), up, press };
}

function Keycaps({ t }: { t: number }) {
  const body = 1 - tw(t, MORPH, MORPH + 0.28, E.inOut2);
  if (body <= 0) return null;
  const p = clamp(sheetP(t));
  return (
    <>
      {CMD_KEYS.map((_, i) => {
        const k = keycap(i, t);
        const o = clamp(k.up * 1.4) * body;
        const glyph = 1 - tw(t, MORPH, MORPH + 0.14, E.out2);
        return (
          <div
            key={i}
            className="p-key"
            style={{
              ...pose(k.r, { o, s: 0.6 + 0.4 * Math.min(1, k.up) - 0.03 * k.press }),
              borderRadius: lerp(20, 26, p),
              boxShadow: `inset 0 ${-3 + 2 * k.press}px 0 rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06), 0 ${18 - 12 * k.press}px ${36 - 20 * k.press}px -14px rgba(0,0,0,0.35)`,
              fontSize: 48,
              fontWeight: 500,
              color: 'var(--ink-soft)'
            }}
          >
            <span style={{ opacity: glyph, transform: `scale(${1 - 0.3 * (1 - glyph)})` }}>{i === 0 ? '⌘' : 'K'}</span>
          </div>
        );
      })}
    </>
  );
}

// 一行工具
function ToolRow({ id, y, o, dy = 0, sel, glyph = 1 }: { id: string; y: number; o: number; dy?: number; sel: boolean; glyph?: number }) {
  const tool = toolById(id)!;
  const cat = categoryOf(tool.cat);
  return (
    <div style={{ ...pose(rect(PAL.x + 10, y + dy, 620, 54), { o }), display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px' }}>
      <ToolGlyph id={id} size={34} radius={9} icon={18} style={{ opacity: glyph }} />
      <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{tool.name}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{tool.desc}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>
        <Led color={cat.led} size={6} glow={0} />
        {cat.name}
      </span>
      <span className="kbd" style={{ width: 26, color: 'var(--accent)', fontSize: 13, opacity: sel ? 1 : 0 }}>
        ↵
      </span>
    </div>
  );
}
function ActionRow({ y, o, icon, children }: { y: number; o: number; icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ ...pose(rect(PAL.x + 10, y, 620, 44), { o }), display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', fontSize: 15 }}>
      <span style={{ width: 34, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--track)', color: 'var(--ink-soft)' }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

// 每个元素在“最近用过”（A）和“搜索结果”（B）里的位置；两边都有的原地滑过去
const ROWS: { id: string; a?: number; b?: number }[] = [
  { id: 'pdf-from-image', a: 0 },
  { id: 'image-compress', a: 1, b: 1 },
  { id: 'pdf-compress', b: 0 },
  { id: 'av-compress', b: 2 },
  { id: 'code-json', b: 3 }
];
// 动作行：最后一行工具下面空 10，再是 30 高的“动作”标题
const ACT_A = palRowY(2) + 40,
  ACT_B = palRowY(4) + 40;

function Body({ t }: { t: number }) {
  const v = (d: number) => rise(t, MORPH + 0.22 + d, 0.5, 8, 4);
  const q = tw(t, Q, Q + 0.18, E.out2);
  const out = tw(t, PAL_OUT, PAL_OUT + 0.3, E.out2);
  // 选中块：A 里在第一行；换成结果后回到第一行，按 ↓ 落到“图片压缩”
  const selY = sp(t, palRowY(0), [[DOWN, palRowY(1), SPR]]);
  const label = (y: number, o: number, text: string, style?: CSSProperties) => (
    <div style={{ ...at(PAL.x + 22, y + 9, { o: o * (1 - out) }), fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', ...style }}>{text}</div>
  );
  const head = v(0);
  const typed = t >= TYPE[1] ? '压缩' : t >= TYPE[0] ? '压' : '';
  const caretOn = t < TYPE[1] + 0.5 || Math.floor((t - TYPE[1] - 0.5) * 2) % 2 === 1;
  const actY = sp(t, ACT_A, [[Q, ACT_B, SPR]]);
  const downKey = kf(t, [
    [DOWN - 0.04, 0],
    [DOWN, 1],
    [DOWN + 0.16, 0, E.out2]
  ]);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
      {/* 输入框 */}
      <span style={{ ...at(PAL.x + 22, PAL.y + 32, { o: head.o }), display: 'flex', color: 'var(--ink-2)' }}>
        <SearchIcon size={20} />
      </span>
      <div style={{ ...at(PAL.x + 54, PAL.y + 32 + head.y, { o: head.o }), fontSize: 20, display: 'flex', alignItems: 'center' }}>
        {typed ? <span>{typed}</span> : <span style={{ position: 'absolute', left: 1, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>搜索工具，或输入一个动作</span>}
        <span style={{ width: 1.5, height: 24, marginLeft: 1, background: 'var(--accent)', opacity: caretOn ? 1 : 0 }} />
      </div>
      <span className="kbd" style={{ ...at(PAL.x + PAL.w - 18, PAL.y + 32, { anchor: 'right', o: head.o }) }}>
        esc
      </span>
      <span style={{ ...pose(rect(PAL.x, PAL.y + 64, PAL.w, 0.5), { o: head.o }), background: 'var(--divider)' }} />

      {/* 选中块 */}
      <span style={{ ...pose(rect(PAL.x + 10, selY, 620, 54), { o: v(0.06).o }), borderRadius: 14, background: 'var(--accent-tint-2)' }} />
      {label(PAL.y + 78, v(0.04).o * (1 - q), '最近用过')}
      {label(PAL.y + 78, q, '工具')}
      {ROWS.map((row, k) => {
        const yA = row.a !== undefined ? palRowY(row.a) : undefined;
        const yB = row.b !== undefined ? palRowY(row.b) : undefined;
        let y: number, o: number, dy = 0;
        if (yA !== undefined && yB !== undefined) {
          y = sp(t, yA, [[Q, yB, SPR]]);
          o = v(0.08 + row.a! * 0.04).o;
        } else if (yA !== undefined) {
          y = yA;
          o = v(0.08 + row.a! * 0.04).o * (1 - tw(t, Q, Q + 0.14, E.out2));
          dy = -6 * tw(t, Q, Q + 0.14, E.out2);
        } else {
          y = yB!;
          const r = rise(t, Q + 0.04 + row.b! * 0.035, 0.4, 10, 0);
          o = r.o;
          dy = r.y;
        }
        const sel = Math.abs(selY - y) < 20 && (t < Q ? row.a === 0 : true);
        // 散场时结果里的键帽交给工具墙
        const glyph = t >= PAL_OUT && PAL_RESULTS.includes(row.id) ? 0 : 1;
        return <ToolRow key={row.id + k} id={row.id} y={y} dy={dy} o={o} sel={sel} glyph={glyph} />;
      })}
      {label(actY - 24, v(0.16).o, '动作')}
      <ActionRow y={actY} o={v(0.18).o} icon={<PlusIcon size={16} />}>
        选择图片，开始压缩
      </ActionRow>
      <ActionRow y={ACT_A + 44} o={v(0.22).o * (1 - tw(t, Q, Q + 0.14, E.out2))} icon={<MoonIcon size={16} />}>
        切换到深色
      </ActionRow>

      {/* 底栏 */}
      <span style={{ ...pose(rect(PAL.x, PAL.y + PAL.h - 44, PAL.w, 0.5), { o: v(0.2).o }), background: 'var(--divider)' }} />
      <div style={{ ...at(PAL.x + 20, PAL.y + PAL.h - 22, { o: v(0.2).o }), display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--ink-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="kbd kbd-sm">↑</span>
          <span
            className="kbd kbd-sm"
            style={{ transform: `translateY(${downKey}px)`, background: downKey > 0.05 ? `color-mix(in srgb, var(--accent) ${Math.round(18 * downKey)}%, var(--kbd-bg))` : undefined }}
          >
            ↓
          </span>
          选择
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="kbd kbd-sm">↵</span>打开
        </span>
      </div>
      <div style={{ ...at(PAL.x + PAL.w - 20, PAL.y + PAL.h - 22, { anchor: 'right', o: v(0.2).o }), display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--ink-2)' }}>
        <Led color="#22B35E" size={6} glow={0.6} />
        在本机搜索，不联网
      </div>
    </div>
  );
}

export function Palette({ t }: { t: number }) {
  if (t < P0 || t > PAL_OUT + 0.6) return null;
  const scrim = tw(t, P0, P0 + 0.4, E.out2) * (1 - tw(t, PAL_OUT, PAL_OUT + 0.45, E.inOut2));
  const p = sheetP(t);
  const keys = union(CMD_KEYS.map((_, i) => keycap(i, t).r));
  const r = mixRect(keys, PAL, p);
  const glass = tw(t, MORPH, MORPH + 0.16, E.out2);
  const out = tw(t, PAL_OUT, PAL_OUT + 0.4, E.inOut2);
  return (
    <div className="layer" style={{ zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', opacity: scrim }} />
      {glass > 0 && (
        <MorphGlass
          w={r.w}
          h={r.h}
          r={lerp(20, 26, clamp(p))}
          kind="sheet"
          blur={14}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px) scale(${1 + 0.03 * out})`,
            transformOrigin: '50% 50%',
            opacity: glass * (1 - out),
            ['--lg-shadow' as string]: '0 0 0 0.5px var(--hairline), 0 30px 80px -20px rgba(0, 0, 0, 0.35)'
          }}
        />
      )}
      <Keycaps t={t} />
      {t >= MORPH && <Body t={t} />}
    </div>
  );
}

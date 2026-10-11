// 工具墙和隐私：55 个键帽是同一批——从 ⌘K 的结果里飞出来、一圈圈弹开排成墙，
// 再收进一扇浏览器窗口（11×5），最后各自飞回手机首页上自己分类的那一格
import type { CSSProperties } from 'react';
import { E, bump, center, clamp, mixColor, mixRect, prog, rand, rect, spring, tw, type Rect } from '../lib/anim';
import { Chars, Draw, Led, ToolGlyph, at, pose, rise } from '../lib/kit';
import { CatIcon } from '../../src/components/ToolIcon';
import { DisplayIcon, LogoMark, ShieldIcon } from '../../src/components/ui';
import { CATEGORIES } from '../../src/tools';
import { READY, WALL, WIN, mCat, palGlyph, ptoW, wallKey, winKey } from '../layout';
import { PAL_OUT, T } from '../timeline';
import { PAL_RESULTS } from './Palette';

const W0 = PAL_OUT;
const WAVES = [T.wall + 0.75, T.wall + 2.2];
const PV = T.privacy;
const PH = T.phone;
export const OFFLINE = PV + 3.1;
const GREEN = '#22B35E';
const KEY = 52;
const KEY_SHADOW = 'inset 0 -2px 0 rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.06), 0 10px 20px -12px rgba(0,0,0,0.32)';

const ORIGIN = center(wallKey('image-compress'));
const META = READY.map((tool) => {
  const cat = CATEGORIES.findIndex((c) => c.id === tool.cat);
  const k = READY.filter((x) => x.cat === tool.cat).indexOf(tool);
  const wall = wallKey(tool.id);
  const c = center(wall);
  return { tool, cat, k, wall, d: Math.hypot(c.x - ORIGIN.x, c.y - ORIGIN.y), led: CATEGORIES[cat].led };
});
// 手机首页上每个分类那一格里的小键帽（舞台坐标）
export const tileGlyph = (cat: number) => {
  const m = mCat(cat);
  return ptoW(rect(m.x + 14, m.y + 12, 30, 30));
};
// 最后一批键帽落进格子的时刻：之后由手机首页接手
export const KEYS_DONE = PH + 1.25;

function keyAt(i: number, t: number) {
  const { tool, cat, k, wall, d } = META[i];
  let r: Rect = wall,
    o = 1,
    s = 1,
    flat = 0; // 1 = ⌘K 里那种扁平小键帽
  const j = PAL_RESULTS.indexOf(tool.id);
  if (j >= 0) {
    const p = spring(t - (W0 + j * 0.045), { w: 8, z: 0.8 });
    r = mixRect(palGlyph(j), wall, p);
    flat = 1 - clamp(p);
    o = t >= W0 ? 1 : 0;
  } else {
    const st = W0 + 0.14 + d / 1500;
    s = 0.3 + 0.7 * spring(t - st, { w: 12, z: 0.62 });
    o = t < st ? 0 : clamp(prog(t, st, st + 0.16));
  }
  // 两道波浪从左往右扫过
  let hop = 0;
  for (const w of WAVES) hop += bump(t, w + k * 0.045 + cat * 0.03, 0.55);
  r = { ...r, y: r.y - 7 * hop };
  // 收进窗口
  const pw = spring(t - (PV + 0.06 + i * 0.006), { w: 8, z: 0.84 });
  r = mixRect(r, winKey(i), pw);
  // 飞回手机上自己的分类
  const pp = spring(t - (PH + 0.12 + cat * 0.05 + k * 0.022), { w: 8.5, z: 0.88 });
  r = mixRect(r, tileGlyph(cat), pp);
  if (k > 0) o *= 1 - clamp((pp - 0.55) / 0.35);
  return { r, o, s, flat, hop, pp, pw };
}

function Keys({ t }: { t: number }) {
  if (t < W0 || t > KEYS_DONE) return null;
  return (
    <>
      {META.map((m, i) => {
        const st = keyAt(i, t);
        if (st.o <= 0.001) return null;
        const c = center(st.r);
        const scale = (st.r.w / KEY) * st.s;
        // 灯：墙上常亮一点，波浪扫过时更亮；窗口里随机闪，像在干活
        const work = bump(t, PV + 1.0 + rand(i) * 2.2, 0.5) + bump(t, PV + 3.4 + rand(i + 99) * 1.5, 0.5);
        const glow = 0.35 + 0.65 * st.hop + work * (1 - clamp(st.pp));
        const cat = st.pp > 0.45 ? 1 : 0;
        const bg = mixColor('#F4F3F0', '#FFFFFF', (1 - st.flat) * (1 - clamp(st.pp)));
        const shadow = (1 - st.flat) * (1 - clamp(st.pp));
        return (
          <div
            key={m.tool.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: KEY,
              height: KEY,
              transform: `translate(${(c.x - KEY / 2).toFixed(2)}px, ${(c.y - KEY / 2).toFixed(2)}px) scale(${scale.toFixed(4)})`,
              opacity: st.o,
              zIndex: 30
            }}
          >
            <ToolGlyph
              id={m.tool.id}
              size={KEY}
              radius={14 + 4 * st.flat}
              icon={24}
              style={{
                background: bg,
                boxShadow: shadow > 0.02 ? KEY_SHADOW : 'var(--glyph-shadow)',
                position: 'absolute',
                inset: 0,
                fontSize: 20
              }}
            />
            {cat > 0 && (
              <span className="glyph" style={{ position: 'absolute', inset: 0, width: KEY, height: KEY, borderRadius: 14, background: bg, boxShadow: 'var(--glyph-shadow)', opacity: clamp((st.pp - 0.45) / 0.25) }}>
                <CatIcon id={CATEGORIES[m.cat].id} size={28} />
              </span>
            )}
            <Led
              color={m.led}
              size={6}
              glow={glow}
              style={{ position: 'absolute', left: KEY * 0.8125 - 3, top: KEY * 0.1875 - 3, opacity: (1 - st.flat) * (1 - clamp(st.pp * 2)) }}
            />
          </div>
        );
      })}
    </>
  );
}

// ———— 工具墙的标题和分类名 ————
function WallText({ t }: { t: number }) {
  if (t < W0 || t > PV + 0.8) return null;
  return (
    <>
      <div style={{ ...at(720, 150, { anchor: 'center' }), fontSize: 46, fontWeight: 600, letterSpacing: '-0.02em', zIndex: 31 }}>
        <Chars text="55 个工具，全都不用上传。" t={t} at={W0 + 0.3} stagger={0.03} dur={0.7} rise={18} out={[PV, 0.3]} />
      </div>
      {CATEGORIES.map((c, r) => {
        const v = rise(t, W0 + 0.35 + r * 0.05, 0.6, 0, 4);
        const x = (1 - E.soft(prog(t, W0 + 0.35 + r * 0.05, W0 + 0.95 + r * 0.05))) * -16;
        const out = tw(t, PV + r * 0.03, PV + 0.3 + r * 0.03, E.in2);
        const n = READY.filter((x) => x.cat === c.id).length;
        return (
          <div
            key={c.id}
            style={{
              ...at(WALL.x - WALL.label + x - 12 * out, WALL.y + r * WALL.row + WALL.key / 2, { o: v.o * (1 - out), blur: v.blur + 4 * out }),
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 31
            }}
          >
            <Led color={c.led} size={7} glow={0.6} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>{c.name}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{n} 个</span>
          </div>
        );
      })}
    </>
  );
}

// ———— 隐私：窗口里的东西（窗口本身由手机那场的 Device 画），左边的文案 ————
function WifiGlyph({ off, size = 18 }: { off: number; size?: number }) {
  const arc = (k: number) => 1 - clamp(off * 3 - k);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 8.5a15 15 0 0 1 20 0" opacity={0.25 + 0.75 * arc(0)} />
      <path d="M5.5 12a10 10 0 0 1 13 0" opacity={0.25 + 0.75 * arc(0.6)} />
      <path d="M9 15.5a5 5 0 0 1 6 0" opacity={0.25 + 0.75 * arc(1.2)} />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" opacity={0.25 + 0.75 * arc(1.8)} />
      {off > 0 && <path d="M4 3.5l16 17" strokeDasharray="1 2" pathLength={1} strokeDashoffset={1 - E.inOut2(clamp(off * 1.6 - 0.6))} />}
    </svg>
  );
}

function Window({ t }: { t: number }) {
  if (t < PV || t > PH + 0.4) return null;
  const o = tw(t, PV + 0.35, PV + 0.65, E.out2) * (1 - tw(t, PH, PH + 0.2, E.out2));
  const off = clamp(prog(t, OFFLINE, OFFLINE + 0.6));
  const meter = rise(t, PV + 0.75, 0.6, 10, 0);
  const line = E.inOut2(prog(t, PV + 0.9, OFFLINE + 1.6));
  const M = rect(WIN.x + 24, WIN.y + 322, WIN.w - 48, 92);
  const lx = M.x + 190,
    lw = M.w - 190 - 22,
    ly = M.y + 62;
  const toast = rise(t, OFFLINE + 0.25, 0.6, 12, 4);
  const z: CSSProperties = { zIndex: 25 };
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ ...pose(rect(WIN.x + 18 + i * 20, WIN.y + 20, 12, 12), { o }), borderRadius: '50%', background: ['#FF5F57', '#FEBC2E', '#28C840'][i], ...z }} />
      ))}
      <div
        style={{
          ...pose(rect(WIN.x + 150, WIN.y + 11, 260, 30), { o }),
          borderRadius: 9,
          background: 'var(--track)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          ...z
        }}
      >
        <span style={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
          <LogoMark size={16} />
        </span>
        顺手 · 全部工具
      </div>
      <span style={{ ...at(WIN.x + WIN.w - 22, WIN.y + 26, { anchor: 'right', o }), display: 'flex', color: off > 0 ? 'var(--ink-3)' : 'var(--ink-2)', ...z }}>
        <WifiGlyph off={off} />
      </span>
      <span style={{ ...pose(rect(WIN.x, WIN.y + 52, WIN.w, 0.5), { o }), background: 'var(--divider)', ...z }} />
      {/* 上传流量：一条一直贴着 0 的线 */}
      <div style={{ ...pose(M, { o: o * meter.o }), transform: `translate(${M.x}px, ${M.y + meter.y}px)`, borderRadius: 16, background: 'var(--bg-warm)', ...z }}>
        <span style={{ position: 'absolute', left: 18, top: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)' }}>
          <Led color={GREEN} size={6} glow={0.7} />
          上传到服务器
        </span>
        <span style={{ position: 'absolute', left: 18, top: 38, fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>0 B</span>
        <svg width={lw + 10} height={60} style={{ position: 'absolute', left: lx - M.x, top: 14, overflow: 'visible' }}>
          {[0, 1, 2].map((g) => (
            <path key={g} d={`M0 ${8 + g * 20}H${lw}`} stroke="var(--divider)" strokeWidth="0.5" strokeDasharray="2 4" />
          ))}
          <path d={`M0 ${ly - M.y - 14}H${lw * line}`} stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
          {line > 0 && <circle cx={lw * line} cy={ly - M.y - 14} r={4} fill={GREEN} style={{ filter: `drop-shadow(0 0 4px ${GREEN})` }} />}
        </svg>
      </div>
      {/* 断网 */}
      <div
        style={{
          ...at(WIN.x + WIN.w / 2, WIN.y + WIN.h + 38 + toast.y, { anchor: 'center', o: toast.o * o, blur: toast.blur }),
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 40,
          padding: '0 18px 0 14px',
          borderRadius: 999,
          background: 'var(--surface)',
          boxShadow: '0 0 0 0.5px var(--hairline), 0 10px 30px -10px rgba(0,0,0,0.25)',
          fontSize: 14,
          ...z
        }}
      >
        <span style={{ display: 'flex', color: 'var(--ink-2)' }}>
          <WifiGlyph off={1} size={16} />
        </span>
        已断网，工具照常能用
      </div>
    </>
  );
}

function PrivacyText({ t }: { t: number }) {
  if (t < PV || t > PH + 0.8) return null;
  const x = 120;
  const out = tw(t, PH, PH + 0.3, E.in2);
  const lede = rise(t, PV + 1.0, 0.7);
  const pillars = [
    { icon: <DisplayIcon size={20} />, title: '在本机处理', desc: '由浏览器里的 WebAssembly 和 Web Worker 处理。' },
    { icon: <ShieldIcon size={20} />, title: '不留痕迹', desc: '不用账号，没有追踪，记录只存在本机。' },
    { icon: <WifiGlyph off={0} size={20} />, title: '断网也能用', desc: '用过的工具，断网照样能用。' }
  ];
  const h: CSSProperties = { fontSize: 52, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 };
  return (
    <>
      <div style={{ ...at(x, 262), ...h }}>
        <Chars text="你的文件，" t={t} at={PV + 0.45} stagger={0.04} dur={0.75} rise={20} out={[PH, 0.3]} />
      </div>
      <div style={{ ...at(x, 326), ...h }}>
        <Chars text="从不离开你的设备。" t={t} at={PV + 0.62} stagger={0.04} dur={0.75} rise={20} out={[PH + 0.06, 0.3]} />
      </div>
      <div style={{ ...at(x, 394 + lede.y, { o: lede.o * (1 - out), blur: lede.blur }), fontSize: 18, color: 'var(--ink-2)' }}>
        服务器只负责把网页交给你，之后每一步都在你的浏览器里。
      </div>
      {pillars.map((p, k) => {
        const v = rise(t, PV + 1.25 + k * 0.12, 0.6, 10);
        const hi = k === 2 ? bump(t, OFFLINE + 0.1, 1.2) : 0;
        return (
          <div key={k} style={{ ...at(x, 470 + k * 64 + v.y, { o: v.o * (1 - out), blur: v.blur }), display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                background: `color-mix(in srgb, var(--accent) ${Math.round(10 + 14 * hi)}%, transparent)`,
                transform: `scale(${1 + 0.08 * hi})`
              }}
            >
              {k === 0 ? (
                <Draw p={prog(t, PV + 1.3, PV + 2.0)}>{p.icon}</Draw>
              ) : (
                p.icon
              )}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <b style={{ fontSize: 16, fontWeight: 600 }}>{p.title}</b>
              <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{p.desc}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

export function Wall({ t }: { t: number }) {
  if (t < W0 || t > PH + 1.4) return null;
  return (
    <>
      <WallText t={t} />
      <PrivacyText t={t} />
      <Window t={t} />
      <Keys t={t} />
    </>
  );
}

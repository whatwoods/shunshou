// 后半段：浏览器窗口 → 手机 → 标志。窗口、手机外壳、标志的橙色底是同一块东西一路变过来；
// 手机首页上六个分类格，下面四格最后变成标志上的四个方块（图像那格带着绿灯，正好落在左上）
import type { CSSProperties, ReactNode } from 'react';
import { E, bump, clamp, inflate, lerp, mixColor, mixRect, prog, rect, sp, spring, tw, union, type Rect } from '../lib/anim';
import { Chars, Led, MorphGlass, at, pose, rise } from '../lib/kit';
import { useThemeHere } from '../lib/theme';
import { CatIcon, KindIcon, ToolIcon } from '../../src/components/ToolIcon';
import { ClockIcon, FileIcon, HomeIcon, SearchIcon, StarIcon } from '../../src/components/ui';
import { CATEGORIES, toolById } from '../../src/tools';
import { ISLAND, LOGO_END, M_TOP, PHONE, READY, SCREEN, SCREEN_R, WIN, mCat, ptoW, wallKey } from '../layout';
import { T } from '../timeline';
import { KEYS_DONE } from './Wall';

const PV = T.privacy,
  PH = T.phone,
  DK = T.dark,
  FI = T.finale;
export const LIGHT_AT = FI + 1.3; // 标志的绿灯亮起，浅色从这里扫回来
const GREEN = '#22B35E';
const WALL_BOX = inflate(union(READY.map((x) => wallKey(x.id))), 24);
export const ISLAND_W = (() => {
  const r = ptoW(ISLAND);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
})();
export const LOGO_LED = LOGO_END.led;

// ———— 外壳：窗口 → 手机 → 标志底 ————
function deviceAt(t: number) {
  const a = spring(t - (PV + 0.04), { w: 7.5, z: 0.86 });
  let r = mixRect(WALL_BOX, WIN, a);
  let radius = lerp(30, 16, clamp(a));
  const b = spring(t - (PH + 0.04), { w: 7, z: 0.84 });
  r = mixRect(r, PHONE, b);
  radius = lerp(radius, SCREEN_R + (PHONE.w - SCREEN.w) / 2, clamp(b));
  const c = spring(t - (FI + 0.12), { w: 7.5, z: 0.8 });
  r = mixRect(r, LOGO_END.base, c);
  radius = lerp(radius, LOGO_END.r, clamp(c));
  return { r, radius, a, b: clamp(b), c: clamp(c) };
}
// 屏幕永远是外壳往里缩一圈边框：外壳怎么变，屏幕就怎么跟
const BZ = (PHONE.w - SCREEN.w) / 2;
const screenAt = (t: number) => {
  const d = deviceAt(t);
  const k = d.b * (1 - d.c);
  return { r: inflate(d.r, -BZ * k), radius: Math.max(0, d.radius - BZ * k), d };
};

function Device({ t }: { t: number }) {
  const o = tw(t, PV, PV + 0.25, E.out2);
  if (o <= 0) return null;
  const { r, radius, b, c } = deviceAt(t);
  const w1 = 1 - b,
    w2 = b * (1 - c),
    w3 = c;
  const shine = prog(t, FI + 3.2, FI + 4.1);
  return (
    <div
      style={{
        ...pose(r, { o, z: 20 }),
        borderRadius: radius,
        // 屏幕先铺满，外壳的黑色晚一点才出来，只露在边框那一圈：中间不会出现一整块灰
        background: mixColor('#FFFFFF', '#1B1B1D', clamp((b - 0.25) / 0.5)),
        boxShadow: [
          `0 0 0 ${(0.5 + b).toFixed(2)}px rgba(40,40,42,${(0.08 * w1 + 0.9 * w2).toFixed(3)})`,
          `0 40px 90px -36px rgba(0,0,0,${(0.38 * w1 + 0.55 * w2).toFixed(3)})`,
          `0 21px 45px -18px rgba(227,91,34,${(0.55 * w3).toFixed(3)})`
        ].join(', '),
        overflow: 'hidden'
      }}
    >
      {c > 0 && (
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #F88A54, #E35B22)', opacity: clamp(c * 1.6) }}>
          {shine > 0 && shine < 1 && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.32) 50%, transparent 65%)',
                transform: `translateX(${lerp(-120, 220, E.inOut2(shine))}%)`
              }}
            />
          )}
        </span>
      )}
    </div>
  );
}

// ———— 手机首页（390×844 的手机坐标，整体缩放进屏幕） ————
const scrollAt = (t: number) => sp(t, 0, [[PH + 2.0, 132, { w: 5, z: 1 }], [FI - 1.5, 0, { w: 5.5, z: 1 }]]);
const tileIn = (i: number) => PH + 0.6 + i * 0.05;
const TILE_LIST = ['image-compress', 'pdf-merge', 'image-convert', 'pdf-compress'];

function Abs({ r, children, style }: { r: Rect; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, ...style }}>{children}</div>;
}

function Tile({ i, t, p = 1, content = 1, bare }: { i: number; t: number; p?: number; content?: number; bare?: boolean }) {
  const c = CATEGORIES[i];
  const n = READY.filter((x) => x.cat === c.id).length;
  const m = mCat(i);
  const g = rect(m.x + 14, m.y + 12, 30, 30);
  const r = mixRect(g, m, p);
  const lp = clamp(p);
  const text = content * clamp(prog(t, tileIn(i) + 0.2, tileIn(i) + 0.5));
  return (
    <>
      {!bare && <Abs r={r} style={{ borderRadius: lerp(8, 20, lp), background: 'var(--surface)', opacity: clamp(p * 3) }} />}
      <span className="glyph" style={{ position: 'absolute', left: g.x, top: g.y, width: 30, height: 30, borderRadius: 8, opacity: content }}>
        <CatIcon id={c.id} size={16} />
      </span>
      <Led color={c.led} size={6} glow={0.6} style={{ position: 'absolute', left: m.x + 152, top: m.y + 14, opacity: text }} />
      <span style={{ position: 'absolute', left: m.x + 14, top: m.y + 50, fontSize: 17, fontWeight: 700, opacity: text }}>{c.name}</span>
      <span style={{ position: 'absolute', right: 390 - (m.x + m.w - 14), top: m.y + 53, fontSize: 13, color: 'var(--ink-2)', opacity: text }}>{n} 个</span>
    </>
  );
}

function StatusBar() {
  return (
    <>
      <span style={{ position: 'absolute', left: 44, top: 16, fontSize: 16, fontWeight: 600, letterSpacing: '0.01em' }}>9:41</span>
      <svg width="70" height="14" viewBox="0 0 70 14" style={{ position: 'absolute', right: 30, top: 20 }} fill="currentColor">
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={k * 5} y={10 - k * 3} width="3.4" height={4 + k * 3} rx="1" />
        ))}
        <path d="M30 4.6a8.6 8.6 0 0 1 11.6 0l-1.2 1.3a6.8 6.8 0 0 0-9.2 0zM32.4 7.3a5.2 5.2 0 0 1 6.8 0l-1.2 1.3a3.4 3.4 0 0 0-4.4 0zM34.6 10a1.6 1.6 0 0 1 2.4 0L35.8 11.3z" />
        <rect x="46.5" y="1.5" width="20" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        <rect x="48.5" y="3.5" width="16" height="7" rx="1.8" />
        <rect x="67.6" y="5" width="1.6" height="4" rx="0.8" fillOpacity="0.4" />
      </svg>
    </>
  );
}

function PhoneUI({ t }: { t: number }) {
  const v = (k: number) => rise(t, PH + 0.42 + k * 0.05, 0.6, 12, 0);
  const scroll = scrollAt(t);
  const top = M_TOP;
  const hide = t >= FI; // 结尾：分类格交给舞台上的那一份
  const tabs = rise(t, PH + 0.75, 0.7, 30, 0);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)`, maskImage: 'linear-gradient(180deg, transparent 0, transparent 46px, #000 60px)' }}>
        {(() => {
          const a = v(0);
          return (
            <div style={{ position: 'absolute', left: 20, top: top + 12 + a.y, opacity: a.o, fontSize: 34, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.1 }}>
              顺手
            </div>
          );
        })()}
        {(() => {
          const a = v(1);
          return (
            <div style={{ position: 'absolute', left: 20, top: top + 58 + a.y, opacity: a.o, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'var(--ink-2)' }}>
              <Led color={GREEN} size={7} glow={0.6} />
              55 个工具 · 文件只在这台手机上处理
            </div>
          );
        })()}
        {(() => {
          const a = v(2);
          return (
            <Abs
              r={rect(16, top + 92 + a.y, 358, 40)}
              style={{ opacity: a.o, borderRadius: 12, background: 'var(--seg-track)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontSize: 17, color: 'var(--ink-3)' }}
            >
              <SearchIcon size={18} />
              搜索工具
            </Abs>
          );
        })()}
        {(() => {
          const a = v(3);
          return (
            <Abs
              r={rect(16, top + 145 + a.y, 358, 88)}
              style={{
                opacity: a.o,
                borderRadius: 20,
                background: 'var(--surface)',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), 0 8px 24px -14px rgba(240,106,48,0.45)'
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 16,
                  top: 22,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, #F88A54, #E35B22)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 14px -6px rgba(227,91,34,0.7)'
                }}
              >
                <FileIcon size={22} />
              </span>
              <b style={{ position: 'absolute', left: 72, top: 18, fontSize: 17, fontWeight: 700 }}>打开任意文件</b>
              <span style={{ position: 'absolute', left: 72, top: 44, width: 168, fontSize: 13, lineHeight: 1.35, color: 'var(--ink-2)', whiteSpace: 'normal' }}>
                自动认出类型，推荐能用的工具
              </span>
              {(['doc', 'image', 'video'] as const).map((k, j) => (
                <span key={k} className="glyph" style={{ position: 'absolute', left: 250 + j * 32, top: 30, width: 28, height: 28, borderRadius: 8 }}>
                  <KindIcon kind={k} size={14} />
                </span>
              ))}
            </Abs>
          );
        })()}
        <div style={{ position: 'absolute', left: 36, top: top + 254, fontSize: 13, color: 'var(--ink-2)', opacity: v(4).o }}>分类</div>
        {!hide &&
          CATEGORIES.map((_, i) => {
            // 键帽落进格子以后，白底从小键帽那里撑开
            const p = spring(t - tileIn(i), { w: 9, z: 0.8 });
            if (t < tileIn(i) && t < KEYS_DONE) return null;
            return <Tile key={i} i={i} t={t} p={p} content={t >= KEYS_DONE - 0.02 ? 1 : 0} />;
          })}
        <div style={{ position: 'absolute', left: 36, top: top + 594, fontSize: 13, color: 'var(--ink-2)', opacity: v(7).o }}>常用</div>
        {(() => {
          const a = v(8);
          return (
            <Abs r={rect(16, top + 614 + a.y, 358, 52 * 4)} style={{ opacity: a.o, borderRadius: 20, background: 'var(--surface)' }}>
              {TILE_LIST.map((id, j) => (
                <div key={id} style={{ position: 'absolute', left: 0, right: 0, top: j * 52, height: 52, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px 0 12px' }}>
                  <span className="glyph" style={{ width: 30, height: 30, borderRadius: 8 }}>
                    <ToolIcon id={id} size={16} />
                  </span>
                  <span style={{ flex: '1 1 auto', fontSize: 17 }}>{toolById(id)!.name}</span>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 1.5L6.5 7l-5 5.5" />
                  </svg>
                  {j > 0 && <span style={{ position: 'absolute', left: 56, right: 0, top: 0, height: 0.5, background: 'var(--divider)' }} />}
                </div>
              ))}
            </Abs>
          );
        })()}
      </div>
      {/* 底部的玻璃标签栏 */}
      <MorphGlass
        w={284}
        h={62}
        r={31}
        style={{ position: 'absolute', left: 16, top: 0, transform: `translateY(${748 + tabs.y}px)`, opacity: tabs.o, zIndex: 3 }}
      >
        <span style={{ position: 'absolute', left: 6, top: 6, width: 90, height: 50, borderRadius: 25, background: 'color-mix(in srgb, var(--accent) 13%, transparent)' }} />
        {[
          { icon: <HomeIcon size={22} />, label: '工具' },
          { icon: <ClockIcon size={22} />, label: '最近' },
          { icon: <StarIcon size={22} />, label: '收藏' }
        ].map((tab, j) => (
          <span
            key={tab.label}
            style={{
              position: 'absolute',
              left: 6 + j * 90.7,
              top: 6,
              width: 90,
              height: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              fontSize: 11,
              fontWeight: 600,
              color: j === 0 ? 'var(--accent)' : 'var(--ink)'
            }}
          >
            {tab.icon}
            {tab.label}
          </span>
        ))}
      </MorphGlass>
      <MorphGlass
        w={62}
        h={62}
        r={31}
        style={{
          position: 'absolute',
          left: 312,
          top: 0,
          transform: `translateY(${748 + tabs.y}px)`,
          opacity: tabs.o,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <SearchIcon size={22} />
      </MorphGlass>
      <StatusBar />
      <span style={{ position: 'absolute', left: ISLAND.x, top: ISLAND.y, width: ISLAND.w, height: ISLAND.h, borderRadius: 999, background: '#000', zIndex: 4 }} />
      <span style={{ position: 'absolute', left: 128, top: 831, width: 134, height: 5, borderRadius: 3, background: 'var(--ink)', zIndex: 4 }} />
    </>
  );
}

function Screen({ t }: { t: number }) {
  const { r, radius, d } = screenAt(t);
  const o = clamp(d.b * 3) * (1 - tw(t, FI, FI + 0.3, E.out2));
  if (o <= 0) return null;
  const k = r.w / 390;
  return (
    <div style={{ ...pose(r, { o, z: 21 }), borderRadius: radius, overflow: 'hidden', background: 'var(--bg-warm)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 844, transform: `scale(${k.toFixed(4)})`, transformOrigin: '0 0', color: 'var(--ink)' }}>
        {t >= PH + 0.2 && <PhoneUI t={t} />}
      </div>
    </div>
  );
}

// ———— 结尾：下面四个分类格变成标志的四个方块 ————
// 第二、三排的四格对上左上、右上、左下、右下；图像（绿灯）正好在左上
const TO_SQ: Record<number, number> = { 2: 0, 3: 1, 4: 2, 5: 3 };
// 舞台上的一格：外框按舞台坐标变形，里面的字照手机坐标画好再整体缩放
function TileView({ i, t, r, fade, style, o = 1, s = 1, blur = 0 }: { i: number; t: number; r: Rect; fade: number; style: CSSProperties; o?: number; s?: number; blur?: number }) {
  const m = mCat(i);
  return (
    <div style={{ ...pose(r, { o, s, blur, z: 22 }), overflow: 'hidden', ...style }}>
      {fade > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: m.w, height: m.h, transform: `scale(${(r.w / m.w).toFixed(4)}, ${(r.h / m.h).toFixed(4)})`, transformOrigin: '0 0', opacity: fade }}>
          <div style={{ position: 'absolute', left: -m.x, top: -m.y, width: 390, height: 844 }}>
            <Tile i={i} t={t} bare />
          </div>
        </div>
      )}
    </div>
  );
}
function FinaleTiles({ t }: { t: number }) {
  const dark = useThemeHere() === 'dark';
  if (t < FI || t > T.end) return null;
  const surface = dark ? '#222120' : '#FFFFFF';
  const fade = 1 - tw(t, FI + 0.02, FI + 0.22, E.out2);
  return (
    <>
      {CATEGORIES.map((c, i) => {
        const tile = ptoW(mCat(i));
        const sq = TO_SQ[i];
        if (sq === undefined) {
          const q = tw(t, FI, FI + 0.35, E.in2);
          if (q >= 1) return null;
          return <TileView key={c.id} i={i} t={t} r={{ ...tile, y: tile.y - 20 * q }} fade={1} o={1 - q} s={1 - 0.2 * q} blur={6 * q} style={{ borderRadius: 16, background: 'var(--surface)' }} />;
        }
        const p = spring(t - (FI + 0.14 + sq * 0.05), { w: 8, z: 0.8 });
        const alpha = sq === 0 ? 1 : 0.42;
        return (
          <TileView
            key={c.id}
            i={i}
            t={t}
            r={mixRect(tile, LOGO_END.sq[sq], p)}
            fade={fade}
            style={{ borderRadius: lerp(16, LOGO_END.sr, clamp(p)), background: mixColor(surface, `rgba(255,255,255,${alpha})`, clamp(prog(t, FI + 0.1, FI + 0.6))) }}
          />
        );
      })}
      <FinaleLed t={t} />
    </>
  );
}
// 图像那格的绿灯落到标志上
function FinaleLed({ t }: { t: number }) {
  const m = mCat(2);
  const from = ptoW(rect(m.x + 152, m.y + 14, 6, 6));
  const p = spring(t - (FI + 0.14), { w: 8, z: 0.8 });
  const d = lerp(from.w, LOGO_LED.d, clamp(p));
  const x = lerp(from.x + from.w / 2, LOGO_LED.x, p),
    y = lerp(from.y + from.h / 2, LOGO_LED.y, p);
  const flash = bump(t, LIGHT_AT - 0.15, 0.6);
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
          boxShadow: `0 0 ${(d * (0.8 + 1.6 * flash)).toFixed(1)}px rgba(34,179,94,0.9)`,
          transform: `scale(${1 + 0.5 * flash})`,
          zIndex: 23
        }}
      />
      {t > LIGHT_AT - 0.1 && t < LIGHT_AT + 0.9 && (
        <span
          style={{
            position: 'absolute',
            left: LOGO_LED.x - 40,
            top: LOGO_LED.y - 40,
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '1.5px solid rgba(34,179,94,0.6)',
            transform: `scale(${0.2 + E.out3(prog(t, LIGHT_AT - 0.1, LIGHT_AT + 0.9)) * 1.6})`,
            opacity: 1 - prog(t, LIGHT_AT - 0.1, LIGHT_AT + 0.9),
            zIndex: 23
          }}
        />
      )}
    </>
  );
}

// ———— 文案：手机 → 深色 → 结尾 ————
function SideText({ t }: { t: number }) {
  if (t < PH || t > FI + 0.6) return null;
  const x = 180;
  const h: CSSProperties = { fontSize: 50, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 };
  const sub1 = rise(t, PH + 0.95, 0.7);
  const sub1Out = tw(t, DK + 0.3, DK + 0.6, E.in2);
  const sub2 = rise(t, DK + 0.95, 0.7);
  const sub2Out = tw(t, FI, FI + 0.3, E.in2);
  const s: CSSProperties = { fontSize: 19, color: 'var(--ink-2)' };
  return (
    <>
      <div style={{ ...at(x, 372), ...h }}>
        <Chars text="手机上，也一样顺手。" t={t} at={PH + 0.5} stagger={0.04} dur={0.75} rise={20} out={[DK + 0.3, 0.3]} />
      </div>
      <div style={{ ...at(x, 440 + sub1.y - 10 * sub1Out, { o: sub1.o * (1 - sub1Out), blur: sub1.blur + 4 * sub1Out }), ...s }}>同一个网站，手机上打开就能用。</div>
      <div style={{ ...at(x, 372), ...h }}>
        <Chars text="深色模式，跟着系统走。" t={t} at={DK + 0.55} stagger={0.04} dur={0.75} rise={20} out={[FI, 0.3]} />
      </div>
      <div style={{ ...at(x, 440 + sub2.y - 10 * sub2Out, { o: sub2.o * (1 - sub2Out), blur: sub2.blur + 4 * sub2Out }), ...s }}>系统换成深色，它也跟着换。</div>
    </>
  );
}

function EndText({ t }: { t: number }) {
  if (t < LIGHT_AT) return null;
  const tag = rise(t, LIGHT_AT + 0.75, 0.8);
  return (
    <>
      <div style={{ ...at(720, 452, { anchor: 'center' }), fontSize: 64, fontWeight: 700, letterSpacing: '0.04em' }}>
        <Chars text="顺手" t={t} at={LIGHT_AT + 0.4} stagger={0.08} dur={0.9} rise={24} blur={10} />
      </div>
      <div style={{ ...at(720, 516 + tag.y, { anchor: 'center', o: tag.o, blur: tag.blur }), fontSize: 22, color: 'var(--ink-2)' }}>顺手的小工具，全在浏览器里。</div>
      <div style={{ ...at(720, 578, { anchor: 'center' }), display: 'flex', gap: 22, fontSize: 14, color: 'var(--ink-2)' }}>
        {CATEGORIES.map((c, k) => {
          const v = rise(t, LIGHT_AT + 1.1 + k * 0.07, 0.6, 8);
          const glow = bump(t, LIGHT_AT + 2.2 + k * 0.09, 0.6);
          return (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: v.o, transform: `translateY(${v.y}px)` }}>
              <Led color={c.led} size={6} glow={0.4 + 0.8 * glow} />
              {c.name}
            </span>
          );
        })}
      </div>
    </>
  );
}

// 手机以后的整段（深色、浅色各画一份，靠圆形裁切拼在一起）
export function Late({ t }: { t: number }) {
  if (t < PV) return null;
  return (
    <>
      {t >= PH && <div className="layer" style={{ background: 'var(--bg-warm)' }} />}
      <Device t={t} />
      <Screen t={t} />
      <FinaleTiles t={t} />
      <SideText t={t} />
      <EndText t={t} />
    </>
  );
}

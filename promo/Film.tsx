// 整部片子：按时间把各场叠起来。每场自己决定什么时候出现、什么时候退场
import { E, tw } from './lib/anim';
import { Cursor } from './lib/kit';
import { ThemeCtx } from './lib/theme';
import { T, cursorAt } from './timeline';
import { CopyBadge, Intro } from './scenes/Intro';
import { Bench } from './scenes/Bench';
import { Palette } from './scenes/Palette';
import { Wall } from './scenes/Wall';
import { ISLAND_W, LIGHT_AT, LOGO_LED, Late } from './scenes/Phone';

// 工具页的暖灰底：首页卡片铺满舞台以后接过来
function PageBg({ t }: { t: number }) {
  if (t < T.bench + 0.9 || t > T.phone + 0.5) return null;
  return <div className="layer" style={{ background: 'var(--bg-warm)' }} />;
}

// 深色从手机的灵动岛扫开，结尾浅色从标志的绿灯扫回来（和网站切换深浅色同一个手法）
const SWEEP = 1.15;
const radius = (t: number, at: number) => tw(t, at, at + SWEEP, E.theme) * 1700;
const circle = (r: number, c: { x: number; y: number }) => `circle(${r.toFixed(1)}px at ${c.x.toFixed(1)}px ${c.y.toFixed(1)}px)`;

function Stage2({ t }: { t: number }) {
  return (
    <div className="layer" style={{ zIndex: 60 }}>
      <Late t={t} />
      <Wall t={t} />
    </div>
  );
}

export function Film({ t }: { t: number }) {
  const c = cursorAt(t);
  const sweeping = t >= T.dark && t < LIGHT_AT + SWEEP;
  const end = tw(t, T.end - 0.75, T.end - 0.05, E.inOut2);
  return (
    <div className="layer">
      <PageBg t={t} />
      <Intro t={t} />
      <Bench t={t} />
      <Palette t={t} />
      <Stage2 t={t} />
      {sweeping && (
        <ThemeCtx.Provider value="dark">
          <div className="layer dark-scope" style={{ zIndex: 70, clipPath: circle(radius(t, T.dark), ISLAND_W) }}>
            <Late t={t} />
          </div>
        </ThemeCtx.Provider>
      )}
      {sweeping && t >= LIGHT_AT && (
        <div className="layer" style={{ zIndex: 71, clipPath: circle(radius(t, LIGHT_AT), LOGO_LED) }}>
          <Late t={t} />
        </div>
      )}
      {end > 0 && <div className="layer" style={{ zIndex: 90, background: 'var(--bg)', opacity: end }} />}
      <Cursor x={c.x} y={c.y} press={c.press} o={c.o} />
      <CopyBadge t={t} />
    </div>
  );
}

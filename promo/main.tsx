import { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '../src/styles.css';
import './promo.css';
import { installDarkScope } from './lib/theme';
import { Film } from './Film';
import { DURATION, CHAPTERS } from './timeline';

// 舞台是 1440×810 的 CSS 像素；导出时用 4/3 的设备像素比截成 1920×1080，文字和线条都是原生清晰度
const W = 1440,
  H = 810;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const BAR = RENDER ? 0 : 64;

declare global {
  interface Window {
    __promo?: { duration: number; seek: (t: number) => Promise<void>; ready: Promise<void> };
  }
}

function App() {
  const [t, setT] = useState(() => Number(params.get('t') ?? 0));
  const [playing, setPlaying] = useState(!RENDER && !params.has('t'));
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const f = () => setFit(Math.min(innerWidth / W, (innerHeight - BAR) / H));
    f();
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);

  // 实时播放：按真实时间往前走，到头从头再来
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((v) => (v + dt >= DURATION ? 0 : v + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // 逐帧导出用：跳到某一时刻，等浏览器画完两帧再返回
  useEffect(() => {
    window.__promo = {
      duration: DURATION,
      ready: document.fonts.ready.then(() => undefined),
      seek: (v) =>
        new Promise((resolve) => {
          flushSync(() => setT(v));
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    };
  }, []);

  useEffect(() => {
    if (RENDER) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        const d = (e.shiftKey ? 1 : 1 / 60) * (e.key === 'ArrowRight' ? 1 : -1);
        setT((v) => Math.min(DURATION, Math.max(0, v + d)));
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  return (
    <>
      <div className={'viewport' + (RENDER ? ' is-render' : '')}>
        <div style={{ width: W * fit, height: H * fit, position: 'relative' }}>
          <div className="film" style={{ transform: fit === 1 ? undefined : `scale(${fit})` }}>
            <Film t={t} />
          </div>
        </div>
      </div>
      {!RENDER && (
        <div className="controls">
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? '暂停' : '播放'}
          </button>
          <span className="time">
            {t.toFixed(2)} / {DURATION.toFixed(1)}
          </span>
          <input
            type="range"
            min={0}
            max={DURATION}
            step={1 / 60}
            value={t}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
          />
          <span className="chapters">
            {CHAPTERS.map(([name, at]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setT(at);
                }}
              >
                {name}
              </button>
            ))}
          </span>
        </div>
      )}
    </>
  );
}

installDarkScope();
addEventListener('load', installDarkScope);
createRoot(document.getElementById('root')!).render(<App />);

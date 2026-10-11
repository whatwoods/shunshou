// 导出成片：node promo/scripts/render.mjs [--out=promo/out/shunshou-promo.mp4] [--fps=60] [--from=秒] [--to=秒] [--workers=4] [--scale=1.3333]
// 舞台 1440×810，按 4/3 倍像素截图就是 1920×1080。几个标签页同时逐帧截图，按顺序喂给 ffmpeg
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s)));
const url = flags.url ?? 'http://localhost:5190';
const out = flags.out ?? 'promo/out/shunshou-promo.mp4';
const fps = +(flags.fps ?? 60);
const scale = +(flags.scale ?? 4 / 3);
const workers = +(flags.workers ?? 4);

// 每个工作者单独开一个 Chrome：同一个浏览器里的后台标签页不跑 requestAnimationFrame，seek 会一直等
const browsers = await Promise.all(Array.from({ length: workers }, () => launch()));
try {
  const pages = await Promise.all(
    browsers.map(async (browser) => {
      const page = await browser.newPage({ width: 1440, height: 810, scale });
      await page.goto(`${url}/?render`);
      for (let i = 0; !(await page.eval('!!window.__promo')); i++) {
        if (i > 300) throw new Error('页面没有准备好：\n' + page.logs.join('\n'));
        await new Promise((r) => setTimeout(r, 100));
      }
      await page.eval('window.__promo.ready');
      console.log('页面就绪');
      return page;
    })
  );
  const duration = await pages[0].eval('window.__promo.duration');
  const from = +(flags.from ?? 0),
    to = +(flags.to ?? duration);
  const total = Math.round((to - from) * fps);

  mkdirSync(dirname(out), { recursive: true });
  const ff = spawn(
    'ffmpeg',
    [
      ...['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'],
      ...['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'],
      ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high'],
      ...['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'],
      ...['-movflags', '+faststart', out]
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  const done = new Promise((resolve, reject) => ff.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg 退出码 ' + c)))));

  // 多个标签页抢着截下一帧，截好的先放着，按帧号顺序写出去；写得慢时别截太靠前
  const ready = new Map();
  let next = 0,
    written = 0;
  const started = Date.now();
  const write = async () => {
    while (ready.has(written)) {
      const buf = ready.get(written);
      ready.delete(written);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      written++;
      if (written % fps === 0 || written === total) {
        const s = (Date.now() - started) / 1000;
        process.stdout.write(`\r${written}/${total} 帧 · ${s.toFixed(0)} 秒 · 预计还要 ${((s / written) * (total - written)).toFixed(0)} 秒   `);
      }
    }
  };
  let writing = Promise.resolve();
  await Promise.all(
    pages.map(async (page) => {
      for (;;) {
        const i = next++;
        if (i >= total) return;
        while (i - written > workers * 6) await new Promise((r) => setTimeout(r, 10));
        await page.eval(`window.__promo.seek(${from + i / fps})`);
        ready.set(i, await page.shot({ optimizeForSpeed: true }));
        writing = writing.then(write);
      }
    })
  );
  await writing;
  ff.stdin.end();
  await done;
  const logs = pages.flatMap((p) => p.logs);
  if (logs.length) console.log('\n' + logs.join('\n'));
  console.log(`\n已导出 ${out}`);
} finally {
  for (const b of browsers) b.close();
}

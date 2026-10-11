// 抽几帧看看：node promo/scripts/snap.mjs <输出目录> <秒> [秒…] [--url=http://localhost:5190] [--scale=1] [--dark]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s)));
const [out, ...times] = args.filter((a) => !a.startsWith('--'));
const url = flags.url ?? 'http://localhost:5190';
mkdirSync(out, { recursive: true });
const browser = await launch();
try {
  const page = await browser.newPage({ width: 1440, height: 810, scale: +(flags.scale ?? 1) });
  await page.goto(`${url}/?render`);
  // 页面模块加载完才有 __promo（第一次打开时 Vite 还要预构建依赖），等它出现
  for (let i = 0; !(await page.eval('!!window.__promo')); i++) {
    if (i > 300) throw new Error('页面没有准备好：\n' + page.logs.join('\n'));
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.eval('window.__promo.ready');
  for (const s of times) {
    const t = Number(s);
    await page.eval(`window.__promo.seek(${t})`);
    const file = join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
    writeFileSync(file, await page.shot());
    console.log(file);
  }
  if (page.logs.length) console.log(page.logs.join('\n'));
} finally {
  browser.close();
}

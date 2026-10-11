// 给任意网址拍一张图：node promo/scripts/shoot.mjs <网址> <输出.png> [宽] [高] [--mobile] [--dark] [--wait=毫秒] [--js=要先执行的脚本]
import { writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s)));
const [url, out, w = '1440', h = '900'] = args.filter((a) => !a.startsWith('--'));
const browser = await launch();
try {
  const page = await browser.newPage({ width: +w, height: +h, scale: +(flags.scale ?? 1), mobile: 'mobile' in flags, dark: 'dark' in flags });
  await page.goto(url);
  await new Promise((r) => setTimeout(r, +(flags.wait ?? 1500)));
  if (flags.js) {
    await page.eval(flags.js);
    await new Promise((r) => setTimeout(r, +(flags.after ?? 800)));
  }
  writeFileSync(out, await page.shot(flags.full ? { captureBeyondViewport: true } : {}));
  if (page.logs.length) console.log(page.logs.join('\n'));
} finally {
  browser.close();
}

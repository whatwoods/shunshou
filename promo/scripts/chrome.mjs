// 不依赖 puppeteer 的极简 Chrome 驱动：用本机的 Google Chrome 无头启动，经 DevTools 协议（Node 自带 WebSocket）控制页面
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch({ headless = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shunshou-promo-'));
  const args = [
    `--user-data-dir=${dir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    headless && '--headless=new',
    'about:blank'
  ].filter(Boolean);
  const proc = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on('exit', (code) => reject(new Error(`Chrome 退出了（${code}）`)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else for (const l of listeners) l(msg);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const once = (method, sessionId) =>
    new Promise((resolve) => {
      const l = (m) => {
        if (m.method === method && m.sessionId === sessionId) {
          listeners.delete(l);
          resolve(m.params);
        }
      };
      listeners.add(l);
    });

  async function newPage({ width = 1920, height = 1080, scale = 1, mobile = false, dark = false } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    if (mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
    const logs = [];
    listeners.add((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') logs.push('异常：' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
        logs.push(m.params.type + '：' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    return {
      send: s,
      logs,
      async goto(url) {
        const loaded = once('Page.loadEventFired', sessionId);
        await s('Page.navigate', { url });
        await loaded;
      },
      async eval(expression) {
        const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async shot(opts = {}) {
        const r = await s('Page.captureScreenshot', { format: 'png', ...opts });
        return Buffer.from(r.data, 'base64');
      }
    };
  }

  return {
    newPage,
    close() {
      try {
        ws.close();
      } catch {
        /* 已经断开 */
      }
      proc.kill();
      setTimeout(() => {
        try {
          rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {
          /* Chrome 还没完全退出，临时目录留给系统清理 */
        }
      }, 800);
    }
  };
}

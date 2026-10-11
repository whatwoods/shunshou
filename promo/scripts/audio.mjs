// 配乐：纯代码合成（暖和的铺底和弦 + 一点拨弦 + 界面的轻声响），时间点照 timeline.ts 和各场里的常量
// node promo/scripts/audio.mjs [--out=promo/out/music.wav]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s)));
const OUT = args.out ?? 'promo/out/music.wav';
const SR = 48000;
const T = { logo: 0, hero: 2.3, drop: 7.3, bench: 11.6, pdf: 19.0, palette: 25.4, wall: 29.4, privacy: 33.4, phone: 38.6, dark: 41.6, finale: 44.6, end: 51 };
const LEN = Math.round(T.end * SR);

// 三条总线：干声、送混响的、铺底（铺底自己带一点混响）
const bus = () => [new Float32Array(LEN), new Float32Array(LEN)];
const dry = bus(),
  wet = bus(),
  pad = bus();
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const TAU = Math.PI * 2;
let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};
function add(b, t0, n, fn, pan = 0, gain = 1) {
  const s0 = Math.max(0, Math.round(t0 * SR));
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain,
    gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  for (let i = 0; i < n && s0 + i < LEN; i++) {
    const v = fn(i / SR, i);
    b[0][s0 + i] += v * gl;
    b[1][s0 + i] += v * gr;
  }
}

// ———— 铺底和弦：D 大调，跟着段落换 ————
const CH = {
  D: [50, 57, 61, 64, 66], // Dmaj9
  Bm: [47, 54, 57, 61, 62], // Bm9
  G: [43, 50, 54, 57, 59], // Gmaj9
  A: [45, 52, 54, 59, 61], // A6/9
  Em: [40, 47, 50, 54, 55] // Em9
};
const PROG = [
  [0, 'D'],
  [T.drop, 'Bm'],
  [T.bench, 'G'],
  [15.3, 'A'],
  [T.pdf, 'D'],
  [22.4, 'Bm'],
  [T.palette, 'G'],
  [T.wall - 0.95, 'D'],
  [T.privacy, 'Bm'],
  [36.5, 'G'],
  [T.phone, 'D'],
  [T.dark, 'Em'],
  [43.2, 'A'],
  [T.finale + 1.3, 'D']
];
for (let k = 0; k < PROG.length; k++) {
  const [start, name] = PROG[k];
  const end = k + 1 < PROG.length ? PROG[k + 1][0] : T.end;
  const atk = k === 0 ? 2.4 : 1.1,
    rel = k + 1 < PROG.length ? 1.8 : 0.1;
  const dur = end - start + rel;
  CH[name].forEach((n, j) => {
    const f = midi(n);
    const lvl = (j === 0 ? 0.5 : 0.32) / (1 + j * 0.12);
    for (const [det, pan] of [
      [-0.0035, -0.55],
      [0, 0],
      [0.0035, 0.55]
    ]) {
      const ff = f * (1 + det);
      const ph = j * 1.3 + det * 900;
      add(
        pad,
        start,
        Math.round(dur * SR),
        (t) => {
          const a = Math.min(1, t / atk);
          const env = (0.5 - 0.5 * Math.cos(Math.PI * a)) * (t > end - start ? Math.max(0, 1 - (t - (end - start)) / rel) ** 2 : 1);
          const trem = 1 + 0.12 * Math.sin(TAU * (0.11 + j * 0.03) * t + j);
          const w = TAU * ff * t + ph;
          return env * trem * lvl * (Math.sin(w) + 0.22 * Math.sin(2 * w) + 0.07 * Math.sin(3 * w));
        },
        pan,
        0.06
      );
    }
    // 低音：根音再低八度
    if (j === 0)
      add(
        pad,
        start,
        Math.round(dur * SR),
        (t) => {
          const a = Math.min(1, t / (atk * 1.4));
          const env = (0.5 - 0.5 * Math.cos(Math.PI * a)) * (t > end - start ? Math.max(0, 1 - (t - (end - start)) / rel) ** 2 : 1);
          return env * Math.sin(TAU * (f / 2) * t);
        },
        0,
        0.05
      );
  });
}

// ———— 拨弦：工具页和工具墙那几段，八分音符轻轻地走 ————
const pluck = (t0, n, gain = 0.05, pan = 0) =>
  add(
    wet,
    t0,
    Math.round(0.9 * SR),
    (t) => {
      const f = midi(n);
      const e = Math.exp(-t * 7) * Math.min(1, t * 400);
      return e * (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 10));
    },
    pan,
    gain
  );
const ARP = { D: [74, 78, 81, 85, 81, 78], Bm: [71, 74, 78, 81, 78, 74], G: [74, 78, 79, 83, 79, 78], A: [73, 76, 78, 81, 78, 76], Em: [71, 74, 76, 79, 76, 74] };
const chordAt = (t) => PROG.filter(([s]) => s <= t).pop()[1];
for (const [a, b] of [
  [T.bench + 0.6, T.palette - 0.2],
  [T.wall + 0.3, T.phone + 2.8]
]) {
  const step = 60 / 104 / 2;
  for (let k = 0, t = a; t < b; k++, t += step) {
    const fadeIn = Math.min(1, (t - a) / 2),
      fadeOut = Math.min(1, (b - t) / 1.5);
    pluck(t, ARP[chordAt(t)][k % 6], 0.035 * fadeIn * fadeOut * (k % 2 ? 0.75 : 1), k % 2 ? 0.35 : -0.35);
  }
}

// ———— 音效 ————
const bell = (t0, n, gain = 0.08, pan = 0) =>
  add(
    wet,
    t0,
    Math.round(2.6 * SR),
    (t) => {
      const f = midi(n);
      const a = Math.min(1, t * 300);
      return a * (Math.sin(TAU * f * t) * Math.exp(-t * 1.6) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 3) + 0.12 * Math.sin(TAU * 3.01 * f * t) * Math.exp(-t * 5) + 0.05 * Math.sin(TAU * 4.2 * f * t) * Math.exp(-t * 8));
    },
    pan,
    gain
  );
const pop = (t0, n, gain = 0.07, pan = 0) =>
  add(
    wet,
    t0,
    Math.round(0.35 * SR),
    (t) => {
      const f = midi(n) * (1 + 0.5 * Math.exp(-t * 90));
      return Math.min(1, t * 600) * Math.exp(-t * 16) * Math.sin(TAU * f * t);
    },
    pan,
    gain
  );
function click(t0, gain = 1) {
  let lp = 0;
  add(dry, t0, Math.round(0.05 * SR), (t) => {
    const n = noise();
    lp += 0.5 * (n - lp);
    return (n - lp) * Math.exp(-t * 900) * 0.6 + Math.sin(TAU * 3200 * t) * Math.exp(-t * 160) * 0.25;
  }, 0.15, 0.09 * gain);
}
function keyClack(t0, gain = 1) {
  let a = 0,
    b = 0;
  add(dry, t0, Math.round(0.12 * SR), (t) => {
    const n = noise();
    a += 0.35 * (n - a);
    b += 0.08 * (a - b);
    return (a - b) * Math.exp(-t * 120) * 1.2 + Math.sin(TAU * 140 * t) * Math.exp(-t * 45) * 0.7;
  }, 0, 0.12 * gain);
}
const tick = (t0, gain = 1, pan = 0.2) => add(wet, t0, Math.round(0.08 * SR), (t) => Math.sin(TAU * 2637 * t) * Math.exp(-t * 70), pan, 0.03 * gain);
// 气流声：白噪声过一个中心频率扫动的带通
function whoosh(t0, dur = 0.8, gain = 1, lo = 260, hi = 2600, pan = 0) {
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  add(wet, t0, Math.round(dur * SR), (t) => {
    const p = t / dur;
    const env = Math.sin(Math.PI * Math.min(1, p)) ** 2;
    const fc = lo * (hi / lo) ** Math.sin(Math.PI * p);
    const w0 = (TAU * fc) / SR,
      q = 1.2,
      al = Math.sin(w0) / (2 * q);
    const b0 = al,
      a0 = 1 + al,
      a1 = -2 * Math.cos(w0),
      a2 = 1 - al;
    const x = noise();
    const y = (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y * env;
  }, pan, 0.11 * gain);
}
const glide = (t0, f0, f1, dur, gain) =>
  add(wet, t0, Math.round((dur + 0.6) * SR), (t) => {
    const p = Math.min(1, t / dur);
    const f = f0 * (f1 / f0) ** p;
    return Math.sin(TAU * f * t) * Math.min(1, t * 200) * Math.exp(-t * 3.2);
  }, 0, gain);

// 第一幕：灯亮、方块弹出、键帽排开、卡片长出来
bell(0.25, 90, 0.05);
[0.85, 0.93, 1.01, 1.09].forEach((t, i) => pop(t, [74, 78, 81, 86][i], 0.06, -0.3 + i * 0.2));
whoosh(T.hero - 0.05, 0.9, 0.7);
pop(T.hero + 0.4, 85, 0.05, 0.3);
pop(T.hero + 0.5, 88, 0.05, 0.45);
whoosh(T.hero + 1.8, 1.1, 0.55, 200, 1400);
// 拖进照片：经过卡片、松手、分成四个推荐
whoosh(8.35, 0.7, 0.45, 300, 1800, 0.3);
keyClack(9.0, 0.6);
[9.15, 9.22, 9.29, 9.36].forEach((t, i) => bell(t, [78, 81, 85, 88][i], 0.04, -0.3 + i * 0.2));
// 鼠标
for (const [d, u] of [
  [11.3, 11.42],
  [13.25, 13.37],
  [14.35, 15.25],
  [16.5, 17.95],
  [18.7, 18.82],
  [20.45, 21.45],
  [22.35, 22.47]
]) {
  click(d);
  click(u, 0.5);
}
// 工具页
whoosh(T.bench + 0.02, 1.0, 0.9, 220, 2200);
[12.77, 12.99, 13.21, 13.58, 13.76, 13.94, 15.5, 15.7, 15.9].forEach((t, i) => tick(t, i < 3 ? 1 : 0.7, -0.2 + (i % 3) * 0.3));
whoosh(13.26, 0.45, 0.35, 900, 3000, -0.2);
whoosh(T.pdf + 0.08, 0.9, 0.8, 240, 2000);
[19.15, 19.45, 19.55].forEach((t, i) => pop(t, [78, 81, 85][i], 0.045, -0.4 + i * 0.4));
pop(21.5, 74, 0.05);
[22.65, 22.83, 23.01].forEach((t, i) => tick(t, 1, -0.3 + i * 0.3));
bell(23.2, 86, 0.045);
whoosh(23.35, 0.6, 0.6, 300, 1600);
keyClack(23.85, 0.5);
pop(24.0, 90, 0.05);
// ⌘K
keyClack(T.palette + 0.38, 1);
keyClack(T.palette + 0.46, 0.9);
whoosh(T.palette + 0.58, 0.7, 0.7, 400, 2600);
keyClack(T.palette + 1.6, 0.45);
keyClack(T.palette + 1.76, 0.45);
keyClack(T.palette + 2.25, 0.4);
// 工具墙：键帽一圈圈弹开，波浪扫过
whoosh(T.wall - 0.95, 0.9, 0.8, 200, 2400);
[0, 1, 2, 3, 4, 5, 6, 7].forEach((k) => pop(T.wall - 0.8 + k * 0.07, [74, 78, 81, 85, 86, 90, 93, 97][k], 0.035, -0.6 + k * 0.17));
[T.wall + 0.75, T.wall + 2.2].forEach((w) => [0, 1, 2, 3, 4].forEach((k) => bell(w + k * 0.09, [81, 85, 86, 90, 93][k], 0.018, -0.5 + k * 0.25)));
// 隐私：收进窗口；断网
whoosh(T.privacy + 0.02, 1.0, 0.8, 2400, 220);
glide(36.5, 880, 440, 0.35, 0.03);
pop(36.75, 81, 0.04);
// 手机、深色、结尾
whoosh(T.phone + 0.02, 1.0, 0.85, 220, 2200);
[0, 1, 2, 3, 4, 5].forEach((k) => pop(T.phone + 0.6 + k * 0.05, [74, 78, 81, 85, 86, 90][k], 0.03, -0.3 + (k % 2) * 0.6));
whoosh(T.dark, 1.3, 0.9, 120, 900);
whoosh(T.finale + 0.05, 1.0, 0.8, 2200, 260);
[0, 1, 2, 3].forEach((k) => pop(T.finale + 0.45 + k * 0.05, [74, 78, 81, 86][k], 0.04));
[0, 1, 2, 3, 4].forEach((k) => bell(T.finale + 1.3 + k * 0.06, [62, 69, 74, 78, 81][k], 0.05, -0.4 + k * 0.2));
bell(T.finale + 1.75, 90, 0.035, 0.2);

// ———— 混响（Schroeder：四个梳状 + 两个全通） ————
function reverb([L, R], decay = 0.82) {
  const out = [new Float32Array(LEN), new Float32Array(LEN)];
  [L, R].forEach((x, ch) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + ch * 23) * (SR / 44100)));
    for (const d of combs) {
      const buf = new Float32Array(d);
      let k = 0,
        lp = 0;
      for (let i = 0; i < LEN; i++) {
        const y = buf[k];
        lp = y * 0.6 + lp * 0.4;
        buf[k] = x[i] + lp * decay;
        out[ch][i] += y * 0.25;
        k = (k + 1) % d;
      }
    }
    for (const d of [225, 556].map((d) => Math.round(d * (SR / 44100)))) {
      const buf = new Float32Array(d);
      let k = 0;
      for (let i = 0; i < LEN; i++) {
        const b = buf[k],
          v = out[ch][i];
        const y = -v + b;
        buf[k] = v + b * 0.5;
        out[ch][i] = y;
        k = (k + 1) % d;
      }
    }
  });
  return out;
}
const wetR = reverb(wet, 0.84),
  padR = reverb(pad, 0.8);

// ———— 混合、压一压、开头结尾淡入淡出 ————
const mix = [new Float32Array(LEN), new Float32Array(LEN)];
for (let c = 0; c < 2; c++) for (let i = 0; i < LEN; i++) mix[c][i] = dry[c][i] + wet[c][i] * 0.8 + wetR[c][i] * 0.35 + pad[c][i] + padR[c][i] * 0.25;
let peak = 0;
for (let c = 0; c < 2; c++) for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(mix[c][i]));
const norm = 0.85 / peak;
for (let i = 0; i < LEN; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (T.end - 0.05 - t) / 1.1));
  for (let c = 0; c < 2; c++) mix[c][i] = Math.tanh(mix[c][i] * norm * 1.15) * 0.95 * fade;
}

// ———— 写 WAV（16 位立体声） ————
const data = Buffer.alloc(LEN * 4);
for (let i = 0; i < LEN; i++)
  for (let c = 0; c < 2; c++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[c][i] * 32767))), i * 4 + c * 2);
const head = Buffer.alloc(44);
head.write('RIFF', 0);
head.writeUInt32LE(36 + data.length, 4);
head.write('WAVE', 8);
head.write('fmt ', 12);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write('data', 36);
head.writeUInt32LE(data.length, 40);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([head, data]));
console.log(`已生成 ${OUT}（${T.end} 秒，峰值归一前 ${peak.toFixed(2)}）`);

import { wordlist } from '@scure/bip39/wordlists/english.js';
export const defaults = {
  length: 20,
  count: 5,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  exclude: true,
  phrase: false,
  words: 7
};
export type Settings = typeof defaults;
export function randomIndex(
  size: number,
  random: (v: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (v) => crypto.getRandomValues(v)
) {
  if (!Number.isInteger(size) || size < 1 || size > 2 ** 32) throw new Error('字符集不能为空');
  const limit = Math.floor(2 ** 32 / size) * size;
  const a = new Uint32Array(1);
  do {
    random(a);
  } while (a[0] >= limit);
  return a[0] % size;
}
export function pool(s: Settings) {
  return [
    s.upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
    s.lower ? 'abcdefghijklmnopqrstuvwxyz' : '',
    s.digits ? '0123456789' : '',
    s.symbols ? '!@#$%^&*()-_=+[]{}:,.?' : ''
  ]
    .join('')
    .split('')
    .filter((c) => !s.exclude || !/[Il1O0o]/.test(c))
    .join('');
}
export function generate(s: Settings) {
  if (!Number.isInteger(s.count) || s.count < 1 || s.count > 100) throw new Error('批量数量请设为 1–100');
  if (s.phrase) {
    if (!Number.isInteger(s.words) || s.words < 4 || s.words > 20) throw new Error('词数请设为 4–20');
    return {
      values: Array.from({ length: s.count }, () =>
        Array.from({ length: s.words }, () => wordlist[randomIndex(wordlist.length)]).join('-')
      ),
      entropy: s.words * Math.log2(wordlist.length)
    };
  }
  if (!Number.isInteger(s.length) || s.length < 4 || s.length > 256) throw new Error('长度请设为 4–256');
  const chars = pool(s);
  if (!chars) throw new Error('至少选一种字符');
  return {
    values: Array.from({ length: s.count }, () => Array.from({ length: s.length }, () => chars[randomIndex(chars.length)]).join('')),
    entropy: s.length * Math.log2(chars.length)
  };
}
export function strength(entropy: number) {
  return entropy >= 100 ? '很强' : entropy >= 80 ? '强' : entropy >= 60 ? '中等' : '偏弱，建议加长';
}

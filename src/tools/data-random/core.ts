export const maxItems = 10_000;
const pool = new Uint32Array(256);
let cursor = pool.length;
function secureWord() {
  if (cursor === pool.length) {
    crypto.getRandomValues(pool);
    cursor = 0;
  }
  return pool[cursor++]!;
}
// 丢弃不能均分的尾部，避免取模偏差。
export function randomBelow(size: number, word: () => number = secureWord): number {
  if (!Number.isInteger(size) || size < 1 || size > 2 ** 32) throw new Error('范围宽度必须在 1 到 2³²（约 43 亿）之间。');
  const limit = Math.floor(2 ** 32 / size) * size;
  let value: number;
  do {
    value = word();
  } while (value >= limit);
  return value % size;
}
function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > maxItems) throw new Error('数量请填 1 到 1 万的整数。');
}
export function integers(min: number, max: number, count: number, replacement: boolean, random = randomBelow): number[] {
  checkCount(count);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new Error('上下限请填写安全整数，且下限不能大于上限。');
  const size = max - min + 1;
  if (!Number.isSafeInteger(size) || size > 2 ** 32) throw new Error('范围最多 2³² 个整数，请缩小范围。');
  if (!replacement && count > size) throw new Error('不重复抽取时，数量不能超过范围内的整数个数。');
  const swaps = new Map<number, number>();
  return Array.from({ length: count }, (_, i) => {
    if (replacement) return min + random(size);
    // 稀疏 Fisher–Yates：不必分配整个整数范围，也不会在临近抽完时反复碰撞。
    const remaining = size - i;
    const picked = random(remaining);
    const value = swaps.get(picked) ?? picked;
    swaps.set(picked, swaps.get(remaining - 1) ?? remaining - 1);
    swaps.delete(remaining - 1);
    return min + value;
  });
}
export function parseNames(text: string, deduplicate: boolean): string[] {
  if (text.length > 1_000_000) throw new Error('名单过长，请控制在 100 万字符以内。');
  let names = text
    .split(/\r\n?|\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (deduplicate) names = [...new Set(names)];
  if (!names.length) throw new Error('请先输入名单，每行一个名字。');
  if (names.length > maxItems) throw new Error('一次最多 1 万个名字，请分批。');
  return names;
}
export function drawNames(names: string[], count: number, replacement: boolean, random = randomBelow): string[] {
  return integers(0, names.length - 1, count, replacement, random).map((i) => names[i]!);
}
export function groupNames(names: string[], count: number, random = randomBelow): string[][] {
  checkCount(count);
  if (count > names.length) throw new Error('分组数量不能超过名单人数。');
  const shuffled = drawNames(names, names.length, false, random);
  const groups = Array.from({ length: count }, () => [] as string[]);
  shuffled.forEach((name, i) => groups[i % count]!.push(name));
  return groups;
}

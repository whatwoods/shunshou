import { diffLines, diffWordsWithSpace, type Change } from 'diff';
export interface DiffRow {
  left?: string;
  right?: string;
  leftNumber?: number;
  rightNumber?: number;
  changes?: Change[];
}
export function compare(left: string, right: string, ignoreWhitespace: boolean): DiffRow[] {
  const chunks = diffLines(left, right, { ignoreWhitespace, timeout: 1800 });
  if (!chunks) throw new Error('差异太多，比较已停止。请分段比较');
  const rows: DiffRow[] = [];
  let l = 1,
    r = 1;
  const lines = (s: string) => s.replace(/\n$/, '').split('\n');
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (!c.added && !c.removed) {
      for (const line of lines(c.value)) rows.push({ left: line, right: line, leftNumber: l++, rightNumber: r++ });
    } else if (c.removed) {
      const old = lines(c.value),
        next = chunks[i + 1]?.added ? lines(chunks[++i].value) : [];
      for (let j = 0; j < Math.max(old.length, next.length); j++) {
        const a = old[j],
          b = next[j];
        const changes = a !== undefined && b !== undefined ? diffWordsWithSpace(a, b, { timeout: 150 }) : undefined;
        rows.push({
          left: a,
          right: b,
          leftNumber: a !== undefined ? l++ : undefined,
          rightNumber: b !== undefined ? r++ : undefined,
          changes
        });
      }
    } else {
      for (const line of lines(c.value)) rows.push({ right: line, rightNumber: r++ });
    }
  }
  return rows;
}

import { it, expect } from 'vitest';
import { compare, exportDiff } from './logic';
it('aligns changed lines and preserves inline changes', () => {
  const rows = compare('hello old\nsame\n', 'hello new\nsame\n', false);
  expect(rows).toHaveLength(2);
  expect(rows[0].changes?.some((c) => c.added && c.value === 'new')).toBe(true);
  expect(rows[1].leftNumber).toBe(2);
});
it('ignores edge whitespace when requested', () => expect(compare(' a \n', 'a\n', true)[0].changes).toBeUndefined());
it('keeps both original texts when ignoring edge whitespace', () => {
  const rows = compare(' a \n  b\n', 'a\nb \n', true);
  expect(rows[0]).toMatchObject({ left: ' a ', right: 'a', unchanged: true });
  expect(rows[1]).toMatchObject({ left: '  b', right: 'b ', unchanged: true, leftNumber: 2, rightNumber: 2 });
  expect(exportDiff(rows)).toBe('   a \n    b');
});
it('preserves a difference in the final newline in both preview data and downloads', () => {
  const rows = compare('a', 'a\n', false);
  expect(rows[0]).toMatchObject({ left: 'a', right: 'a', leftNoNewline: true });
  expect(rows[0].rightNoNewline).toBeUndefined();
  expect(rows[0].unchanged).toBeUndefined();
  expect(exportDiff(rows)).toBe('- a\n\\ 行末无换行\n+ a');
  expect(compare('', '', false)).toEqual([]);
});

import { it, expect } from 'vitest';
import { defaults, processLines } from './logic';
it('规范换行、去空白空行、保留第一个重复项', () => {
  expect(processLines(' A \r\na\r\n\r\nB', { ...defaults, ignoreCase: true })).toEqual({ text: 'A\nB', before: 4, after: 2 });
});
it('自然排序后添加前后缀', () => {
  expect(processLines('item10\nitem2', { ...defaults, sort: 'asc', prefix: '[', suffix: ']' }).text).toBe('[item2]\n[item10]');
});
it('保留空行、重复和倒序', () => {
  expect(processLines('a\n\na', { ...defaults, empty: false, unique: false, sort: 'reverse' }).text).toBe('a\n\na');
  expect(processLines('', defaults).after).toBe(0);
});
it('限制膨胀输出', () => {
  expect(() => processLines('a\nb', { ...defaults, prefix: 'x'.repeat(5_000_000) })).toThrow('太长');
});

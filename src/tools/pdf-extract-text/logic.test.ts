import { expect, it } from 'vitest';
import { extractPageText } from '../../lib/pdf/text';
const span = (str: string, x: number, y: number, width = 10, hasEOL = false) => ({ str, width, hasEOL, transform: [1, 0, 0, 10, x, y] });
it('preserves word gaps and line changes', () =>
  expect(extractPageText([span('Hello', 0, 100, 25), span('world', 30, 100, 25, true), span('下一行', 0, 80)])).toBe(
    'Hello world\n下一行'
  ));
it('does not add spaces between adjacent Chinese spans', () =>
  expect(extractPageText([span('中', 0, 100), span('文', 10, 100), { type: 'beginMarkedContent' }])).toBe('中文'));
it('returns empty for pages without text', () => expect(extractPageText([{ type: 'marked' }])).toBe(''));

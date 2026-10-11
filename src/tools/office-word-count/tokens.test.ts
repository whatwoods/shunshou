import { describe, expect, it } from 'vitest';
import { tokenCount } from './tokens';

describe('tokenCount', () => {
  it('按 o200k 分词计数', () => {
    expect(tokenCount('')).toBe(0);
    expect(tokenCount('hello world')).toBe(2);
    expect(tokenCount('顺手是一组装在浏览器里的小工具。')).toBe(12);
  });
  it('文本里的特殊标记当普通文字数，不报错', () => {
    expect(tokenCount('x <|endoftext|> y')).toBeGreaterThan(3);
  });
});

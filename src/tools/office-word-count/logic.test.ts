import { expect, it } from 'vitest';
import { countText } from './logic';
it('counts unicode and mixed text', () => {
  expect(countText('你好 world!\n\nGood day.')).toMatchObject({ chinese: 2, english: 3, words: 5, paragraphs: 2, sentences: 2 });
  expect(countText('😀 a').chars).toBe(3);
  expect(countText('').seconds).toBe(0);
});

import { it, expect } from 'vitest';
import { convert } from './logic';
it('preserves batch lines and recognizes acronyms', () => {
  expect(convert('hello world\nXMLHttpRequest', 'snake')).toBe('hello_world\nxml_http_request');
  expect(convert('hello. WORLD!', 'sentence')).toBe('Hello. World!');
  expect(convert('hello_world', 'camel')).toBe('helloWorld');
});

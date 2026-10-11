import { it, expect } from 'vitest';
import { renderMarkdown, exportHtml } from './logic';
it('renders GFM table and tasks', () => {
  expect(renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  expect(renderMarkdown('- [x] done')).toContain('checked');
});
it('escapes unrecognized code language', () => {
  expect(renderMarkdown('```unknown\n<img onerror=evil()>\n```')).toContain('&lt;img');
  expect(exportHtml('<p>x</p>')).toContain("default-src 'none'");
});

// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { sanitize } from './sanitize';
it('removes executable markup and remote image requests', () => {
  const html = sanitize(
    '<img src="https://evil.test/pixel" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">x</a><svg onload="alert(1)"></svg><iframe srcdoc="bad"></iframe>'
  );
  expect(html).not.toMatch(/onerror|script|javascript|onload|iframe|https:\/\/evil/);
});
it('preserves GFM task boxes and safe images', () => {
  expect(sanitize('<input type="checkbox" disabled checked><img src="data:image/png;base64,AAAA">')).toContain('checked');
  expect(sanitize('<img src="data:image/png;base64,AAAA">')).toContain('data:image/png');
});

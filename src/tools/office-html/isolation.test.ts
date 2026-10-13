// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';

test('隔离页即使收到旧版运行脚本请求，也始终禁用用户脚本', () => {
  const source = readFileSync('public/html-preview-frame.html', 'utf8');
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const listen = vi.spyOn(window, 'addEventListener');
  try {
    // 执行仓库里的隔离页脚本，验证真实消息处理器对旧客户端请求的限制。
    window.eval(parsed.querySelector('script')!.textContent!);
    const html = '<p>内容</p><script>new RTCPeerConnection()</script>';
    window.dispatchEvent(new window.MessageEvent('message', { source: window.parent, data: { html, scripts: true } }));
    const frame = window.document.querySelector('iframe')!;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.srcdoc).toBe(html);
    window.dispatchEvent(new window.MessageEvent('message', { source: null, data: { html: '替换内容', scripts: true } }));
    expect(window.document.querySelector('iframe')).toBe(frame);
  } finally {
    for (const [name, handler, options] of listen.mock.calls) window.removeEventListener(name, handler, options);
    listen.mockRestore();
    document.body.replaceChildren();
  }
});

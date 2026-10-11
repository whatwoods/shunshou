import { Marked } from 'marked';
import hljs from 'highlight.js/lib/common';
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const language = (lang || '').split(/\s/)[0];
      const value =
        language && hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escapeHtml(text);
      return `<pre><code class="hljs">${value}</code></pre>`;
    }
  }
});
export function renderMarkdown(text: string) {
  return parser.parse(text, { async: false });
}
export function exportHtml(html: string) {
  return (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; base-uri \'none\'; form-action \'none\'"><title>Markdown 文档</title></head><body><main>' +
    html +
    '</main></body></html>'
  );
}

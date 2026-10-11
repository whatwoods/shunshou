import { renderMarkdown } from './logic';
self.onmessage = (e) => {
  try {
    self.postMessage({ result: renderMarkdown(e.data) });
  } catch {
    self.postMessage({ error: 'Markdown 解析失败，请分段检查内容后重试' });
  }
};

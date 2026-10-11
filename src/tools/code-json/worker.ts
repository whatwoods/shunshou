import { formatJson, jsonError, type JsonOptions } from './logic';
self.onmessage = async (e: MessageEvent<{ text: string; file?: File; options: JsonOptions; repair?: boolean }>) => {
  let text = e.data.text;
  try {
    if (e.data.file) text = await e.data.file.text();
    const output = formatJson(text, e.data.options, e.data.repair);
    self.postMessage({ output });
  } catch (error) {
    let fixable = false;
    if (e.data.options.source === 'json') {
      try {
        formatJson(text, e.data.options, true);
        fixable = true;
      } catch {
        /* 无法修复时保留原文 */
      }
    }
    self.postMessage({ error: jsonError(text, error), fixable });
  }
};

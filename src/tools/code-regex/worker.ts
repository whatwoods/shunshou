import { runRegex } from './logic';
self.onmessage = (e: MessageEvent<{ pattern: string; flags: string; text: string; replacement: string }>) => {
  try {
    const { pattern, flags, text, replacement } = e.data;
    const result = runRegex(pattern, flags, text, replacement);
    self.postMessage({
      ...result,
      output: result.output.slice(0, 100000),
      outputBlob: new Blob([result.output], { type: 'text/plain;charset=utf-8' })
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '表达式无法执行' });
  }
};

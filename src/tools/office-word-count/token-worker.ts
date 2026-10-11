// 分词表有 2 MB 多，单独放一个常驻 Worker：只在第一次统计时加载一次，打字时不会每次重新解析
let count: ((text: string) => number) | null = null;

self.onmessage = async (e: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = e.data;
  try {
    count ??= (await import('./tokens')).tokenCount;
    self.postMessage({ id, tokens: count(text) });
  } catch {
    self.postMessage({ id, error: true });
  }
};

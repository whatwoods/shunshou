import { processLines } from './logic';
self.onmessage = (e) => {
  try {
    self.postMessage({ result: processLines(e.data.text, e.data.options) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};

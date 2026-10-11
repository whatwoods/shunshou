import { convert } from './logic';
self.onmessage = (e) => {
  try {
    self.postMessage({ result: convert(e.data.text, e.data.mode) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};

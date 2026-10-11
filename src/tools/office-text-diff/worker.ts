import { compare } from './logic';
self.onmessage = (e) => {
  try {
    self.postMessage({ result: compare(e.data.left, e.data.right, e.data.ignore) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};

import { countText } from './logic';
self.onmessage = (e) => {
  self.postMessage({ result: countText(e.data) });
};

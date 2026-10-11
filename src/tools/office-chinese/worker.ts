import { convertChinese } from './logic';
self.onmessage = async (e) => {
  try {
    self.postMessage({ result: await convertChinese(e.data.text, e.data.from, e.data.to) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};

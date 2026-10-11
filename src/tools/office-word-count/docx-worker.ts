import { readDocx } from './docx';
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage({ text: await readDocx(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '读取失败，请换一个 DOCX 文件' });
  }
};

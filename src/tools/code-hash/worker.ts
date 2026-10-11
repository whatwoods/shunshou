import { hashBlob, type Algorithm } from './logic';
const scope = self as unknown as {
  onmessage: (event: MessageEvent<{ blob: Blob; algorithms: Algorithm[] }>) => void;
  postMessage: (data: unknown) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const result = await hashBlob(data.blob, data.algorithms, (progress) => scope.postMessage({ progress }));
    scope.postMessage({ result });
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : '无法读取文件，请重新选择' });
  }
};

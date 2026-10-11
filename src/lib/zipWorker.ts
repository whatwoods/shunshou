// 在 Worker 里打包 ZIP：几百张图片、几十份 PDF 打包时页面不卡
import { buildZip, type ZipEntry } from './zipCore';

const scope = self as unknown as {
  onmessage: (e: MessageEvent<ZipEntry[]>) => void;
  postMessage: (res: { blob: Blob } | { error: string }) => void;
};

scope.onmessage = async (e) => {
  try {
    scope.postMessage({ blob: await buildZip(e.data) });
  } catch (err) {
    scope.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};

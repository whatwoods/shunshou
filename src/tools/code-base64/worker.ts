import { encodeBlob, decodeBytes, encodeText, dataUrlMime } from './logic';
self.onmessage = async (e: MessageEvent<{ text: string; file?: File; mode: string; urlSafe: boolean; dataUrl: boolean }>) => {
  try {
    const { text, file, mode, urlSafe, dataUrl } = e.data;
    if (mode === 'encode') {
      const encoded = file ? await encodeBlob(file, urlSafe) : encodeText(text, urlSafe);
      self.postMessage({ text: dataUrl ? `data:${file?.type || 'text/plain'};base64,${encoded}` : encoded });
    } else {
      const input = file ? await file.text() : text;
      const bytes = decodeBytes(input);
      let decoded = '';
      let binary = false;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        binary = true;
      }
      const mime = dataUrlMime(input);
      self.postMessage({ text: decoded, binary, blob: new Blob([bytes as BlobPart], { type: mime }) });
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '转换失败，请检查内容' });
  }
};

import { transformEscape, type EscapeFormat } from './logic';
self.onmessage = async ({ data }: MessageEvent<{ text: string; file?: File; format: EscapeFormat; decode: boolean }>) => {
  try {
    if (data.file && data.file.size > 20000000) throw new Error('文件超过 20 MB，请拆分后重试');
    const text = data.file ? await data.file.text() : data.text;
    if (text.length > 5_000_000) throw new Error('每次最多 500 万字符，请拆分文件后重试');
    const output = transformEscape(text, data.format, data.decode);
    self.postMessage({
      output: output.slice(0, 100000),
      blob: new Blob([output], { type: 'text/plain;charset=utf-8' }),
      length: output.length,
      truncated: output.length > 100000
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};

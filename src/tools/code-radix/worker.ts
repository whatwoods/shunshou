import { convertIntegers, type RadixOptions } from './logic';
self.onmessage = async ({ data }: MessageEvent<{ text: string; file?: File; options: RadixOptions }>) => {
  try {
    if (data.file && data.file.size > 8000000) throw new Error('文件超过 8 MB，请拆分后重试');
    const text = data.file ? await data.file.text() : data.text;
    if (text.length > 2_000_000) throw new Error('每次最多 200 万字符，请拆分文件后重试');
    const result = convertIntegers(text, data.options);
    self.postMessage({
      ...result,
      output: result.output.slice(0, 100000),
      blob: new Blob([result.output], { type: 'text/plain;charset=utf-8' }),
      truncated: result.output.length > 100000
    });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};

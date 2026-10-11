import { formatCode, type FormatOptions } from './logic';
self.onmessage = async ({ data }: MessageEvent<{ text?: string; file?: File; options: FormatOptions }>) => {
  let input: string | undefined;
  try {
    if (data.file && data.file.size > 10_000_000) throw new Error('文件超过 10 MB，请拆分后重试');
    input = data.file ? await data.file.text() : data.text || '';
    const text = await formatCode(input, data.options);
    self.postMessage({ text, input: data.file ? input : undefined });
  } catch (e) {
    self.postMessage({ input: data.file ? input : undefined, error: `无法格式化：${e instanceof Error ? e.message : '请检查语法后重试'}` });
  }
};

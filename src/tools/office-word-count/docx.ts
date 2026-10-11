import { Unzip, UnzipInflate } from 'fflate';
import { SaxesParser } from 'saxes';
const LIMIT = 20 * 1024 * 1024;
const WORD = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main']);
export function documentText(xml: string): string {
  const parser = new SaxesParser({ xmlns: true });
  let body = 0,
    text = 0,
    found = false,
    deleted = 0;
  const parts: string[] = [];
  parser.on('doctype', () => {
    throw new Error('文档含不支持的 XML 声明，请另存为新的 DOCX');
  });
  parser.on('opentag', (tag) => {
    if (!WORD.has(tag.uri)) return;
    if (tag.local === 'body') {
      body++;
      found = true;
    }
    if (!body) return;
    if (tag.local === 'del') deleted++;
    if (deleted) return;
    if (tag.local === 't') text++;
    if (tag.local === 'tab') parts.push('\t');
    if (tag.local === 'br' || tag.local === 'cr') parts.push('\n');
  });
  parser.on('text', (value) => {
    if (body && text && !deleted) parts.push(value);
  });
  parser.on('cdata', (value) => {
    if (body && text && !deleted) parts.push(value);
  });
  parser.on('closetag', (tag) => {
    if (!WORD.has(tag.uri)) return;
    if (tag.local === 'del') {
      deleted--;
      return;
    }
    if (!body || deleted) return;
    if (tag.local === 't') text--;
    if (tag.local === 'p') parts.push('\n\n');
    if (tag.local === 'body') body--;
  });
  try {
    parser.write(xml).close();
  } catch {
    throw new Error('DOCX 正文损坏，请用 Word 另存后再试');
  }
  if (!found) throw new Error('DOCX 中没有找到正文，请换一个文件');
  return parts.join('').replace(/\n+$/, '');
}
export async function readDocx(file: Blob): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error('DOCX 超过 50 MB，请拆分文档后重试');
  const chunks: Uint8Array[] = [];
  let size = 0,
    found = false,
    finished = false;
  const unzip = new Unzip((entry) => {
    if (entry.name !== 'word/document.xml') return;
    if (found) throw new Error('DOCX 中有重复正文，请另存文件后重试');
    found = true;
    if ((entry.originalSize || 0) > LIMIT) throw new Error('解压后的正文超过 20 MB，请拆分文档');
    entry.ondata = (error, data, final) => {
      if (error) throw new Error('DOCX 解压失败，请确认文件没有损坏');
      size += data.length;
      if (size > LIMIT) throw new Error('解压后的正文超过 20 MB，请拆分文档');
      chunks.push(data);
      finished = final;
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  // 小块送入解压器，限制单次解压膨胀；图片等其他条目不启动解压。
  for (let offset = 0; offset < file.size; offset += 65536) {
    const chunk = new Uint8Array(await file.slice(offset, offset + 65536).arrayBuffer());
    for (let i = 0; i < chunk.length; i += 1024) unzip.push(chunk.subarray(i, i + 1024), offset + i + 1024 >= file.size);
  }
  if (!found || !finished) throw new Error('没有找到完整 DOCX 正文，请确认文件格式');
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return documentText(new TextDecoder('utf-8', { fatal: true }).decode(data));
}

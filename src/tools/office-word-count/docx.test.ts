import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { documentText, readDocx } from './docx';
const wrap = (s: string) =>
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${s}</w:body></w:document>`;
describe('DOCX 正文', () => {
  it('保留实体、段落、表格和制表符，排除删除修订', async () => {
    const xml = wrap(
      '<w:p><w:r><w:t>你&amp;我&#x1F600;</w:t><w:tab/><w:t>好</w:t></w:r><w:del><w:r><w:delText>删除</w:delText></w:r></w:del></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
    );
    const bytes = zipSync({ 'word/document.xml': strToU8(xml), other: strToU8('ignore') });
    expect(await readDocx(new Blob([bytes]))).toBe('你&我😀\t好\n\n表格');
  });
  it('在解压前拒绝过大的正文声明', async () => {
    const bytes = zipSync({ 'word/document.xml': strToU8(wrap('<w:p/>')) });
    new DataView(bytes.buffer).setUint32(22, 21 * 1024 * 1024, true);
    await expect(readDocx(new Blob([bytes]))).rejects.toThrow('20 MB');
  });
  it('拒绝外部实体与损坏 XML', () => {
    expect(() => documentText('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///secret">]>' + wrap('<w:p>&a;</w:p>'))).toThrow();
    expect(() => documentText(wrap('<w:p>'))).toThrow();
  });
  it('拒绝缺失正文和超大输入', async () => {
    await expect(readDocx(new Blob([zipSync({ x: strToU8('x') })]))).rejects.toThrow('正文');
    await expect(readDocx({ size: 51 * 1024 * 1024 } as Blob)).rejects.toThrow('50 MB');
  });
});

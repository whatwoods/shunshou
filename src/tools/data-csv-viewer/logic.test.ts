import { describe, expect, it } from 'vitest';
import { fromRows, importRequest, parseCsv, rowIndexes, dataDefaults } from '../../lib/dataCore';
import { detectEncoding, readCsv } from '../../lib/dataReader';
describe('CSV 查看器', () => {
  it('解析换行引号与重复表头', () =>
    expect(parseCsv('姓名,姓名,备注\r\n甲,乙,"第一行\n第二行"').columns).toEqual(['姓名', '姓名_2', '备注']));
  it('保留 0 和 false，过滤并以数字顺序排序', () => {
    const table = fromRows([['值'], [10], [2], [0], [false]], true, true);
    expect(rowIndexes(table, { filter: '', sort: 0, descending: false }).slice(0, 3)).toEqual([2, 1, 0]);
    expect(rowIndexes(table, { filter: 'false', sort: -1, descending: false })).toEqual([3]);
  });
  it('处理 TSV 和尾部空行', () => expect(parseCsv('a\tb\n1\t2\n', dataDefaults).rows).toEqual([['1', '2']]));
  it('自动识别 UTF-8、GBK 和 BOM', async () => {
    expect(await detectEncoding(new Blob(['中文']))).toBe('utf-8');
    expect(await detectEncoding(new Blob([new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])]))).toBe('gb18030');
    expect(await detectEncoding(new Blob([new Uint8Array([0xff, 0xfe, 0x61, 0])]))).toBe('utf-16le');
  });
});

it('CSV 流跨中文字节、引号和 CRLF 边界保持完整', async () => {
  const csv = '姓名,备注\r\n小顺,"第一行\r\n第二行"\r\n中文,值';
  const file = new File([csv], 'test.csv');
  expect(await readCsv(file, dataDefaults, undefined, 7)).toEqual(parseCsv(csv));
});
it('GBK 流跨字符边界解码', async () => {
  const file = new File([new Uint8Array([0x61, 0x0a, 0xd6, 0xd0, 0xce, 0xc4])], 'gbk.csv');
  expect((await readCsv(file, dataDefaults, undefined, 3)).rows).toEqual([['中文']]);
});

it('File.text 方法不应被识别成文本输入', () => {
  const file = new File(['a,b\n1,2'], 'test.csv');
  expect(importRequest(file, dataDefaults)).toEqual({ action: 'load', file, options: dataDefaults });
  expect(importRequest({ text: 'a,b', format: 'csv' }, dataDefaults).action).toBe('text');
});

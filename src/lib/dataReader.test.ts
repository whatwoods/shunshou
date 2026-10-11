// 编码：开头 64 KB 全是 ASCII、中文在很后面的 GBK 表格，自动模式也要读对；手动选错编码时要报错，不能静默变乱码
import { expect, it } from 'vitest';
import { dataDefaults } from './dataCore';
import { readCsv } from './dataReader';

const late = () => {
  const head = new TextEncoder().encode('name\n' + 'a\n'.repeat(33000));
  const tail = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4, 0x0a]); // GBK 的“中文”
  const bytes = new Uint8Array(head.length + tail.length);
  bytes.set(head);
  bytes.set(tail, head.length);
  return new File([bytes], 'late.csv');
};

it('自动编码：64 KB 之后才出现的 GBK 中文不会变乱码', async () => {
  const table = await readCsv(late(), dataDefaults, undefined, 4096);
  expect(table.rows.at(-1)).toEqual(['中文']);
  expect(table.rows).toHaveLength(33001);
});

it('手动选 UTF-8 但文件不是：给出能照着做的提示', async () => {
  await expect(readCsv(late(), { ...dataDefaults, encoding: 'utf-8' })).rejects.toThrow(/GB18030/);
});

it('手动选 GB18030 照常读', async () => {
  const table = await readCsv(late(), { ...dataDefaults, encoding: 'gb18030' });
  expect(table.rows.at(-1)).toEqual(['中文']);
});

it('普通 UTF-8 文件照常读', async () => {
  const table = await readCsv(new File(['名字,城市\n小顺,杭州\n'], 'a.csv'), dataDefaults);
  expect(table).toEqual({ columns: ['名字', '城市'], rows: [['小顺', '杭州']] });
});

import { expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { readFileTables } from '../../lib/dataReader';
import { dataDefaults } from '../../lib/dataCore';
for (const bookType of ['xlsx', 'xls', 'ods'] as const) {
  it(`真实读写 ${bookType} 多工作表与中文`, async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['姓名', '数量'],
        ['小顺', 12],
        ['空值', 0]
      ]),
      '中文表'
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['a'], ['b']]), '第二页');
    const bytes = XLSX.write(workbook, { bookType, type: 'array' });
    const result = await readFileTables(new File([bytes], `test.${bookType}`), { ...dataDefaults, infer: true });
    expect(Object.keys(result)).toEqual(['中文表', '第二页']);
    expect(result['中文表'].rows).toEqual([
      ['小顺', 12],
      ['空值', 0]
    ]);
  });
}

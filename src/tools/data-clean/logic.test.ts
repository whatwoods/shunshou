import { expect, it } from 'vitest';
import { cleanTable, cleanDefaults, parseCsv, dataDefaults } from '../../lib/dataCore';
it('清洗后去重保留原数据，保留 0 与 false', () => {
  const source = { columns: ['a'], rows: [[' A '], ['a'], [' '], [0], [false]] };
  expect(cleanTable(source, { ...cleanDefaults, casing: 'lower' }).rows).toEqual([['a'], [0], [false]]);
  expect(source.rows[0]).toEqual([' A ']);
});
it('拆分补齐空值并避免重名列，合并按给定列顺序', () => {
  const source = {
    columns: ['a', 'a_1'],
    rows: [
      ['x,y', 'z'],
      ['x', 'q']
    ]
  };
  const split = cleanTable(source, { ...cleanDefaults, splitColumn: 0 });
  expect(split.columns).toEqual(['a_1', 'a_2', 'a_1_2']);
  expect(split.rows).toEqual([
    ['x', 'y', 'z'],
    ['x', '', 'q']
  ]);
  expect(cleanTable(source, { ...cleanDefaults, mergeColumns: [0, 1], mergeSeparator: '-' }).rows[0]).toEqual(['x,y', 'z', 'x,y-z']);
});
it('去空行可以关闭，字面替换不会执行正则', () => {
  const source = parseCsv('a,b\nx.*,y\n,\n', { ...dataDefaults, keepEmpty: true });
  const result = cleanTable(source, { ...cleanDefaults, empty: false, dedupe: false, find: '.*', replace: '!' });
  expect(result.rows[0]).toEqual(['x!', 'y']);
  expect(result.rows.length).toBe(3);
});

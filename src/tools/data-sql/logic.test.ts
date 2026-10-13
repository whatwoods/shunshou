import { beforeAll, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { importTable, queryTable } from './logic';
let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});
it('导入特殊表名并运行聚合和 JOIN', () => {
  const db = new SQL.Database();
  const table = {
    columns: ['name', 'amount'],
    rows: [
      ['a', 2],
      ['a', 3],
      ['b', 8]
    ]
  };
  expect(importTable(db, 'a"b', table)).toBe('a"b');
  expect(importTable(db, 'a"b', table)).toBe('a"b_2');
  expect(queryTable(db, 'SELECT name, SUM(amount) AS total FROM "a""b" GROUP BY name ORDER BY name').rows).toEqual([
    ['a', 5],
    ['b', 8]
  ]);
  expect(queryTable(db, 'SELECT COUNT(*) FROM "a""b" a JOIN "a""b_2" b ON a.name=b.name').rows).toEqual([[5]]);
  db.close();
});
it('表头大小写不敏感去重，SQL失败不吞错', () => {
  const db = new SQL.Database();
  importTable(db, 'data', { columns: ['A', 'a'], rows: [[false, null]] });
  expect(queryTable(db, 'SELECT * FROM data')).toEqual({ columns: ['A', 'a_2'], rows: [[0, null]] });
  expect(() => queryTable(db, 'SELECT FROM')).toThrow();
  db.close();
});
it('读取真实 Parquet 并导入 SQLite', async () => {
  const { readFileSync } = await import('node:fs');
  const { readFileTables } = await import('../../lib/dataReader');
  const bytes = readFileSync(new URL('./fixtures/alltypes_plain.parquet', import.meta.url));
  const tables = await readFileTables(new File([bytes], 'alltypes_plain.parquet'));
  expect(tables['数据'].rows.length).toBe(8);
  expect(tables['数据'].columns).toContain('id');
  const db = new SQL.Database();
  importTable(db, 'parquet', tables['数据']);
  expect(queryTable(db, 'SELECT COUNT(*) FROM parquet').rows).toEqual([[8]]);
  db.close();
});

it('导出 JSON 时同名列不会互相覆盖', async () => {
  const { toJson } = await import('../../lib/dataCore');
  expect(JSON.parse(toJson({ columns: ['id', 'id', 'id_2'], rows: [[1, 2, 3]] }))).toEqual([{ id: 1, id_2: 2, id_2_2: 3 }]);
});
it('64 位整数查询和导出保留精度，安全整数仍是数字', () => {
  const db = new SQL.Database();
  try {
    expect(queryTable(db, 'SELECT 9007199254740993 AS big, -9223372036854775808 AS negative, 42 AS small, 2.5 AS decimal').rows).toEqual([
      ['9007199254740993', '-9223372036854775808', 42, 2.5]
    ]);
  } finally {
    db.close();
  }
});

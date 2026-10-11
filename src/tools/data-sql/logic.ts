import type { Database } from 'sql.js';
import { cellText, type TableData } from '../../lib/dataCore';
export const quoteIdentifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
export function importTable(db: Database, suggested: string, table: TableData): string {
  if (!table.columns.length) throw new Error('表格没有列，可能是空文件。');
  const existing = new Set(
    (db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values ?? []).map((row) => String(row[0]).toLowerCase())
  );
  let name = suggested || 'data';
  for (let i = 2; existing.has(name.toLowerCase()); i++) name = `${suggested}_${i}`;
  const names = new Set<string>();
  const columns = table.columns.map((column) => {
    let c = column;
    for (let i = 2; names.has(c.toLowerCase()); i++) c = `${column}_${i}`;
    names.add(c.toLowerCase());
    return c;
  });
  db.run('BEGIN');
  try {
    db.run(`CREATE TABLE ${quoteIdentifier(name)} (${columns.map(quoteIdentifier).join(',')})`);
    const statement = db.prepare(`INSERT INTO ${quoteIdentifier(name)} VALUES (${columns.map(() => '?').join(',')})`);
    try {
      for (const row of table.rows) statement.run(columns.map((_, i) => (typeof row[i] === 'boolean' ? Number(row[i]) : (row[i] ?? null))));
    } finally {
      statement.free();
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
  return name;
}
export function queryTable(db: Database, query: string): TableData {
  if (!query.trim()) throw new Error('先写一条 SQL，例如 SELECT * FROM "data" LIMIT 100。');
  const results = db.exec(query);
  const last = results.at(-1);
  return last
    ? {
        columns: last.columns,
        rows: last.values.map((row) =>
          row.map((v) =>
            v instanceof Uint8Array
              ? Array.from(v, (byte) => byte.toString(16).padStart(2, '0')).join('')
              : typeof v === 'number' || v == null
                ? v
                : cellText(v)
          )
        )
      }
    : { columns: [], rows: [] };
}

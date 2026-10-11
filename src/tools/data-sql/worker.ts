import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readFileTables } from '../../lib/dataReader';
import { dataDefaults, toCsv, toJson, type TableData } from '../../lib/dataCore';
import { importTable, queryTable, quoteIdentifier } from './logic';
let database: Database | undefined;
let result: TableData = { columns: [], rows: [] };
async function getDb() {
  if (!database) {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    database = new SQL.Database();
  }
  return database;
}
function schema(db: Database) {
  return (db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values ?? []).map(
    (row) => ({
      name: String(row[0]),
      columns: (db.exec(`PRAGMA table_info(${quoteIdentifier(String(row[0]))})`)[0]?.values ?? []).map((column) => String(column[1]))
    })
  );
}
type Request = { id: number } & (
  | { action: 'load'; file: File }
  | { action: 'query'; query: string }
  | { action: 'view'; start: number; limit: number }
  | { action: 'export'; format: 'csv' | 'json' }
);
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const db = await getDb();
    let value: unknown;
    if (data.action === 'load') {
      const tables = await readFileTables(data.file, { ...dataDefaults, infer: true }, (rows) =>
        self.postMessage({ id: data.id, progress: `正在读入 ${rows.toLocaleString()} 行…` })
      );
      const base = data.file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_]/gu, '_') || 'data';
      const imported = Object.entries(tables).map(([name, table]) =>
        importTable(db, Object.keys(tables).length === 1 ? base : `${base}_${name}`, table)
      );
      value = { tables: schema(db), imported };
    } else if (data.action === 'query') {
      result = queryTable(db, data.query);
      value = { columns: result.columns, count: result.rows.length, tables: schema(db) };
    } else if (data.action === 'view') {
      value = {
        columns: result.columns,
        total: result.rows.length,
        rows: result.rows.slice(data.start, data.start + data.limit),
        start: data.start
      };
    } else {
      value = new Blob([data.format === 'csv' ? '\uFEFF' + toCsv(result) : toJson(result)], {
        type: data.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
      });
    }
    self.postMessage({ id: data.id, value });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};

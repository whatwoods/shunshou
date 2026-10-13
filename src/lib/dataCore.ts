import Papa from 'papaparse';
import { visit } from 'jsonc-parser';

export type Cell = string | number | boolean | null;
export interface TableData {
  columns: string[];
  rows: Cell[][];
}
export interface ParseOptions {
  delimiter: string;
  header: boolean;
  infer: boolean;
  encoding: string;
  keepEmpty?: boolean;
}
export const dataDefaults: ParseOptions = { delimiter: '', header: true, infer: false, encoding: 'auto' };
export const cellText = (value: unknown): string =>
  value == null ? '' : typeof value === 'object' ? JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? String(v) : v)) : String(value);
export function uniqueColumns(names: unknown[]): string[] {
  const used = new Set<string>();
  return names.map((name, i) => {
    const base = cellText(name).trim() || `列 ${i + 1}`;
    let result = base;
    for (let n = 2; used.has(result); n++) result = `${base}_${n}`;
    used.add(result);
    return result;
  });
}
export function inferCell(value: unknown): Cell {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const s = cellText(value);
  if (s === '') return null;
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n;
  }
  return s;
}
export function fromRows(rows: unknown[][], header = true, infer = false): TableData {
  if (!rows.length) return { columns: [], rows: [] };
  const width = rows.reduce((n, row) => Math.max(n, row.length), 0);
  const columns = uniqueColumns(Array.from({ length: width }, (_, i) => (header ? rows[0][i] : `列 ${i + 1}`)));
  return {
    columns,
    rows: rows
      .slice(header ? 1 : 0)
      .map((row) =>
        columns.map((_, i) =>
          infer
            ? inferCell(row[i])
            : typeof row[i] === 'number' || typeof row[i] === 'boolean'
              ? (row[i] as number | boolean)
              : cellText(row[i])
        )
      )
  };
}
export function fromJson(value: unknown): TableData {
  if (!Array.isArray(value)) throw new Error('JSON 顶层需要是数组，例如 [{"姓名":"小顺"}]。');
  if (!value.length) return { columns: [], rows: [] };
  const cell = (v: unknown): Cell => (typeof v === 'number' || typeof v === 'boolean' || v == null ? (v ?? null) : cellText(v));
  if (value.every(Array.isArray)) {
    const width = value.reduce((n, row) => Math.max(n, row.length), 0);
    const columns = Array.from({ length: width }, (_, i) => `列 ${i + 1}`);
    return { columns, rows: value.map((row) => columns.map((_, i) => cell(row[i]))) };
  }
  if (!value.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('数组里要么全是对象，要么全是数组。');
  const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
  return {
    columns,
    rows: value.map((row) =>
      columns.map((key) => {
        // 只读自身的字段：这一行没有 constructor、toString 这类键时，不能读到 Object 原型上的函数
        const v = Object.hasOwn(row, key) ? row[key] : null;
        return cell(v);
      })
    )
  };
}
export function parseJson(text: string): TableData {
  text = text.replace(/^\uFEFF/, '');
  // 在 JSON.parse 转成 Number 之前保留超出安全范围的原文，避免大整数被静默舍入。
  let start = 0;
  const parts: string[] = [];
  visit(
    text,
    {
      onLiteralValue(value, offset, length) {
        if (typeof value !== 'number' || (Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)))) return;
        parts.push(text.slice(start, offset), JSON.stringify(text.slice(offset, offset + length)));
        start = offset + length;
      },
      onError() {
        throw new Error('JSON 格式不完整，请检查引号、逗号和括号。');
      }
    },
    { disallowComments: true }
  );
  parts.push(text.slice(start));
  return fromJson(JSON.parse(parts.join('')));
}
export function parseCsv(text: string, opts: ParseOptions = dataDefaults): TableData {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimiter: opts.delimiter,
    skipEmptyLines: opts.keepEmpty ? false : 'greedy'
  });
  const error = result.errors.find((e) => e.code !== 'UndetectableDelimiter');
  if (error) throw new Error(`CSV 第 ${(error.row ?? 0) + 1} 行格式不完整：${error.message}`);
  return fromRows(result.data, opts.header, opts.infer);
}
export function toCsv(data: TableData, delimiter = ',', header = true): string {
  return Papa.unparse(header ? [data.columns, ...data.rows] : data.rows, {
    delimiter: delimiter || ',',
    newline: '\r\n',
    escapeFormulae: true
  });
}
// 列名重复时（例如 SELECT a.id, b.id）加 _2、_3 后缀，否则后一列会覆盖前一列
export function uniqueKeys(columns: string[]): string[] {
  const used = new Set<string>();
  return columns.map((column) => {
    let key = column;
    for (let i = 2; used.has(key); i++) key = `${column}_${i}`;
    used.add(key);
    return key;
  });
}
export function toJson(data: TableData): string {
  const keys = uniqueKeys(data.columns);
  return JSON.stringify(
    data.rows.map((row) => Object.fromEntries(keys.map((key, i) => [key, row[i] ?? null]))),
    null,
    2
  );
}
export interface ViewOptions {
  filter: string;
  sort: number;
  descending: boolean;
}
export function rowIndexes(data: TableData, options: ViewOptions): number[] {
  const filter = options.filter.toLocaleLowerCase();
  const indexes: number[] = [];
  data.rows.forEach((row, i) => {
    if (!filter || row.some((v) => cellText(v).toLocaleLowerCase().includes(filter))) indexes.push(i);
  });
  if (options.sort >= 0)
    indexes.sort((a, b) => {
      const x = data.rows[a][options.sort],
        y = data.rows[b][options.sort];
      const cmp =
        typeof x === 'number' && typeof y === 'number' ? x - y : cellText(x).localeCompare(cellText(y), 'zh-CN', { numeric: true });
      return options.descending ? -cmp : cmp;
    });
  return indexes;
}
export interface CleanOptions {
  trim: boolean;
  empty: boolean;
  dedupe: boolean;
  casing: 'keep' | 'lower' | 'upper';
  find: string;
  replace: string;
  splitColumn: number;
  separator: string;
  mergeColumns: number[];
  mergeSeparator: string;
}
export const cleanDefaults: CleanOptions = {
  trim: true,
  empty: true,
  dedupe: true,
  casing: 'keep',
  find: '',
  replace: '',
  splitColumn: -1,
  separator: ',',
  mergeColumns: [],
  mergeSeparator: ' '
};
export function cleanTable(source: TableData, options: CleanOptions): TableData {
  let columns = [...source.columns];
  let rows = source.rows.map((row) =>
    row.map((value) => {
      if (typeof value !== 'string') return value;
      let v = options.trim ? value.trim() : value;
      if (options.casing === 'lower') v = v.toLocaleLowerCase();
      if (options.casing === 'upper') v = v.toLocaleUpperCase();
      if (options.find) v = v.split(options.find).join(options.replace);
      return v;
    })
  );
  if (options.empty) rows = rows.filter((row) => row.some((v) => cellText(v).trim() !== ''));
  if (options.splitColumn >= 0 && options.splitColumn < columns.length && options.separator) {
    const column = options.splitColumn;
    const parts = rows.map((row) => cellText(row[column]).split(options.separator));
    const width = parts.reduce((n, row) => Math.max(n, row.length), 1);
    columns.splice(column, 1, ...Array.from({ length: width }, (_, i) => `${columns[column]}_${i + 1}`));
    rows = rows.map((row, i) => [
      ...row.slice(0, column),
      ...Array.from({ length: width }, (_, j) => parts[i][j] ?? ''),
      ...row.slice(column + 1)
    ]);
  }
  if (options.mergeColumns.length) {
    // 合并索引始终指向导入时的列，避免拆分后索引漂移。
    if (options.splitColumn >= 0) throw new Error('拆分和合并不能同时做，请先拆分导出。');
    columns.push('合并列');
    rows = rows.map((row) => [...row, options.mergeColumns.map((i) => cellText(row[i])).join(options.mergeSeparator)]);
  }
  if (options.dedupe) {
    const seen = new Set<string>();
    rows = rows.filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return { columns: uniqueColumns(columns), rows };
}
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';
export interface ChartPoint {
  label: string;
  x: number;
  y: number;
}
export function chartPoints(data: TableData, x: number, y: number): ChartPoint[] {
  return data.rows.flatMap((row, i) => {
    if (cellText(row[y]).trim() === '') return [];
    const n = Number(row[y]);
    return Number.isFinite(n)
      ? [{ label: cellText(row[x]), x: Number.isFinite(Number(row[x])) && cellText(row[x]).trim() !== '' ? Number(row[x]) : i, y: n }]
      : [];
  });
}
// 大多数非空单元格是数字的列（看前 200 行）。图表默认拿第一列这样的列当数值轴，免得选到文字列画出空图
export function numericColumns(data: TableData, sample = 200): number[] {
  const rows = data.rows.slice(0, sample);
  return data.columns.flatMap((_, c) => {
    let filled = 0,
      nums = 0;
    for (const row of rows) {
      if (cellText(row[c]).trim() === '') continue;
      filled++;
      if (Number.isFinite(Number(row[c]))) nums++;
    }
    return filled > 0 && nums >= filled * 0.8 ? [c] : [];
  });
}
export function recommendChart(data: TableData): ChartType {
  if (data.rows.length && data.rows.every((row) => cellText(row[0]).trim() !== '' && Number.isFinite(Number(row[0])))) return 'scatter';
  if (data.rows.some((row) => /^\d{4}[-/]\d{1,2}/.test(cellText(row[0])))) return 'line';
  const values = data.rows.map((row) => Number(row[1]));
  if (
    values.length > 1 &&
    values.length <= 8 &&
    values.every((v) => Number.isFinite(v) && v > 0) &&
    Math.abs(values.reduce((sum, v) => sum + v, 0) - 100) < 0.01
  )
    return 'pie';
  return 'bar';
}

export function importRequest(input: File | { text: string; format: 'csv' | 'json' }, options: ParseOptions) {
  // File 也有 Blob.text() 方法，不能用是否存在 text 属性来区分。
  return input instanceof Blob ? { action: 'load' as const, file: input, options } : { action: 'text' as const, ...input, options };
}

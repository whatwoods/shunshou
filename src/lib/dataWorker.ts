import {
  chartPoints,
  cleanTable,
  dataDefaults,
  parseJson,
  parseCsv,
  numericColumns,
  recommendChart,
  rowIndexes,
  toCsv,
  toJson,
  type CleanOptions,
  type ParseOptions,
  type TableData,
  type ViewOptions
} from './dataCore';
import { readFileTables } from './dataReader';
export interface TableSummary {
  name: string;
  columns: string[];
  count: number;
  numeric: number[]; // 数字列的下标
}
export interface TableView {
  columns: string[];
  rows: TableData['rows'];
  total: number;
  start: number;
}
export interface ChartResult {
  points: ReturnType<typeof chartPoints>;
  recommended: ReturnType<typeof recommendChart>;
  total: number;
}
type Request =
  | { action: 'load'; file: File; options: ParseOptions }
  | { action: 'text'; text: string; format: 'csv' | 'json'; options: ParseOptions }
  | { action: 'view'; cleaned?: boolean; sheet: string; options: ViewOptions; start: number; limit: number }
  | {
      action: 'export';
      cleaned?: boolean;
      sheet: string;
      format: 'csv' | 'json';
      delimiter?: string;
      header?: boolean;
      options?: ViewOptions;
    }
  | { action: 'clean'; sheet: string; options: CleanOptions }
  | { action: 'chart'; sheet: string; x: number; y: number };
let tables: Record<string, TableData> = {};
let cleanedTable: TableData | undefined;
let cached: { table: TableData; key: string; indexes: number[] } | undefined;
const summary = (): TableSummary[] =>
  Object.entries(tables).map(([name, data]) => ({ name, columns: data.columns, count: data.rows.length, numeric: numericColumns(data) }));
function indexes(table: TableData, options: ViewOptions) {
  const key = JSON.stringify(options);
  if (!cached || cached.table !== table || cached.key !== key) cached = { table, key, indexes: rowIndexes(table, options) };
  return cached.indexes;
}
self.onmessage = async (event: MessageEvent<Request & { id: number }>) => {
  const req = event.data;
  try {
    let value: unknown;
    if (req.action === 'load') {
      tables = await readFileTables(req.file, req.options ?? dataDefaults, (rows) =>
        self.postMessage({ id: req.id, progress: `已读取 ${rows.toLocaleString()} 行…` })
      );
      cached = undefined;
      cleanedTable = undefined;
      value = summary();
    } else if (req.action === 'text') {
      tables = { 数据: req.format === 'json' ? parseJson(req.text) : parseCsv(req.text, req.options) };
      cached = undefined;
      cleanedTable = undefined;
      value = summary();
    } else {
      const table = 'cleaned' in req && req.cleaned ? cleanedTable : tables[req.sheet];
      if (!table) throw new Error('请先导入文件或粘贴数据。');
      if (req.action === 'view') {
        const order = indexes(table, req.options);
        value = {
          columns: table.columns,
          rows: order.slice(req.start, req.start + req.limit).map((i) => table.rows[i]),
          total: order.length,
          start: req.start
        };
      } else if (req.action === 'export') {
        const selected = req.options ? { columns: table.columns, rows: indexes(table, req.options).map((i) => table.rows[i]) } : table;
        const text = req.format === 'json' ? toJson(selected) : toCsv(selected, req.delimiter, req.header);
        value = {
          blob: new Blob([req.format === 'csv' ? '\uFEFF' : '', text], {
            type: req.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
          }),
          preview: text.slice(0, 100000),
          truncated: text.length > 100000
        };
      } else if (req.action === 'clean') {
        cleanedTable = cleanTable(table, req.options);
        value = { name: '清洗结果', columns: cleanedTable.columns, count: cleanedTable.rows.length };
      } else if (req.action === 'chart') {
        const points = chartPoints(table, req.x, req.y);
        value = { points: points.slice(0, 2000), total: points.length, recommended: recommendChart(table) };
      }
    }
    self.postMessage({ id: req.id, value });
  } catch (error) {
    self.postMessage({ id: req.id, error: error instanceof Error ? error.message : String(error) });
  }
};

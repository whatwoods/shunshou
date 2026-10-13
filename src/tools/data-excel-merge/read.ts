// 读各人交上来的数据：Excel（xlsx / xls / ods，用 SheetJS 只读值）或 CSV。日期统一成 1900 日期系统的序号
import type { Source, SourceSheet } from './plan';
import type { Val } from './xlsx';
import { readCsv as readCsvTable } from '../../lib/dataReader';
import { dataDefaults } from '../../lib/dataCore';

let seq = 0;

export async function readSource(file: File): Promise<Source> {
  const id = `f${++seq}`;
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return { id, name: file.name, sheets: [await readCsv(file)] };
  const XLSX = await import('@e965/xlsx');
  if (/\.xls$/i.test(file.name)) XLSX.set_cptable(await import('@e965/xlsx/dist/cpexcel.full.mjs'));
  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellNF: true, cellDates: false, cellStyles: false });
  } catch {
    throw new Error(`“${file.name}”读不出来，换成 .xlsx 或 .csv 再试`);
  }
  const shift = wb.Workbook?.WBProps?.date1904 ? 1462 : 0;
  const sheets: SourceSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows: (Val | null)[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: (Val | null)[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let v: Val | null = null;
        if (cell && cell.v !== undefined && cell.v !== null && cell.t !== 'z' && cell.t !== 'e') {
          if (cell.t === 'n')
            v = cell.z && XLSX.SSF.is_date(String(cell.z)) ? { t: 'd', v: (cell.v as number) + shift } : { t: 'n', v: cell.v as number };
          else if (cell.t === 'b') v = { t: 'b', v: !!cell.v };
          else if (cell.t === 'd') v = { t: 's', v: String(cell.w ?? cell.v) };
          else v = String(cell.v) === '' ? null : { t: 's', v: String(cell.v) };
        }
        row[c] = v;
      }
      rows.push(row);
    }
    const merges = (ws['!merges'] ?? []).map((m) => ({ r1: m.s.r + 1, c1: m.s.c, r2: m.e.r + 1, c2: m.e.c }));
    sheets.push({ name, rows, merges });
  }
  return { id, name: file.name, sheets };
}

// CSV 与其他数据工具共用编码和引号解析，值保留为文字，写进模板时再按列转换。
async function readCsv(file: File): Promise<SourceSheet> {
  const table = await readCsvTable(file, {
    ...dataDefaults,
    header: false,
    delimiter: /\.tsv$/i.test(file.name) ? '\t' : ''
  });
  return {
    name: file.name.replace(/\.[^.]+$/, ''),
    rows: table.rows.map((row) => row.map((value) => (value === '' || value == null ? null : { t: 's' as const, v: String(value) }))),
    merges: []
  };
}

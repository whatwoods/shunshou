// 读各人交上来的数据：Excel（xlsx / xls / ods，用 SheetJS 只读值）或 CSV。日期统一成 1900 日期系统的序号
import type { Source, SourceSheet } from './plan';
import type { Val } from './xlsx';

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

// CSV：先按 UTF-8 解，出现乱码再按 GB18030（国内 Excel 另存的 CSV 常是这个编码）；值一律当文字，写进模板时再按列转数字
async function readCsv(file: File): Promise<SourceSheet> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('\uFFFD')) text = new TextDecoder('gb18030').decode(buf);
  text = text.replace(/^\uFEFF/, '');
  const delim = /\.tsv$/i.test(file.name) || text.split('\n')[0].split('\t').length > text.split('\n')[0].split(',').length ? '\t' : ',';
  const rows: (Val | null)[][] = [];
  let row: (Val | null)[] = [];
  let field = '';
  let quoted = false;
  const push = () => {
    row.push(field === '' ? null : { t: 's', v: field });
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) push();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      push();
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    push();
    rows.push(row);
  }
  return { name: file.name.replace(/\.[^.]+$/, ''), rows, merges: [] };
}

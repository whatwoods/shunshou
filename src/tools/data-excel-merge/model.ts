// 看懂模板：表头在哪一行、有哪些列、已有数据到哪、下面有没有留好格式的空行和合计行
import type { Cell, Grid, Val } from './xlsx';
import { isEmpty, normName, valText } from './values';

export interface Column {
  c: number;
  name: string;
}
export interface SheetModel {
  name: string;
  path: string;
  headerTop: number;
  headerRow: number;
  columns: Column[];
  dataStart: number;
  // 最后一行已有数据；没有数据时等于表头行
  lastData: number;
  // 数据区的最后一行（含已经留好格式的空行），新行先填这些空行
  areaEnd: number;
  // 底部固定行（合计、制表人这类）从哪一行开始
  footer: number | null;
  // 数据区里每行各列的值（不含公式算出来的）
  values: Map<number, Map<number, Val>>;
  // 有公式的列：新行照着这一行的公式抄
  formulas: Map<number, { r: number; f: string }>;
  // 序号列：新行接着往下编
  seq: number | null;
  grid: Grid;
}

const FOOTER_TEXT =
  /^(合\s*计|总\s*计|小\s*计|总\s*数|共\s*计)|^(total|sum|subtotal)\b|^(制表|审核|填表|填报|复核|负责人|签字|签名|批准|日期)\s*(人)?\s*[:：]/i;
const AGG = /\b(SUM|SUBTOTAL|AVERAGE|COUNTA?|MAX|MIN|SUMIFS?|COUNTIFS?|AGGREGATE)\s*\(/i;
const SEQ_NAME = /^(序号|序|编号|no\.?|#)$/i;

function cellAt(grid: Grid, r: number, c: number): Cell | undefined {
  return grid.rows.get(r)?.get(c);
}

// 被合并单元格盖住的格子，取合并区左上角的值（表头常见：“姓名”竖着占两行）
function headerName(grid: Grid, r: number, c: number): string {
  const v = cellAt(grid, r, c)?.v;
  if (v && v.t !== 'b') return valText(v).trim();
  const m = grid.merges.find((m) => m.r1 < r && r <= m.r2 && m.c1 === c && c <= m.c2);
  return m ? valText(cellAt(grid, m.r1, m.c1)?.v).trim() : '';
}

function rowNames(grid: Grid, r: number): string[] {
  const out: string[] = [];
  for (let c = 0; c <= grid.maxCol; c++) out[c] = headerName(grid, r, c);
  return out;
}

// 表头：前 30 行里不重复的文字最多的一行（标题行只有一格，排不上）；
// 两层表头（上面一格横着合并、下面分成几列）取下面那层
export function detectHeader(grid: Grid): number {
  let best = 1,
    score = 0;
  for (let r = 1; r <= Math.min(grid.maxRow, 30); r++) {
    const names = rowNames(grid, r).filter((n, i) => n && (cellAt(grid, r, i)?.v?.t ?? 's') === 's');
    const n = new Set(names).size;
    if (n > score) {
      score = n;
      best = r;
    }
  }
  for (let guard = 0; guard < 3; guard++) {
    const group = grid.merges.some((m) => m.r1 === best && m.r2 === best && m.c2 > m.c1);
    const tall = grid.merges.some((m) => m.r1 === best && m.r2 > best);
    const below = rowNames(grid, best + 1).filter(Boolean).length;
    if ((group || tall) && below >= 2) best++;
    else break;
  }
  return best;
}

export function headerTopOf(grid: Grid, headerRow: number): number {
  let top = headerRow;
  for (const m of grid.merges) if (m.r2 >= headerRow && m.r1 < top && m.r2 <= headerRow) top = m.r1;
  return top;
}

const hasLiteral = (cells: Map<number, Cell> | undefined, cols: Column[]) =>
  cols.some((col) => {
    const cell = cells?.get(col.c);
    return cell && !cell.f && !isEmpty(cell.v);
  });

function isFooterRow(grid: Grid, r: number): boolean {
  const cells = grid.rows.get(r);
  if (!cells) return false;
  const all = [...cells.values()];
  if (all.some((cell) => cell.v?.t === 's' && !cell.f && FOOTER_TEXT.test(cell.v.v.trim()))) return true;
  // 竖着求和的公式也算底部行，但这一行最多只有一格写死的文字（标签）；数据行里的累计公式不算
  const literals = all.filter((cell) => !cell.f && !isEmpty(cell.v)).length;
  return literals <= 1 && all.some((cell) => cell.f && AGG.test(cell.f) && /\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(?!\1\b)\d+/i.test(cell.f));
}

const formatted = (grid: Grid, r: number) => {
  const cells = grid.rows.get(r);
  return !!cells && [...cells.values()].some((c) => c.s || c.f);
};

export function buildModel(name: string, path: string, grid: Grid, opts: { headerRow?: number; footer?: number | null } = {}): SheetModel {
  const headerRow = opts.headerRow ?? detectHeader(grid);
  const names = rowNames(grid, headerRow);
  const columns: Column[] = [];
  names.forEach((n, c) => {
    // 表头里横着合并的一格，只算左上角那一列
    const covered = grid.merges.some((m) => m.r1 <= headerRow && headerRow <= m.r2 && m.c1 < c && c <= m.c2);
    if (n && !covered) columns.push({ c, name: n });
  });
  const dataStart = headerRow + 1;
  const lastRow = Math.max(grid.maxRow, ...[...grid.rows.keys()].filter((r) => formatted(grid, r)));
  let footer: number | null = null;
  if (opts.footer !== undefined) footer = opts.footer;
  else
    for (let r = dataStart; r <= grid.maxRow; r++)
      if (isFooterRow(grid, r)) {
        footer = r;
        break;
      }
  const stop = footer ?? lastRow + 1;
  let lastData = headerRow;
  for (let r = dataStart; r < stop; r++) if (hasLiteral(grid.rows.get(r), columns)) lastData = r;
  // 留好格式的空行：有合计行时数据和合计之间的都算；没有时到最后一行有格式的行为止
  let areaEnd = lastData;
  if (footer) areaEnd = Math.max(lastData, footer - 1);
  else
    for (let r = lastData + 1; r <= lastRow; r++)
      if (formatted(grid, r) && !hasLiteralAny(grid, r)) areaEnd = r;
      else if (hasLiteralAny(grid, r)) break;

  const values = new Map<number, Map<number, Val>>();
  for (let r = dataStart; r <= areaEnd; r++) {
    const row = new Map<number, Val>();
    for (const col of columns) {
      const cell = cellAt(grid, r, col.c);
      if (cell && !cell.f && !isEmpty(cell.v)) row.set(col.c, cell.v!);
    }
    values.set(r, row);
  }
  const formulas = new Map<number, { r: number; f: string }>();
  for (let r = areaEnd; r >= Math.max(dataStart, areaEnd - 50); r--) {
    for (const col of columns) {
      const f = cellAt(grid, r, col.c)?.f;
      if (f && !formulas.has(col.c)) formulas.set(col.c, { r, f });
    }
  }
  let seq: number | null = null;
  const seqCol = columns.find((c) => SEQ_NAME.test(normName(c.name)) && !formulas.has(c.c));
  if (seqCol) {
    const nums = [...values.values()].map((row) => row.get(seqCol.c)).filter((v) => v);
    if (nums.every((v) => v!.t === 'n' && Number.isInteger(v!.v))) seq = seqCol.c;
  }
  return {
    name,
    path,
    headerTop: headerTopOf(grid, headerRow),
    headerRow,
    columns,
    dataStart,
    lastData,
    areaEnd,
    footer,
    values,
    formulas,
    seq,
    grid
  };
}

const hasLiteralAny = (grid: Grid, r: number) => {
  const cells = grid.rows.get(r);
  return !!cells && [...cells.values()].some((c) => !c.f && !isEmpty(c.v));
};

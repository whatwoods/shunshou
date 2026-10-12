// 直接读写 .xlsx 里的 XML：只动要填的单元格，模板的样式、合并单元格、列宽、公式、图表原样保留。
// （SheetJS 社区版写文件时会丢掉样式，所以模板不经过它）
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { colName, copyFormula, parseCell, parseRange } from './refs';

export type Val = { t: 's'; v: string } | { t: 'n'; v: number } | { t: 'b'; v: boolean } | { t: 'd'; v: number };

export interface Cell {
  v: Val | null;
  // 公式（不带等号）；有公式的格子算“有内容”，不会被覆盖
  f?: string;
  s: number;
}
export interface Grid {
  rows: Map<number, Map<number, Cell>>;
  merges: { r1: number; c1: number; r2: number; c2: number }[];
  maxRow: number;
  maxCol: number;
}
export interface SheetRef {
  name: string;
  path: string;
  hidden: boolean;
}
export interface Book {
  files: Record<string, Uint8Array>;
  sheets: SheetRef[];
  strings: string[];
  // 每个单元格样式（cellXfs 的下标）是不是日期 / 数字格式
  dateStyle: boolean[];
  numStyle: boolean[];
  date1904: boolean;
}

export const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('表格文件里的内容读不出来，可能已经损坏');
  return doc;
}
export function xmlText(doc: Document): string {
  const s = new XMLSerializer().serializeToString(doc);
  return s.startsWith('<?xml') ? s : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + s;
}
// 同一命名空间下按本地名找元素（有的文件给元素加了 x: 这样的前缀）
export const kids = (el: Element | Document, name: string) => {
  const ns = (el instanceof Document ? el.documentElement : el).namespaceURI;
  return [...el.getElementsByTagNameNS(ns, name)];
};
export const child = (el: Element, name: string) => [...el.children].find((c) => c.localName === name) ?? null;

export function readText(book: Book, path: string): string | null {
  const f = book.files[path];
  return f ? strFromU8(f) : null;
}
export function writeText(book: Book, path: string, text: string) {
  book.files[path] = strToU8(text);
}

// 相对路径换成包里的绝对路径（“../drawings/drawing1.xml” → “xl/drawings/drawing1.xml”）
export function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}
export const relsPath = (path: string) => path.replace(/([^/]+)$/, '_rels/$1.rels');

export function readRels(book: Book, path: string): { id: string; type: string; target: string; el: Element }[] {
  const text = readText(book, relsPath(path));
  if (!text) return [];
  return [...parseXml(text).getElementsByTagNameNS(NS_PKG_REL, 'Relationship')].map((el) => ({
    id: el.getAttribute('Id') ?? '',
    type: el.getAttribute('Type') ?? '',
    target: el.getAttribute('TargetMode') === 'External' ? '' : resolvePath(path, el.getAttribute('Target') ?? ''),
    el
  }));
}

const BUILTIN_DATE = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58
]);
const BUILTIN_NUM = new Set([1, 2, 3, 4, 9, 10, 11, 12, 13, 37, 38, 39, 40, 41, 42, 43, 44, 48]);
export function isDateCode(code: string): boolean {
  // 去掉引号里的文字、[红色] 这类方括号（[h] [mm] 这类时长保留）、转义字符
  const plain = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, '');
  return /[ymdhs]/i.test(plain) && !/^[#0.,%\s]*$/.test(plain);
}

export function openBook(data: Uint8Array): Book {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('这不是 .xlsx 文件，或者文件已经损坏。旧版 .xls 请先在 Excel / WPS 里另存为 .xlsx');
  }
  const wbPath = Object.keys(files).find((p) => /^xl\/workbook\d*\.xml$/i.test(p));
  if (!wbPath) throw new Error('这个文件里没有工作簿，换一个 .xlsx 试试');
  const book: Book = { files, sheets: [], strings: [], dateStyle: [], numStyle: [], date1904: false };
  const wb = parseXml(strFromU8(files[wbPath]));
  const rels = new Map(readRels(book, wbPath).map((r) => [r.id, r]));
  for (const el of kids(wb, 'sheet')) {
    const rel = rels.get(el.getAttributeNS(NS_REL, 'id') ?? '');
    if (!rel || !/\/worksheet$/.test(rel.type) || !files[rel.target]) continue;
    book.sheets.push({
      name: el.getAttribute('name') ?? '',
      path: rel.target,
      hidden: (el.getAttribute('state') ?? 'visible') !== 'visible'
    });
  }
  const pr = kids(wb, 'workbookPr')[0];
  book.date1904 = /^(1|true)$/.test(pr?.getAttribute('date1904') ?? '');
  const sst = [...rels.values()].find((r) => /\/sharedStrings$/.test(r.type));
  if (sst && files[sst.target]) {
    book.strings = kids(parseXml(strFromU8(files[sst.target])), 'si').map(siText);
  }
  const st = [...rels.values()].find((r) => /\/styles$/.test(r.type));
  if (st && files[st.target]) {
    const doc = parseXml(strFromU8(files[st.target]));
    const codes = new Map(kids(doc, 'numFmt').map((n) => [+(n.getAttribute('numFmtId') ?? 0), n.getAttribute('formatCode') ?? '']));
    const xfs = kids(doc, 'cellXfs')[0];
    for (const xf of xfs ? [...xfs.children].filter((c) => c.localName === 'xf') : []) {
      const id = +(xf.getAttribute('numFmtId') ?? 0);
      const code = codes.get(id);
      const date = code !== undefined ? isDateCode(code) : BUILTIN_DATE.has(id);
      book.dateStyle.push(date);
      book.numStyle.push(!date && (code !== undefined ? /[0#]/.test(code.replace(/"[^"]*"/g, '')) : BUILTIN_NUM.has(id)));
    }
  }
  return book;
}

// 共享字符串：普通的 <t>，或者带格式的几段 <r><t>；注音（rPh）不算
function siText(si: Element): string {
  let s = '';
  for (const t of si.getElementsByTagNameNS(si.namespaceURI, 't')) {
    if (t.parentElement?.localName !== 'rPh') s += t.textContent ?? '';
  }
  return s;
}

// 把工作表里的 r 属性补齐：行和单元格都允许省略 r（按顺序排），统一写上以后好定位
export function normalizeRefs(doc: Document) {
  let rowNum = 0;
  for (const row of kids(doc, 'row')) {
    rowNum = +(row.getAttribute('r') ?? rowNum + 1);
    row.setAttribute('r', String(rowNum));
    let col = -1;
    for (const c of [...row.children].filter((e) => e.localName === 'c')) {
      const p = parseCell(c.getAttribute('r') ?? '');
      col = p ? p.c : col + 1;
      c.setAttribute('r', colName(col) + rowNum);
    }
  }
}

// 共享公式拆成每格各自的公式：之后复制、挪行都只需要处理普通公式
export function unshareFormulas(doc: Document) {
  const masters = new Map<string, { text: string; r: number; c: number }>();
  const fs = kids(doc, 'f').filter((f) => f.getAttribute('t') === 'shared');
  for (const f of fs) {
    if (f.getAttribute('ref') && f.textContent) {
      const p = parseCell(f.parentElement!.getAttribute('r') ?? '');
      if (p) masters.set(f.getAttribute('si') ?? '', { text: f.textContent, ...p });
    }
  }
  for (const f of fs) {
    const m = masters.get(f.getAttribute('si') ?? '');
    const p = parseCell(f.parentElement!.getAttribute('r') ?? '');
    if (m && p) f.textContent = copyFormula(m.text, p.r - m.r, p.c - m.c);
    f.removeAttribute('t');
    f.removeAttribute('si');
    f.removeAttribute('ref');
  }
}

// 读一张工作表：补齐行列号、拆开共享公式，再整理出各格的值
export function loadSheet(book: Book, path: string): { doc: Document; grid: Grid } {
  const doc = parseXml(readText(book, path) ?? '');
  normalizeRefs(doc);
  unshareFormulas(doc);
  return { doc, grid: readGrid(book, doc) };
}

export function cellValue(book: Book, c: Element): Val | null {
  const t = c.getAttribute('t') ?? 'n';
  const s = +(c.getAttribute('s') ?? 0);
  if (t === 'inlineStr') {
    const is = child(c, 'is');
    const text = is ? siText(is) : '';
    return text === '' ? null : { t: 's', v: text };
  }
  const v = child(c, 'v')?.textContent ?? '';
  if (v === '') return null;
  if (t === 's') {
    const text = book.strings[+v] ?? '';
    return text === '' ? null : { t: 's', v: text };
  }
  if (t === 'str' || t === 'e') return { t: 's', v };
  if (t === 'b') return { t: 'b', v: v === '1' };
  if (t === 'd') return { t: 's', v };
  const n = Number(v);
  if (!Number.isFinite(n)) return { t: 's', v };
  return book.dateStyle[s] ? { t: 'd', v: book.date1904 ? n + 1462 : n } : { t: 'n', v: n };
}

export function readGrid(book: Book, doc: Document): Grid {
  const grid: Grid = { rows: new Map(), merges: [], maxRow: 0, maxCol: -1 };
  for (const row of kids(doc, 'row')) {
    const r = +row.getAttribute('r')!;
    const cells = new Map<number, Cell>();
    for (const c of [...row.children].filter((e) => e.localName === 'c')) {
      const p = parseCell(c.getAttribute('r')!)!;
      const f = child(c, 'f');
      const cell: Cell = { v: cellValue(book, c), s: +(c.getAttribute('s') ?? 0) };
      if (f) cell.f = f.textContent ?? '';
      cells.set(p.c, cell);
      if (cell.v || cell.f) grid.maxCol = Math.max(grid.maxCol, p.c);
    }
    grid.rows.set(r, cells);
    if ([...cells.values()].some((c) => c.v || c.f)) grid.maxRow = Math.max(grid.maxRow, r);
  }
  for (const m of kids(doc, 'mergeCell')) {
    const rg = parseRange(m.getAttribute('ref') ?? '');
    if (rg) grid.merges.push(rg);
  }
  return grid;
}

export function zipBook(book: Book): Uint8Array {
  // [Content_Types].xml 放在最前面，有的读取程序只认这个顺序
  const names = Object.keys(book.files).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0));
  return zipSync(Object.fromEntries(names.map((n) => [n, book.files[n]])), { level: 6 });
}

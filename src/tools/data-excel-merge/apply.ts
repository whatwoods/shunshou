// 把汇总计划写进模板的 XML：已有行补空格；新行先用模板里留好格式的空行，不够再在合计行上面插行。
// 插行时和 Excel 的“插入行”一样，把下面的内容、合并单元格、条件格式、数据验证、表格、图片、批注、名称、图表、
// 数据透视的范围都往下挪；正好到数据最后一行为止的范围（合计的 SUM、筛选、表格、条件格式）跟着扩到新行
import type { SheetPlan } from './plan';
import { colName, copyFormula, mapFormulaRows, mapSqref, parseCell, parseRange, type RowMap } from './refs';
import {
  child,
  kids,
  loadSheet,
  NS_REL,
  parseXml,
  readGrid,
  readRels,
  readText,
  relsPath,
  writeText,
  xmlText,
  type Book,
  type Grid,
  type Val
} from './xlsx';
import { isEmpty, parseDate, serialText } from './values';

export interface ApplyOptions {
  highlight: boolean;
  renumber: boolean;
}
export interface SheetResult {
  name: string;
  grid: Grid;
  newRows: Set<number>;
  filled: Set<string>;
}

type Kind = 'formula' | 'merge' | 'range' | 'table' | 'filter';

// 这一张表的行号怎么变：插入（R 行及以下往下挪 extra 行）+ 到数据末尾为止的范围扩到新的末尾
function transformer(plan: SheetPlan) {
  const m = plan.model;
  const k = plan.appended.length;
  const slots = m.areaEnd - m.lastData;
  const extra = Math.max(0, k - slots);
  const R = m.areaEnd + 1;
  const newLast = m.lastData + k;
  const newEnd = m.areaEnd + extra;
  const sh = (r: number) => (r >= R ? r + extra : r);
  const range = (r1: number, r2: number, kind: Kind): [number, number] => {
    const a = sh(r1);
    let b = sh(r2);
    if (kind !== 'merge' && k) {
      if (r2 === m.areaEnd && m.areaEnd >= m.dataStart && extra) b = newEnd;
      else if (r2 === m.lastData && m.lastData >= m.dataStart) b = Math.max(b, newLast);
      else if ((kind === 'table' || kind === 'filter') && r2 === m.headerRow) b = Math.max(b, newLast);
    }
    return [a, b];
  };
  const formula: RowMap = (r1, r2, isRange) => (isRange ? range(r1, r2, 'formula') : [sh(r1), sh(r1)]);
  return { k, extra, R, newLast, sh, range, formula };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function el(doc: Document, name: string): Element {
  const root = doc.documentElement;
  return doc.createElementNS(root.namespaceURI, root.prefix ? `${root.prefix}:${name}` : name);
}

// 改一张工作表里所有和行号有关的东西（formulasOnly：别的表只改公式里指向这张表的引用）
function shiftSheetDoc(doc: Document, owner: string, target: string, t: ReturnType<typeof transformer>, own: boolean) {
  for (const f of doc.getElementsByTagNameNS('*', 'f')) {
    if (f.textContent) f.textContent = mapFormulaRows(f.textContent, owner, target, t.formula);
    if (own && f.getAttribute('ref')) f.setAttribute('ref', mapRef(f.getAttribute('ref')!, t, 'merge'));
  }
  for (const name of ['formula', 'formula1', 'formula2']) {
    for (const f of doc.getElementsByTagNameNS('*', name))
      if (f.textContent) f.textContent = mapFormulaRows(f.textContent, owner, target, t.formula);
  }
  if (!own) return;
  if (t.extra) {
    for (const row of kids(doc, 'row')) {
      const r = +row.getAttribute('r')!;
      if (r < t.R) continue;
      row.setAttribute('r', String(t.sh(r)));
      for (const c of [...row.children].filter((e) => e.localName === 'c')) {
        const p = parseCell(c.getAttribute('r')!)!;
        c.setAttribute('r', colName(p.c) + t.sh(r));
      }
    }
    for (const b of kids(doc, 'brk')) {
      const id = +(b.getAttribute('id') ?? 0);
      if (b.parentElement?.localName === 'rowBreaks' && id >= t.R - 1) b.setAttribute('id', String(id + t.extra));
    }
  }
  for (const m of kids(doc, 'mergeCell')) m.setAttribute('ref', mapRef(m.getAttribute('ref') ?? '', t, 'merge'));
  for (const h of kids(doc, 'hyperlink')) h.setAttribute('ref', mapRef(h.getAttribute('ref') ?? '', t, 'merge'));
  for (const a of kids(doc, 'autoFilter')) a.setAttribute('ref', mapRef(a.getAttribute('ref') ?? '', t, 'filter'));
  for (const name of ['conditionalFormatting', 'dataValidation', 'ignoredError', 'protectedRange']) {
    for (const e of kids(doc, name))
      if (e.getAttribute('sqref'))
        e.setAttribute(
          'sqref',
          mapSqref(e.getAttribute('sqref')!, (a, b) => t.range(a, b, 'range'))
        );
  }
  // x14 扩展里的条件格式和数据验证：<xm:sqref>
  for (const e of doc.getElementsByTagNameNS('*', 'sqref'))
    if (e.textContent) e.textContent = mapSqref(e.textContent, (a, b) => t.range(a, b, 'range'));
}

function mapRef(ref: string, t: ReturnType<typeof transformer>, kind: Kind): string {
  const rg = parseRange(ref);
  if (!rg) return ref;
  const [a, b] = t.range(rg.r1, rg.r2, kind);
  const one = !ref.includes(':');
  return one ? `${colName(rg.c1)}${a}` : `${colName(rg.c1)}${a}:${colName(rg.c2)}${b}`;
}

// 单元格写值：数字写数字；日期在日期格式的格子里写序号，否则写成文字；文字一律用内联字符串，不动共享字符串表
function writeValue(doc: Document, c: Element, v: Val, book: Book, numericCol: boolean) {
  for (const e of [...c.children]) if (e.localName === 'v' || e.localName === 'is') c.removeChild(e);
  const s = +(c.getAttribute('s') ?? 0);
  let val = v;
  if (val.t === 's' && book.dateStyle[s]) {
    const serial = parseDate(val.v);
    if (serial !== null) val = { t: 'd', v: serial };
  }
  if (val.t === 'd' && !book.dateStyle[s]) val = { t: 's', v: serialText(val.v) };
  if (val.t === 's' && numericCol && /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(val.v.trim())) val = { t: 'n', v: Number(val.v.trim()) };
  if (val.t === 's') {
    c.setAttribute('t', 'inlineStr');
    const is = el(doc, 'is');
    const tt = el(doc, 't');
    if (/^\s|\s$|\n/.test(val.v)) tt.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    tt.textContent = val.v;
    is.appendChild(tt);
    c.appendChild(is);
    return;
  }
  if (val.t === 'b') c.setAttribute('t', 'b');
  else c.removeAttribute('t');
  const ve = el(doc, 'v');
  ve.textContent = val.t === 'b' ? (val.v ? '1' : '0') : String(val.t === 'd' && book.date1904 ? val.v - 1462 : val.v);
  c.appendChild(ve);
}

function writeFormula(doc: Document, c: Element, f: string) {
  for (const e of [...c.children]) c.removeChild(e);
  c.removeAttribute('t');
  const fe = el(doc, 'f');
  fe.textContent = f;
  c.appendChild(fe);
}

function rowEl(doc: Document, sheetData: Element, r: number, create: boolean): Element | null {
  const rows = [...sheetData.children].filter((e) => e.localName === 'row');
  const hit = rows.find((e) => +e.getAttribute('r')! === r);
  if (hit || !create) return hit ?? null;
  const row = el(doc, 'row');
  row.setAttribute('r', String(r));
  sheetData.insertBefore(row, rows.find((e) => +e.getAttribute('r')! > r) ?? null);
  return row;
}
function cellEl(doc: Document, row: Element, col: number, style: number | null): Element {
  const cells = [...row.children].filter((e) => e.localName === 'c');
  const hit = cells.find((e) => parseCell(e.getAttribute('r')!)!.c === col);
  if (hit) return hit;
  const c = el(doc, 'c');
  c.setAttribute('r', colName(col) + row.getAttribute('r'));
  if (style) c.setAttribute('s', String(style));
  row.insertBefore(c, cells.find((e) => parseCell(e.getAttribute('r')!)!.c > col) ?? null);
  return c;
}
const cellEmpty = (c: Element) => !child(c, 'f') && !(child(c, 'v')?.textContent ?? '') && !(child(c, 'is')?.textContent ?? '');

// 列的默认样式（<col style>）
function colStyles(doc: Document): (c: number) => number | null {
  const cols = kids(doc, 'col').map((e) => ({
    min: +(e.getAttribute('min') ?? 0) - 1,
    max: +(e.getAttribute('max') ?? 0) - 1,
    s: +(e.getAttribute('style') ?? 0)
  }));
  return (c) => cols.find((x) => x.min <= c && c <= x.max)?.s || null;
}

// 标出新增和补充：给用到的样式各复制一份，只换底色
function highlighter(book: Book, path: string | null) {
  if (!path) return null;
  const doc = parseXml(readText(book, path) ?? '');
  const fills = kids(doc, 'fills')[0];
  const xfs = kids(doc, 'cellXfs')[0];
  if (!fills || !xfs) return null;
  const list = [...xfs.children].filter((e) => e.localName === 'xf');
  const addFill = (rgb: string) => {
    const fill = el(doc, 'fill');
    const p = el(doc, 'patternFill');
    p.setAttribute('patternType', 'solid');
    const fg = el(doc, 'fgColor');
    fg.setAttribute('rgb', rgb);
    const bg = el(doc, 'bgColor');
    bg.setAttribute('indexed', '64');
    p.append(fg, bg);
    fill.appendChild(p);
    fills.appendChild(fill);
    fills.setAttribute('count', String([...fills.children].filter((e) => e.localName === 'fill').length));
    return [...fills.children].filter((e) => e.localName === 'fill').length - 1;
  };
  const fillIds = { add: addFill('FFE3F4E6'), fill: addFill('FFFFF1D2') };
  const cache = new Map<string, number>();
  return {
    style(s: number, kind: 'add' | 'fill') {
      const key = `${kind}:${s}`;
      let id = cache.get(key);
      if (id === undefined) {
        const base = list[s] ?? list[0];
        const xf = base.cloneNode(true) as Element;
        xf.setAttribute('fillId', String(fillIds[kind]));
        xf.setAttribute('applyFill', '1');
        xfs.appendChild(xf);
        list.push(xf);
        id = list.length - 1;
        xfs.setAttribute('count', String(list.length));
        book.dateStyle[id] = book.dateStyle[s] ?? false;
        book.numStyle[id] = book.numStyle[s] ?? false;
        cache.set(key, id);
      }
      return id;
    },
    save() {
      writeText(book, path, xmlText(doc));
    }
  };
}

export function applyPlans(book: Book, plans: SheetPlan[], opts: ApplyOptions): SheetResult[] {
  const wbPath = Object.keys(book.files).find((p) => /^xl\/workbook\d*\.xml$/i.test(p))!;
  const wbRels = readRels(book, wbPath);
  const stylesPath = wbRels.find((r) => /\/styles$/.test(r.type))?.target ?? null;
  const hl = opts.highlight ? highlighter(book, stylesPath) : null;
  const results: SheetResult[] = [];

  for (const plan of plans) {
    const m = plan.model;
    const t = transformer(plan);
    const { doc } = loadSheet(book, m.path);
    // 新行照着哪一行的样式：留好的空行，或者最后一行数据
    const styleRow = m.areaEnd >= m.dataStart ? m.areaEnd : null;

    shiftSheetDoc(doc, m.name, m.name, t, true);
    if (t.extra) shiftAround(book, m, t);

    const sheetData = kids(doc, 'sheetData')[0];
    const colStyle = colStyles(doc);
    const styleCells = new Map<number, number>();
    const styleRowEl = styleRow ? rowEl(doc, sheetData, styleRow, false) : null;
    for (const c of styleRowEl ? [...styleRowEl.children].filter((e) => e.localName === 'c') : []) {
      styleCells.set(parseCell(c.getAttribute('r')!)!.c, +(c.getAttribute('s') ?? 0));
    }
    const numericCols = new Set<number>();
    for (const col of m.columns) {
      const vals = [...m.values.values()].map((r) => r.get(col.c)).filter((v) => v);
      const s = styleCells.get(col.c) ?? colStyle(col.c) ?? 0;
      if ((vals.length && vals.filter((v) => v!.t === 'n').length / vals.length >= 0.8) || book.numStyle[s]) numericCols.add(col.c);
    }
    // 有公式的列：读挪过行号之后的公式，新行再按相对位置抄
    const patterns = new Map<number, { r: number; f: string }>();
    for (const [c, p] of m.formulas) {
      const row = rowEl(doc, sheetData, p.r, false);
      const cell = row ? [...row.children].find((e) => e.localName === 'c' && parseCell(e.getAttribute('r')!)!.c === c) : undefined;
      const f = cell ? child(cell, 'f')?.textContent : null;
      if (f) patterns.set(c, { r: p.r, f });
    }

    const newRows = new Set<number>();
    const filled = new Set<string>();
    const mark = (c: Element, kind: 'add' | 'fill') => {
      if (!hl) return;
      c.setAttribute('s', String(hl.style(+(c.getAttribute('s') ?? 0), kind)));
    };

    // 1. 已有行补空格
    for (const [r, cols] of plan.fills) {
      const row = rowEl(doc, sheetData, r, true)!;
      for (const [c, v] of cols) {
        const cell = cellEl(doc, row, c, styleCells.get(c) ?? colStyle(c));
        if (!cellEmpty(cell)) continue;
        writeValue(doc, cell, v, book, numericCols.has(c));
        mark(cell, 'fill');
        filled.add(`${r}:${c}`);
      }
    }

    // 2. 新行
    let seq = 0;
    if (m.seq !== null)
      for (const row of m.values.values()) {
        const v = row.get(m.seq);
        if (v?.t === 'n') seq = Math.max(seq, v.v);
      }
    const styleAttrs = styleRowEl
      ? ['ht', 'customHeight', 's', 'customFormat', 'thickBot', 'thickTop'].filter((a) => styleRowEl.hasAttribute(a))
      : [];
    const rowMerges = styleRow
      ? kids(doc, 'mergeCell')
          .map((e) => parseRange(e.getAttribute('ref') ?? ''))
          .filter((g) => g && g.r1 === styleRow && g.r2 === styleRow)
      : [];
    const mergeParent = kids(doc, 'mergeCells')[0];
    plan.appended.forEach((target, i) => {
      const r = m.lastData + 1 + i;
      const created = r > m.areaEnd;
      const row = rowEl(doc, sheetData, r, true)!;
      if (created) {
        row.removeAttribute('spans');
        for (const a of styleAttrs) row.setAttribute(a, styleRowEl!.getAttribute(a)!);
        for (const [c, s] of styleCells) cellEl(doc, row, c, s);
        for (const g of rowMerges) {
          const mc = el(doc, 'mergeCell');
          mc.setAttribute('ref', `${colName(g!.c1)}${r}:${colName(g!.c2)}${r}`);
          mergeParent?.appendChild(mc);
        }
      }
      const values = new Map(target.values);
      if (m.seq !== null && opts.renumber && isEmpty(values.get(m.seq))) values.set(m.seq, { t: 'n', v: ++seq });
      for (const [c, v] of values) {
        const cell = cellEl(doc, row, c, styleCells.get(c) ?? colStyle(c));
        if (!created && !cellEmpty(cell)) continue;
        writeValue(doc, cell, v, book, numericCols.has(c));
      }
      for (const [c, p] of patterns) {
        const cell = cellEl(doc, row, c, styleCells.get(c) ?? colStyle(c));
        if (!child(cell, 'f')) writeFormula(doc, cell, copyFormula(p.f, r - p.r));
      }
      if (hl) for (const c of [...row.children].filter((e) => e.localName === 'c')) mark(c, 'add');
      newRows.add(r);
    });
    if (mergeParent) mergeParent.setAttribute('count', String(kids(doc, 'mergeCell').length));

    updateDimension(doc);
    writeText(book, m.path, xmlText(doc));
    results.push({ name: m.name, grid: readGrid(book, doc), newRows, filled });
  }
  hl?.save();
  if (plans.length) forceRecalc(book, wbPath);
  return results;
}

// 别的地方指向这张表的行号：其他表的公式、名称、表格、图片和批注、图表、数据透视的数据源
function shiftAround(book: Book, m: SheetPlan['model'], t: ReturnType<typeof transformer>) {
  const wbPath = Object.keys(book.files).find((p) => /^xl\/workbook\d*\.xml$/i.test(p))!;
  const lower = m.name.toLowerCase();
  const mentions = (text: string) => text.toLowerCase().includes(lower);

  // 其他工作表里的公式
  const wb = parseXml(readText(book, wbPath)!);
  const rels = new Map(readRels(book, wbPath).map((r) => [r.id, r.target]));
  for (const s of kids(wb, 'sheet')) {
    const name = s.getAttribute('name') ?? '';
    const path = rels.get(s.getAttributeNS(NS_REL, 'id') ?? '');
    if (!path || path === m.path || !book.files[path]) continue;
    const text = readText(book, path)!;
    if (!mentions(text)) continue;
    const { doc } = loadSheet(book, path);
    shiftSheetDoc(doc, name, m.name, t, false);
    writeText(book, path, xmlText(doc));
  }
  // 名称（打印区域、自定义名称）
  let changed = false;
  for (const d of kids(wb, 'definedName')) {
    if (!d.textContent || !mentions(d.textContent)) continue;
    d.textContent = mapFormulaRows(d.textContent, '', m.name, t.formula);
    changed = true;
  }
  if (changed) writeText(book, wbPath, xmlText(wb));

  for (const rel of readRels(book, m.path)) {
    if (!rel.target || !book.files[rel.target]) continue;
    // 表格（插入 → 表格）
    if (/\/table$/.test(rel.type)) {
      const doc = parseXml(readText(book, rel.target)!);
      const root = doc.documentElement;
      root.setAttribute('ref', mapRef(root.getAttribute('ref') ?? '', t, 'table'));
      for (const a of kids(doc, 'autoFilter')) a.setAttribute('ref', mapRef(a.getAttribute('ref') ?? '', t, 'filter'));
      for (const s of kids(doc, 'sortState')) s.setAttribute('ref', mapRef(s.getAttribute('ref') ?? '', t, 'table'));
      writeText(book, rel.target, xmlText(doc));
    }
    // 图片、图表的位置（行号从 0 数）
    if (/\/drawing$/.test(rel.type)) {
      const text = readText(book, rel.target)!.replace(/<((?:\w+:)?row)>(\d+)<\/\1>/g, (all, tag, n) =>
        +n + 1 >= t.R ? `<${tag}>${+n + t.extra}</${tag}>` : all
      );
      writeText(book, rel.target, text);
    }
    // 批注和它的旧式（VML）位置
    if (/\/comments$/.test(rel.type)) {
      const text = readText(book, rel.target)!.replace(/(<comment\b[^>]*\bref=")([A-Z]+)(\d+)"/g, (all, a, col, n) =>
        +n >= t.R ? `${a}${col}${+n + t.extra}"` : all
      );
      writeText(book, rel.target, text);
    }
    if (/\/vmlDrawing$/.test(rel.type)) {
      const text = readText(book, rel.target)!.replace(/<x:Row>(\d+)<\/x:Row>/g, (all, n) =>
        +n + 1 >= t.R ? `<x:Row>${+n + t.extra}</x:Row>` : all
      );
      writeText(book, rel.target, text);
    }
  }
  // 图表引用的数据范围
  for (const path of Object.keys(book.files).filter((p) => /^xl\/charts\/chart\d+\.xml$/i.test(p))) {
    const text = readText(book, path)!;
    if (!mentions(text)) continue;
    writeText(
      book,
      path,
      text.replace(
        /(<(\w+:)?f>)([^<]*)(<\/(\w+:)?f>)/g,
        (_, open, _p, body, close) => open + esc(mapFormulaRows(unesc(body), '', m.name, t.formula)) + close
      )
    );
  }
  // 数据透视表的数据源：范围跟着扩，打开时自动刷新
  for (const path of Object.keys(book.files).filter((p) => /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/i.test(p))) {
    const doc = parseXml(readText(book, path)!);
    const src = kids(doc, 'worksheetSource')[0];
    if (!src || (src.getAttribute('sheet') ?? '').toLowerCase() !== lower || !src.getAttribute('ref')) continue;
    src.setAttribute('ref', mapRef(src.getAttribute('ref')!, t, 'table'));
    doc.documentElement.setAttribute('refreshOnLoad', '1');
    writeText(book, path, xmlText(doc));
  }
}

function updateDimension(doc: Document) {
  let r1 = Infinity,
    r2 = 0,
    c1 = Infinity,
    c2 = -1;
  for (const c of kids(doc, 'c')) {
    const p = parseCell(c.getAttribute('r') ?? '');
    if (!p) continue;
    r1 = Math.min(r1, p.r);
    r2 = Math.max(r2, p.r);
    c1 = Math.min(c1, p.c);
    c2 = Math.max(c2, p.c);
  }
  const dim = kids(doc, 'dimension')[0];
  if (dim && r2) dim.setAttribute('ref', `${colName(c1)}${r1}:${colName(c2)}${r2}`);
}

// 公式要重算：打开时让 Excel 全部重算一遍；计算链（calcChain）删掉，Excel 会自己重建
function forceRecalc(book: Book, wbPath: string) {
  const wb = parseXml(readText(book, wbPath)!);
  let calc = kids(wb, 'calcPr')[0];
  if (!calc) {
    // 按架构顺序放在 oleSize、pivotCaches 这些前面
    calc = el(wb, 'calcPr');
    const later = [
      'oleSize',
      'customWorkbookViews',
      'pivotCaches',
      'smartTagPr',
      'smartTagTypes',
      'webPublishing',
      'fileRecoveryPr',
      'webPublishObjects',
      'extLst'
    ];
    const before = [...wb.documentElement.children].find((e) => later.includes(e.localName)) ?? null;
    wb.documentElement.insertBefore(calc, before);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  writeText(book, wbPath, xmlText(wb));
  const rel = readRels(book, wbPath).find((r) => /\/calcChain$/.test(r.type));
  if (!rel) return;
  delete book.files[rel.target];
  const relDoc = parseXml(readText(book, relsPath(wbPath))!);
  for (const e of [...relDoc.documentElement.children]) if (e.getAttribute('Id') === rel.el.getAttribute('Id')) e.remove();
  writeText(book, relsPath(wbPath), xmlText(relDoc));
  const ct = readText(book, '[Content_Types].xml');
  if (ct) writeText(book, '[Content_Types].xml', ct.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
}

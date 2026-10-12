// A1 引用的小工具：列字母和数字互转、拆单元格地址、按规则改公式里的行号
export function colName(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}
// "B12" → { r: 12, c: 1 }（行号从 1 开始，列从 0 开始，和 XML 里的写法一致）
export function parseCell(ref: string): { r: number; c: number } | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref);
  return m ? { r: +m[2], c: colIndex(m[1]) } : null;
}
export const cellRef = (r: number, c: number) => colName(c) + r;

export function parseRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [a, b = a] = ref.split(':');
  const p = parseCell(a),
    q = parseCell(b);
  if (!p || !q) return null;
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}

// 一段引用里行号怎么变：传入起止行（单个单元格时两者相同），返回新的起止行
export type RowMap = (r1: number, r2: number, isRange: boolean) => [number, number];

// 公式里属于哪张表：没写表名的引用算公式所在的表
const SHEET = String.raw`(?:'(?:[^']|'')+'|[A-Za-z_À-￿][\w.À-￿]*)!`;
const CELL = String.raw`\$?[A-Z]{1,3}\$?\d+`;
const ROWS = String.raw`\$?\d+:\$?\d+`;
const REF = new RegExp(String.raw`(${SHEET})?(?:(${CELL})(?::(${CELL}))?|(${ROWS}))`, 'giy');

export function unquoteSheet(s: string) {
  const name = s.slice(0, -1);
  return name.startsWith("'") ? name.slice(1, -1).replaceAll("''", "'") : name;
}

// 逐个找出公式里的引用交给 fn 改写；跳过字符串字面量，函数名（后面紧跟括号的，比如 LOG10）不当引用
function walkRefs(formula: string, fn: (m: RegExpExecArray) => string): string {
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < formula.length && !(formula[j] === '"' && formula[j + 1] !== '"')) j += formula[j] === '"' ? 2 : 1;
      out += formula.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (!/[\w.$\]\u00C0-\uFFFF]/.test(i ? formula[i - 1] : '')) {
      REF.lastIndex = i;
      const m = REF.exec(formula);
      if (m && !/[\w(\u00C0-\uFFFF[]/.test(formula[i + m[0].length] ?? '')) {
        out += fn(m);
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// 改公式里指向某张表的行号。owner：公式所在的表；sheet：要改的那张表；map：行号怎么变
export function mapFormulaRows(formula: string, owner: string, sheet: string, map: RowMap): string {
  const target = sheet.toLowerCase();
  return walkRefs(formula, (m) => {
    const name = m[1] ? unquoteSheet(m[1]) : owner;
    return name.toLowerCase() === target ? (m[1] ?? '') + rewrite(m, map) : m[0];
  });
}

function rewrite(m: RegExpExecArray, map: RowMap): string {
  if (m[4]) {
    const [a, b] = m[4].split(':');
    const ra = +a.replace('$', ''),
      rb = +b.replace('$', '');
    const [x, y] = map(Math.min(ra, rb), Math.max(ra, rb), true);
    return a.replace(/\d+/, String(x)) + ':' + b.replace(/\d+/, String(y));
  }
  const a = m[2],
    b = m[3];
  const ra = +a.replace(/^\$?[A-Z]+\$?/i, '');
  if (!b) {
    const [x] = map(ra, ra, false);
    return a.replace(/\d+$/, String(x));
  }
  const rb = +b.replace(/^\$?[A-Z]+\$?/i, '');
  const swap = ra > rb;
  const [x, y] = map(Math.min(ra, rb), Math.max(ra, rb), true);
  return a.replace(/\d+$/, String(swap ? y : x)) + ':' + b.replace(/\d+$/, String(swap ? x : y));
}

// 复制公式到另一行：相对行号跟着挪 delta 行，带 $ 的不动（和在 Excel 里复制粘贴一样）
export function copyFormula(formula: string, delta: number, colDelta = 0): string {
  if (!delta && !colDelta) return formula;
  const move = (part: string) => {
    if (/^\$?\d+$/.test(part)) return part.startsWith('$') ? part : String(Math.max(1, +part + delta));
    const cm = /^(\$?)([A-Z]{1,3})(\$?)(\d+)$/i.exec(part)!;
    const col = cm[1] ? cm[2] : colName(Math.max(0, colIndex(cm[2]) + colDelta));
    const row = cm[3] ? cm[4] : String(Math.max(1, +cm[4] + delta));
    return cm[1] + col + cm[3] + row;
  };
  return walkRefs(formula, (m) => (m[1] ?? '') + (m[4] ? m[4].split(':') : [m[2], m[3]].filter(Boolean)).map(move).join(':'));
}

// sqref 这类“空格分开的多段区域”
export function mapSqref(sqref: string, map: (r1: number, r2: number) => [number, number]): string {
  return sqref
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const [a, b] = part.split(':');
      const p = parseCell(a),
        q = b ? parseCell(b) : p;
      if (!p || !q) return part;
      const [x, y] = map(Math.min(p.r, q.r), Math.max(p.r, q.r));
      const ca = a.replace(/\d+$/, '');
      return b ? `${ca}${x}:${b.replace(/\d+$/, '')}${y}` : `${ca}${x}`;
    })
    .join(' ');
}

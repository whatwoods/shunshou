// 汇总的核心：每份数据的每一行，是补进模板里已有的那一行，还是追加成新行；哪些格子要填、哪些冲突了
import type { SheetModel } from './model';
import type { Val } from './xlsx';
import { isEmpty, looseName, normName, normVal, valText } from './values';

export interface SourceSheet {
  name: string;
  // rows[0] 是第 1 行
  rows: (Val | null)[][];
  merges: { r1: number; c1: number; r2: number; c2: number }[];
}
export interface Source {
  id: string;
  name: string;
  sheets: SourceSheet[];
}

export type MatchMode = 'key' | 'content' | 'none';
export interface SheetOptions {
  match: MatchMode;
  keys: number[];
  // 把来源文件名写进哪一列（模板里本来就有的列，比如“填报人”“来源”）
  sourceCol: number | null;
}
export interface Options {
  unmatched: 'append' | 'skip';
  conflict: 'first' | 'last';
  skipSame: boolean;
  fillMerged: boolean;
  renumber: boolean;
  sheets: Record<string, SheetOptions>;
  // 某个文件的某张表送到模板的哪张表（'' 表示不用）
  route: Record<string, string>;
  // 手动指定列对应：键是 “文件id/表名”，值是 { 源列序号: 模板列序号，-1 表示不用 }
  columns: Record<string, Record<number, number>>;
}

export interface Target {
  // 模板里原有的行号；新追加的为 null
  row: number | null;
  values: Map<number, Val>;
  // 每格的值是谁给的：'tpl' 是模板原有，数字是第几个文件
  origin: Map<number, 'tpl' | number>;
  from: number;
}
export interface Conflict {
  sheet: string;
  row: string;
  column: string;
  kept: string;
  other: string;
  file: string;
  replaced: boolean;
}
export interface SheetPlan {
  model: SheetModel;
  // 模板已有行里要填的格子：行号 → 列 → 值
  fills: Map<number, Map<number, Val>>;
  appended: Target[];
  conflicts: Conflict[];
}
export interface FileReport {
  id: string;
  name: string;
  parts: {
    sheet: string;
    target: string;
    header: number;
    mapped: { from: number; fromName: string; to: number; toName: string }[];
    unmapped: { index: number; name: string }[];
    rows: number;
    appended: number;
    matched: number;
    filled: number;
    conflicts: number;
    skipped: { header: number; footer: number; same: number; unmatched: number };
  }[];
}
export interface Plan {
  sheets: SheetPlan[];
  files: FileReport[];
}

const FOOTER = /^(合\s*计|总\s*计|小\s*计|共\s*计|total|subtotal)$/i;

export const defaultSheetOptions = (model: SheetModel): SheetOptions => {
  const keys = suggestKeys(model);
  return { match: keys.length ? 'key' : 'content', keys, sourceCol: null };
};

// 推荐“按哪一列认出同一行”：名字像编号/工号/身份证/姓名，且模板已有数据里没有重复也没有空
const KEY_NAME = /(工号|学号|编号|编码|代码|id|身份证|证件号|手机|电话|账号|邮箱|订单号|单号|姓名|名称|学校|单位|公司)/i;
export function suggestKeys(model: SheetModel): number[] {
  const rows = [...model.values.values()].filter((r) => r.size);
  if (!rows.length) return [];
  const ranked = model.columns
    .filter((c) => !model.formulas.has(c.c) && c.c !== model.seq && KEY_NAME.test(normName(c.name)))
    .map((c) => {
      const vals = rows.map((r) => normVal(r.get(c.c)));
      const filled = vals.every(Boolean);
      const unique = new Set(vals).size === vals.length;
      const strong = /(工号|学号|编号|编码|代码|id|身份证|证件号|账号|订单号|单号)/i.test(normName(c.name));
      return { c: c.c, ok: filled && unique, score: strong ? 2 : 1 };
    })
    .filter((x) => x.ok)
    .sort((a, b) => b.score - a.score);
  return ranked.length ? [ranked[0].c] : [];
}

// 数据文件的表头：前 30 行里能对上模板列名最多的一行
function findHeader(sheet: SourceSheet, model: SheetModel): { row: number; score: number } {
  const names = new Set(model.columns.map((c) => normName(c.name)));
  const loose = new Set(model.columns.map((c) => looseName(c.name)));
  let best = { row: 1, score: 0 };
  for (let r = 0; r < Math.min(sheet.rows.length, 30); r++) {
    let score = 0;
    for (const v of sheet.rows[r] ?? []) {
      if (v?.t !== 's') continue;
      if (names.has(normName(v.v))) score += 1;
      else if (loose.has(looseName(v.v))) score += 0.8;
    }
    if (score > best.score) best = { row: r + 1, score };
  }
  return best;
}

function headerNames(sheet: SourceSheet, row: number): string[] {
  const cells = sheet.rows[row - 1] ?? [];
  const out: string[] = [];
  for (let c = 0; c < cells.length; c++) {
    let v = cells[c];
    if (isEmpty(v)) {
      const m = sheet.merges.find((m) => m.r1 < row && row <= m.r2 && m.c1 === c);
      if (m) v = sheet.rows[m.r1 - 1]?.[m.c1] ?? null;
    }
    out[c] = valText(v).trim();
  }
  return out;
}

// 列对应：先比完全一样的名字，再比去掉括号说明的，最后看谁包含谁（只有唯一一个候选时）
export function mapColumns(names: string[], model: SheetModel, manual: Record<number, number> = {}): Map<number, number> {
  const map = new Map<number, number>();
  const used = new Set<number>();
  for (const [from, to] of Object.entries(manual)) {
    if (to >= 0) {
      map.set(+from, to);
      used.add(to);
    } else map.set(+from, -1);
  }
  const passes: ((a: string, b: string) => boolean)[] = [(a, b) => normName(a) === normName(b), (a, b) => looseName(a) === looseName(b)];
  for (const same of passes) {
    names.forEach((n, i) => {
      if (!n || map.has(i)) return;
      const col = model.columns.find((c) => !used.has(c.c) && same(n, c.name));
      if (col) {
        map.set(i, col.c);
        used.add(col.c);
      }
    });
  }
  names.forEach((n, i) => {
    if (!n || map.has(i) || looseName(n).length < 2) return;
    const a = looseName(n);
    const hits = model.columns.filter((c) => {
      const b = looseName(c.name);
      return !used.has(c.c) && b.length >= 2 && (a.includes(b) || b.includes(a));
    });
    if (hits.length === 1) {
      map.set(i, hits[0].c);
      used.add(hits[0].c);
    }
  });
  for (const [k, v] of map) if (v < 0) map.delete(k);
  return map;
}

// 合并单元格的值填满每一格（竖着合并的“部门”这类）
function fillMerges(sheet: SourceSheet): (Val | null)[][] {
  const rows = sheet.rows.map((r) => [...r]);
  for (const m of sheet.merges) {
    const v = sheet.rows[m.r1 - 1]?.[m.c1] ?? null;
    if (!v) continue;
    for (let r = m.r1; r <= m.r2; r++) {
      rows[r - 1] ??= [];
      for (let c = m.c1; c <= m.c2; c++) if (isEmpty(rows[r - 1][c])) rows[r - 1][c] = v;
    }
  }
  return rows;
}

const same = (a: Val | null | undefined, b: Val | null | undefined) => {
  if (a?.t === 'n' && b?.t === 'n') return Math.abs(a.v - b.v) < 1e-9;
  return normVal(a) === normVal(b);
};

class SheetState {
  targets: Target[] = [];
  byKey = new Map<string, Target>();
  // 按内容找行：列 → 值 → 有这个值的行
  postings = new Map<number, Map<string, Set<Target>>>();
  signatures = new Set<string>();
  plan: SheetPlan;
  comparable: number[];
  constructor(
    public model: SheetModel,
    public opts: SheetOptions
  ) {
    this.plan = { model, fills: new Map(), appended: [], conflicts: [] };
    this.comparable = model.columns.map((c) => c.c).filter((c) => !model.formulas.has(c) && c !== model.seq && c !== opts.sourceCol);
    for (const [r, values] of model.values) {
      if (!values.size) continue;
      const t: Target = { row: r, values: new Map(values), origin: new Map([...values.keys()].map((c) => [c, 'tpl' as const])), from: -1 };
      this.add(t);
    }
  }
  key(values: Map<number, Val>): string | null {
    if (this.opts.match !== 'key' || !this.opts.keys.length) return null;
    const parts = this.opts.keys.map((c) => normVal(values.get(c)));
    return parts.every((p) => !p) ? null : parts.join('\u0001');
  }
  signature(values: Map<number, Val>) {
    return this.comparable.map((c) => normVal(values.get(c))).join('\u0001');
  }
  add(t: Target) {
    this.targets.push(t);
    const k = this.key(t.values);
    if (k !== null && !this.byKey.has(k)) this.byKey.set(k, t);
    this.signatures.add(this.signature(t.values));
    for (const c of this.comparable) {
      const v = normVal(t.values.get(c));
      if (!v) continue;
      let col = this.postings.get(c);
      if (!col) this.postings.set(c, (col = new Map()));
      let set = col.get(v);
      if (!set) col.set(v, (set = new Set()));
      set.add(t);
    }
  }
  index(t: Target, c: number) {
    const v = normVal(t.values.get(c));
    if (!v || !this.comparable.includes(c)) return;
    let col = this.postings.get(c);
    if (!col) this.postings.set(c, (col = new Map()));
    let set = col.get(v);
    if (!set) col.set(v, (set = new Set()));
    set.add(t);
  }
  find(values: Map<number, Val>): Target | null {
    if (this.opts.match === 'key') {
      const k = this.key(values);
      return k === null ? null : (this.byKey.get(k) ?? null);
    }
    if (this.opts.match === 'none') return null;
    // 按内容：已有行里填了的格子，这一行都对得上（或者空着），并且至少对上一半
    const counts = new Map<Target, number>();
    for (const c of this.comparable) {
      const v = normVal(values.get(c));
      if (!v) continue;
      for (const t of this.postings.get(c)?.get(v) ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    let best: Target | null = null,
      bestN = 0;
    for (const [t, n] of counts) {
      if (n <= bestN) continue;
      let filled = 0,
        ok = true;
      for (const c of this.comparable) {
        const have = t.values.get(c);
        if (isEmpty(have)) continue;
        filled++;
        const mine = values.get(c);
        if (!isEmpty(mine) && !same(have, mine)) {
          ok = false;
          break;
        }
      }
      if (ok && n * 2 >= filled) {
        best = t;
        bestN = n;
      }
    }
    return best;
  }
  label(t: Target): string {
    const keyCol = this.opts.keys[0] ?? this.comparable.find((c) => !isEmpty(t.values.get(c)));
    const k = keyCol !== undefined ? valText(t.values.get(keyCol)) : '';
    const where = t.row !== null ? `第 ${t.row} 行` : `新增第 ${this.plan.appended.indexOf(t) + 1} 行`;
    return k ? `${where}（${k}）` : where;
  }
}

export function planMerge(models: SheetModel[], sources: Source[], options: Options): Plan {
  const states = new Map(models.map((m) => [m.name, new SheetState(m, options.sheets[m.name] ?? defaultSheetOptions(m))]));
  const files: FileReport[] = [];
  sources.forEach((src, fileIdx) => {
    const report: FileReport = { id: src.id, name: src.name, parts: [] };
    files.push(report);
    for (const sheet of src.sheets) {
      if (!sheet.rows.some((r) => r?.some((v) => !isEmpty(v)))) continue;
      const routeKey = `${src.id}/${sheet.name}`;
      // 送到哪张表：手动选的；否则同名且对得上列的；否则列对得最多的
      let target: SheetModel | null = null;
      let header = { row: 1, score: 0 };
      if (routeKey in options.route) {
        target = models.find((m) => m.name === options.route[routeKey]) ?? null;
        if (target) header = findHeader(sheet, target);
      } else {
        for (const m of models) {
          const h = findHeader(sheet, m);
          const score = h.score + (m.name === sheet.name && h.score > 0 ? 0.5 : 0);
          if (score > header.score) {
            header = { ...h, score };
            target = m;
          }
        }
      }
      if (!target || header.score <= 0) {
        report.parts.push({
          sheet: sheet.name,
          target: '',
          header: 0,
          mapped: [],
          unmapped: [],
          rows: 0,
          appended: 0,
          matched: 0,
          filled: 0,
          conflicts: 0,
          skipped: { header: 0, footer: 0, same: 0, unmatched: 0 }
        });
        continue;
      }
      const st = states.get(target.name)!;
      const names = headerNames(sheet, header.row);
      const mapping = mapColumns(names, target, options.columns[routeKey]);
      const colName = new Map(target.columns.map((c) => [c.c, c.name]));
      const part: FileReport['parts'][number] = {
        sheet: sheet.name,
        target: target.name,
        header: header.row,
        mapped: [...mapping].map(([from, to]) => ({ from, fromName: names[from], to, toName: colName.get(to) ?? '' })),
        unmapped: names.map((name, index) => ({ index, name })).filter((x) => x.name && !mapping.has(x.index)),
        rows: 0,
        appended: 0,
        matched: 0,
        filled: 0,
        conflicts: 0,
        skipped: { header: 0, footer: 0, same: 0, unmatched: 0 }
      };
      report.parts.push(part);
      const rows = options.fillMerged ? fillMerges(sheet) : sheet.rows;
      const headerKeys = new Set(target.columns.map((c) => normName(c.name)));
      for (let r = header.row; r < rows.length; r++) {
        const values = new Map<number, Val>();
        for (const [from, to] of mapping) {
          const v = rows[r]?.[from];
          if (isEmpty(v) || target.formulas.has(to) || to === st.opts.sourceCol) continue;
          if (to === target.seq && options.renumber) continue;
          values.set(to, v!);
        }
        if (!values.size) continue;
        part.rows++;
        const texts = [...values.values()].map((v) => valText(v).trim());
        if (texts.filter((t) => headerKeys.has(normName(t))).length * 2 >= texts.length) {
          part.skipped.header++;
          continue;
        }
        if (texts.some((t) => FOOTER.test(t))) {
          part.skipped.footer++;
          continue;
        }
        const hit = st.find(values);
        if (hit) {
          part.matched++;
          let changed = false;
          for (const [c, v] of values) {
            const have = hit.values.get(c);
            if (isEmpty(have)) {
              set(st, hit, c, v, fileIdx);
              part.filled++;
              changed = true;
            } else if (!same(have, v)) {
              const origin = hit.origin.get(c);
              const replace = origin !== 'tpl' && options.conflict === 'last';
              st.plan.conflicts.push({
                sheet: target.name,
                row: st.label(hit),
                column: colName.get(c) ?? '',
                kept: valText(replace ? v : have),
                other: valText(replace ? have : v),
                file: src.name,
                replaced: replace
              });
              part.conflicts++;
              if (replace) {
                set(st, hit, c, v, fileIdx);
                changed = true;
              }
            }
          }
          if (changed && st.opts.sourceCol !== null && isEmpty(hit.values.get(st.opts.sourceCol))) {
            set(st, hit, st.opts.sourceCol, { t: 's', v: baseName(src.name) }, fileIdx);
          }
          if (!changed) part.skipped.same++;
          continue;
        }
        if (options.unmatched === 'skip' && st.targets.some((t) => t.row !== null)) {
          part.skipped.unmatched++;
          continue;
        }
        if (options.skipSame && st.signatures.has(st.signature(values))) {
          part.skipped.same++;
          continue;
        }
        if (st.opts.sourceCol !== null) values.set(st.opts.sourceCol, { t: 's', v: baseName(src.name) });
        const t: Target = { row: null, values, origin: new Map([...values.keys()].map((c) => [c, fileIdx])), from: fileIdx };
        st.add(t);
        st.plan.appended.push(t);
        part.appended++;
      }
    }
  });
  return { sheets: [...states.values()].map((s) => s.plan).filter((p) => p.fills.size || p.appended.length), files };
}

function set(st: SheetState, t: Target, c: number, v: Val, file: number) {
  t.values.set(c, v);
  t.origin.set(c, file);
  st.index(t, c);
  if (t.row !== null) {
    let row = st.plan.fills.get(t.row);
    if (!row) st.plan.fills.set(t.row, (row = new Map()));
    row.set(c, v);
  }
  const k = st.key(t.values);
  if (k !== null && !st.byKey.has(k)) st.byKey.set(k, t);
}

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

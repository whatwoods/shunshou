// 把模板、数据和设置串起来：看懂模板 → 排计划 → 写回 XML → 打包
import { buildModel, type SheetModel } from './model';
import { applyPlans, type SheetResult } from './apply';
import { planMerge, type Options, type Plan, type Source } from './plan';
import { loadSheet, openBook, zipBook, type Book } from './xlsx';

export interface Template {
  name: string;
  data: Uint8Array;
  book: Book;
  // 每张表自动认出来的结构；表头行、底部行可以手动改
  sheets: { name: string; path: string; hidden: boolean; model: SheetModel | null }[];
}
export interface SheetOverride {
  headerRow?: number;
  footer?: number | null;
}

export function readTemplate(name: string, data: Uint8Array, overrides: Record<string, SheetOverride> = {}): Template {
  const book = openBook(data);
  return {
    name,
    data,
    book,
    sheets: book.sheets.map((s) => {
      const { grid } = loadSheet(book, s.path);
      const model = grid.maxRow ? buildModel(s.name, s.path, grid, overrides[s.name]) : null;
      return { ...s, model: model?.columns.length ? model : null };
    })
  };
}

export interface MergeResult {
  plan: Plan;
  sheets: SheetResult[];
  bytes: Uint8Array;
}

export function merge(tpl: Template, sources: Source[], options: Options, extra: { highlight: boolean; only?: string[] }): MergeResult {
  const models = tpl.sheets.map((s) => s.model).filter((m): m is SheetModel => !!m && (!extra.only || extra.only.includes(m.name)));
  const plan = planMerge(models, sources, options);
  // 每次都从原始模板重新算：删掉一份数据、改设置都不会留下旧结果
  const book = openBook(tpl.data);
  const sheets = applyPlans(book, plan.sheets, { highlight: extra.highlight, renumber: options.renumber });
  // .xltx（Excel 模板文件）存成普通工作簿
  const ct = book.files['[Content_Types].xml'];
  if (ct && /\.xltx$/i.test(tpl.name)) {
    book.files['[Content_Types].xml'] = new TextEncoder().encode(
      new TextDecoder().decode(ct).replace('spreadsheetml.template.main+xml', 'spreadsheetml.sheet.main+xml')
    );
  }
  return { plan, sheets, bytes: plan.sheets.length ? zipBook(book) : tpl.data };
}

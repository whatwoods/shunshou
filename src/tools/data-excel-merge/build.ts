// 拼一个带样式的小 .xlsx：示例模板和测试都用它（不依赖 SheetJS，样式、合并单元格、公式都能写进去）
import { zipSync, strToU8 } from 'fflate';
import { cellRef } from './refs';

// 样式编号：0 默认、1 标题、2 表头、3 正文、4 正文日期、5 正文金额、6 合计
export type Spec = string | number | null | { v?: string | number; f?: string; s?: number };
export interface SheetSpec {
  name: string;
  rows: Spec[][];
  merges?: string[];
  cols?: number[];
  // 留好格式的空行：行号 → 每列的样式
  blank?: Record<number, number[]>;
  extra?: string;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="等线"/></font><font><b/><sz val="11"/><name val="等线"/></font><font><b/><sz val="16"/><name val="等线"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE7D9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="4" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const strings: string[] = [];
  const sid = (s: string) => {
    let i = strings.indexOf(s);
    if (i < 0) i = strings.push(s) - 1;
    return i;
  };
  const files: Record<string, Uint8Array> = {};
  sheets.forEach((sheet, i) => {
    const rows: string[] = [];
    const count = Math.max(sheet.rows.length, ...Object.keys(sheet.blank ?? {}).map(Number));
    for (let r = 1; r <= count; r++) {
      const specs = sheet.rows[r - 1] ?? [];
      const width = Math.max(specs.length, sheet.blank?.[r]?.length ?? 0);
      const cells: string[] = [];
      for (let c = 0; c < width; c++) {
        let spec = specs[c];
        if (spec === undefined || spec === null) {
          if (sheet.blank?.[r]?.[c]) spec = { s: sheet.blank[r][c] };
          else continue;
        }
        const o = typeof spec === 'object' ? spec : { v: spec };
        const s = o.s ? ` s="${o.s}"` : '';
        const ref = cellRef(r, c);
        if (o.f) cells.push(`<c r="${ref}"${s}><f>${xmlEsc(o.f)}</f></c>`);
        else if (typeof o.v === 'number') cells.push(`<c r="${ref}"${s}><v>${o.v}</v></c>`);
        else if (typeof o.v === 'string') cells.push(`<c r="${ref}"${s} t="s"><v>${sid(o.v)}</v></c>`);
        else cells.push(`<c r="${ref}"${s}/>`);
      }
      if (cells.length) rows.push(`<row r="${r}">${cells.join('')}</row>`);
    }
    const cols = sheet.cols?.length
      ? `<cols>${sheet.cols.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const merges = sheet.merges?.length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1"/>${cols}<sheetData>${rows.join('')}</sheetData>${merges}${sheet.extra ?? ''}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
    );
  });
  const n = sheets.length;
  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`
  );
  files['_rels/.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  files['xl/workbook.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
  );
  files['xl/styles.xml'] = strToU8(STYLES);
  files['xl/sharedStrings.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}</sst>`
  );
  return zipSync(files);
}

// ———— 示例：培训报名汇总 ————
// 模板：标题、表头、3 行已有数据（有的缺课程和日期）、3 行留好格式的空行、底部合计（SUM）
const d = (iso: string) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
export function sampleFiles(): File[] {
  const H = (v: string) => ({ v, s: 2 });
  const B = (v: string | number | null) => ({ v: v ?? undefined, s: 3 });
  const D = (v: string | null) => ({ v: v ? d(v) : undefined, s: 4 });
  const M = (v: number | null) => ({ v: v ?? undefined, s: 5 });
  const BODY = [3, 3, 3, 3, 3, 4, 5];
  const template = buildXlsx([
    {
      name: '报名表',
      cols: [7, 10, 10, 10, 16, 13, 11],
      rows: [
        [{ v: '2026 秋季培训报名汇总', s: 1 }],
        [H('序号'), H('工号'), H('姓名'), H('部门'), H('课程'), H('报名日期'), H('费用')],
        [B(1), B('A1001'), B('林夏'), B('市场部'), B('数据分析入门'), D('2026-09-02'), M(680)],
        [B(2), B('A1002'), B('周屿'), B('市场部'), B(null), D(null), M(null)],
        [B(3), B('A1003'), B('陈默'), B('销售部'), B('商务写作'), D(null), M(420)],
        [],
        [],
        [],
        [{ v: '合计', s: 6 }, { s: 6 }, { s: 6 }, { s: 6 }, { s: 6 }, { s: 6 }, { f: 'SUM(G3:G8)', s: 6 }]
      ],
      blank: { 6: BODY, 7: BODY, 8: BODY },
      merges: ['A1:G1', 'A9:F9']
    }
  ]);
  // 销售部照着模板填的：补了周屿缺的课程和日期，又加了 3 个人
  const sales = buildXlsx([
    {
      name: '报名表',
      rows: [
        ['2026 秋季培训报名汇总'],
        ['序号', '工号', '姓名', '部门', '课程', '报名日期', '费用'],
        [1, 'A1002', '周屿', '市场部', 'Excel 进阶', { v: d('2026-09-05'), s: 4 }, 520],
        [2, 'A2001', '许知远', '销售部', '商务写作', { v: d('2026-09-06'), s: 4 }, 420],
        [3, 'A2002', '宋晴', '销售部', '数据分析入门', { v: d('2026-09-06'), s: 4 }, 680],
        [4, 'A2003', '何川', '销售部', 'Excel 进阶', { v: d('2026-09-07'), s: 4 }, 520]
      ]
    }
  ]);
  // 研发部导出的 CSV：列的顺序不一样、“费用（元）”带单位、最后还有一行合计
  const dev = [
    '姓名,工号,部门,费用（元）,课程,报名日期',
    '陈默,A1003,销售部,420,商务写作,2026-09-03',
    '顾一鸣,A3001,研发部,680,数据分析入门,2026-09-08',
    '白露,A3002,研发部,520,Excel 进阶,2026-09-08',
    '合计,,,1620,,'
  ].join('\n');
  return [
    new File([template as BlobPart], '报名汇总模板.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    new File([sales as BlobPart], '销售部.xlsx'),
    new File(['\uFEFF' + dev], '研发部.csv', { type: 'text/csv' })
  ];
}

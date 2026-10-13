// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { copyFormula, mapFormulaRows } from './refs';
import { buildXlsx, sampleFiles, type SheetSpec } from './build';
import { merge, readTemplate } from './merge';
import { defaultSheetOptions, type Options, type Source } from './plan';
import { readSource } from './read';
import { loadSheet, openBook, type Val } from './xlsx';
import { normVal, valText } from './values';

const bytes = async (f: File) => new Uint8Array(await f.arrayBuffer());

it('关键列匹配与去重保留原始数值精度', () => {
  expect(normVal({ t: 'n', v: 0.00000000001 })).not.toBe(normVal({ t: 'n', v: 0 }));
  expect(valText({ t: 'n', v: 1.234567890123 })).toBe('1.234567890123');
});
it('CSV 汇总读入 UTF-16 和分号分隔符，不吞掉未闭合的引号', async () => {
  const text = '\uFEFF姓名;城市\r\n小顺;杭州';
  const bytes = new Uint8Array(text.length * 2);
  const view = new DataView(bytes.buffer);
  [...text].forEach((ch, i) => view.setUint16(i * 2, ch.charCodeAt(0), true));
  const source = await readSource(new File([bytes], '来源.csv'));
  expect(source.sheets[0].rows.map((row) => row.map(valText))).toEqual([
    ['姓名', '城市'],
    ['小顺', '杭州']
  ]);
  await expect(readSource(new File(['姓名,城市\n"小顺,杭州'], '未闭合.csv'))).rejects.toThrow(/引号/);
});

function options(tpl: ReturnType<typeof readTemplate>, patch: Partial<Options> = {}): Options {
  return {
    unmatched: 'append',
    conflict: 'first',
    skipSame: true,
    fillMerged: true,
    renumber: true,
    sheets: Object.fromEntries(tpl.sheets.filter((s) => s.model).map((s) => [s.name, defaultSheetOptions(s.model!)])),
    route: {},
    columns: {},
    ...patch
  };
}

// 读回结果：值和公式，按 “A1” 取
function readBack(data: Uint8Array, sheet = 0) {
  const book = openBook(data);
  const { doc, grid } = loadSheet(book, book.sheets[sheet].path);
  const at = (ref: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    const c = m[1].charCodeAt(0) - 65;
    return grid.rows.get(+m[2])?.get(c);
  };
  return {
    book,
    doc,
    grid,
    text: (ref: string) => valText(at(ref)?.v as Val),
    f: (ref: string) => at(ref)?.f,
    s: (ref: string) => at(ref)?.s
  };
}

describe('公式里的行号', () => {
  it('插行：下面的引用往下挪，跨过插入点的范围变长；字符串和函数名不动', () => {
    const map = (r1: number, r2: number): [number, number] => [r1 >= 9 ? r1 + 2 : r1, r2 >= 9 ? r2 + 2 : r2];
    expect(mapFormulaRows('SUM(G3:G10)+G9*$G$12+LOG10(2)&"G9"', '表', '表', map)).toBe('SUM(G3:G12)+G11*$G$14+LOG10(2)&"G9"');
    expect(mapFormulaRows("'报名 表'!A9+Sheet2!A9+A9", 'Sheet2', '报名 表', map)).toBe("'报名 表'!A11+Sheet2!A9+A9");
    expect(mapFormulaRows('SUM(9:10)', '表', '表', map)).toBe('SUM(11:12)');
  });
  it('复制到别的行：相对行号跟着走，带 $ 的不动', () => {
    expect(copyFormula('E3*F3+$H$1+F$2', 4)).toBe('E7*F7+$H$1+F$2');
    expect(copyFormula('IF(B3="","",B3&"3")', 2)).toBe('IF(B5="","",B5&"3")');
  });
});

describe('看懂模板', () => {
  it('示例模板：表头、已有数据、留好的空行、合计行、序号和日期', async () => {
    const [tf] = sampleFiles();
    const tpl = readTemplate(tf.name, await bytes(tf));
    const m = tpl.sheets[0].model!;
    expect(m.headerRow).toBe(2);
    expect(m.columns.map((c) => c.name)).toEqual(['序号', '工号', '姓名', '部门', '课程', '报名日期', '费用']);
    expect([m.lastData, m.areaEnd, m.footer, m.seq]).toEqual([5, 8, 9, 0]);
    expect(defaultSheetOptions(m)).toEqual({ match: 'key', keys: [1], sourceCol: null });
  });
  it('两层表头取下面那层，竖着合并的列名也认得', () => {
    const data = buildXlsx([
      {
        name: 'S',
        rows: [['名单'], ['姓名', '联系方式', null], [null, '电话', '邮箱'], ['甲', '1', 'a@x']],
        merges: ['A1:C1', 'A2:A3', 'B2:C2']
      }
    ]);
    const m = readTemplate('t.xlsx', data).sheets[0].model!;
    expect(m.headerRow).toBe(3);
    expect(m.columns.map((c) => c.name)).toEqual(['姓名', '电话', '邮箱']);
  });
});

describe('汇总示例', async () => {
  const [tf, ...rest] = sampleFiles();
  const tpl = readTemplate(tf.name, await bytes(tf));
  const sources = await Promise.all(rest.map(readSource));
  const res = merge(tpl, sources, options(tpl), { highlight: false });
  const out = readBack(res.bytes);

  it('已有行补空格，原有内容和样式不变', () => {
    expect(out.text('E4')).toBe('Excel 进阶');
    expect(out.text('F4')).toBe('2026-09-05');
    expect(out.text('G4')).toBe('520');
    expect(out.text('F5')).toBe('2026-09-03');
    expect(out.text('A1')).toBe('2026 秋季培训报名汇总');
    expect(out.text('E3')).toBe('数据分析入门');
    expect([out.s('A2'), out.s('F5'), out.s('G3')]).toEqual([2, 4, 5]);
  });
  it('新行先填留好的空行，不够在合计上面插行；序号续上，CSV 的合计行跳过', () => {
    expect([6, 7, 8, 9, 10].map((r) => out.text('C' + r))).toEqual(['许知远', '宋晴', '何川', '顾一鸣', '白露']);
    expect([6, 10].map((r) => out.text('A' + r))).toEqual(['4', '8']);
    expect(out.text('F9')).toBe('2026-09-08');
    expect([out.s('F10'), out.s('G10')]).toEqual([4, 5]);
    expect(out.text('A11')).toBe('合计');
    expect(out.f('G11')).toBe('SUM(G3:G10)');
    expect(strFromU8(unzipSync(res.bytes)['xl/worksheets/sheet1.xml'])).toContain('<mergeCell ref="A11:F11"/>');
    const part = res.plan.files.find((f) => f.name === '研发部.csv')!.parts[0];
    expect(part).toMatchObject({ appended: 2, matched: 1, filled: 1, skipped: { footer: 1 } });
    expect(part.mapped.find((m) => m.fromName === '费用（元）')?.toName).toBe('费用');
  });
  it('打开时重算公式', () => {
    expect(strFromU8(unzipSync(res.bytes)['xl/workbook.xml'])).toContain('fullCalcOnLoad="1"');
  });
  it('汇总后再追加：同一个人不会重复', async () => {
    const again = merge(tpl, [...sources, await readSource(rest[0])], options(tpl), { highlight: false });
    expect(again.plan.sheets[0].appended.length).toBe(5);
  });
});

describe('冲突、按内容对应、标色', () => {
  const tplData = buildXlsx([
    {
      name: '表',
      rows: [
        ['姓名', '城市', '电话'],
        ['甲', '上海', null],
        ['乙', null, null]
      ]
    }
  ]);
  const src = (rows: (string | null)[][]): Source => ({
    id: 'x' + Math.random(),
    name: '数据.xlsx',
    sheets: [{ name: '表', rows: rows.map((r) => r.map((v) => (v === null ? null : ({ t: 's', v } as Val)))), merges: [] }]
  });
  const tpl = readTemplate('t.xlsx', tplData);

  it('没有关键列时按已有内容认行；模板原有的值不改，记成冲突', () => {
    const s = src([
      ['姓名', '城市', '电话'],
      ['甲', '北京', '111'],
      ['乙', '杭州', '222'],
      ['丙', '深圳', null]
    ]);
    const opts = options(tpl);
    // 姓名没有重复，会被推荐成关键列；这里专门测按内容认行
    expect(opts.sheets['表'].keys).toEqual([0]);
    opts.sheets['表'] = { match: 'content', keys: [], sourceCol: null };
    const res = merge(tpl, [s], opts, { highlight: false });
    const out = readBack(res.bytes);
    expect([out.text('B2'), out.text('C2')]).toEqual(['上海', '']);
    expect([out.text('B3'), out.text('C3'), out.text('A4'), out.text('A5')]).toEqual(['杭州', '222', '甲', '丙']);
    // “甲”的城市对不上，按内容就不算同一行，追加成新行
    expect(res.plan.sheets[0].appended.map((t) => valText(t.values.get(0)))).toEqual(['甲', '丙']);
  });
  it('按关键列认行：不同的值是冲突，保留模板的', () => {
    const opts = options(tpl);
    opts.sheets['表'] = { match: 'key', keys: [0], sourceCol: null };
    const res = merge(
      tpl,
      [
        src([
          ['姓名', '城市'],
          ['甲', '北京']
        ])
      ],
      opts,
      { highlight: false }
    );
    expect(res.plan.sheets).toEqual([]);
    expect(res.plan.files[0].parts[0].conflicts).toBe(1);
  });
  it('标出新增和补充：复制一份样式换底色，原来的样式表还在', () => {
    const res = merge(
      tpl,
      [
        src([
          ['姓名', '电话'],
          ['乙', '222'],
          ['丙', '333']
        ])
      ],
      options(tpl),
      { highlight: true }
    );
    const styles = strFromU8(unzipSync(res.bytes)['xl/styles.xml']);
    expect(styles).toContain('FFE3F4E6');
    expect(styles).toContain('FFFFF1D2');
    const out = readBack(res.bytes);
    expect(out.s('C3')).not.toBe(out.s('A4'));
  });
});

describe('插行时一起挪', () => {
  const spec: SheetSpec = {
    name: '明细',
    rows: [
      ['项目', '金额'],
      ['a', 1],
      ['合计', { f: 'SUM(B2:B2)' }]
    ],
    extra:
      '<conditionalFormatting sqref="B2:B2"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThan"><formula>B2&gt;0</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="whole" sqref="B2"><formula1>0</formula1></dataValidation></dataValidations>'
  };
  const data = buildXlsx([
    spec,
    {
      name: '总览',
      rows: [
        ['总额', { f: '明细!B3*1' }],
        ['首项', { f: "'明细'!B2" }]
      ]
    }
  ]);
  it('合计、条件格式、别的表里的引用', async () => {
    const tpl = readTemplate('t.xlsx', data);
    const s: Source = {
      id: 'y',
      name: 'd.csv',
      sheets: [
        {
          name: 'd',
          rows: [
            [
              { t: 's', v: '项目' },
              { t: 's', v: '金额' }
            ],
            [
              { t: 's', v: 'b' },
              { t: 's', v: '2' }
            ],
            [
              { t: 's', v: 'c' },
              { t: 's', v: '3' }
            ]
          ],
          merges: []
        }
      ]
    };
    const res = merge(tpl, [s], options(tpl), { highlight: false });
    const out = readBack(res.bytes);
    expect([out.text('A3'), out.text('B3'), out.text('A4')]).toEqual(['b', '2', 'c']);
    expect(out.f('B5')).toBe('SUM(B2:B4)');
    const xml = strFromU8(unzipSync(res.bytes)['xl/worksheets/sheet1.xml']);
    expect(xml).toContain('sqref="B2:B4"');
    const other = readBack(res.bytes, 1);
    expect([other.f('B1'), other.f('B2')]).toEqual(['明细!B5*1', "'明细'!B2"]);
  });
});

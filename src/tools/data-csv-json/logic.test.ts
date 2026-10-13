import { expect, it } from 'vitest';
import { parseCsv, parseJson, fromJson, toJson, toCsv, dataDefaults } from '../../lib/dataCore';
it('CSV 类型推断保持前导零与大整数', () => {
  const data = parseCsv('id,n,enabled,large\n001,2.5,true,9007199254740993', { ...dataDefaults, infer: true });
  expect(JSON.parse(toJson(data))).toEqual([{ id: '001', n: 2.5, enabled: true, large: '9007199254740993' }]);
});
it('JSON 保留所有键并防护原型与 CSV 公式', () => {
  const data = fromJson(JSON.parse('[{"__proto__":"ok","x":"=1+1"},{"b":2}]'));
  expect(data.columns).toEqual(['__proto__', 'x', 'b']);
  expect(toCsv(data)).toContain("'=1+1");
  expect(JSON.parse(toJson(data))[0].__proto__).toBe('ok');
});
it('拒绝非数组和混合数组', () => {
  expect(() => fromJson({ a: 1 })).toThrow();
  expect(() => fromJson([1, {}])).toThrow();
});
it('CSV 正确转义分隔符和换行', () => {
  const data = fromJson([{ a: 'a,b', b: 'x\ny', c: '"quoted"' }]);
  expect(parseCsv(toCsv(data))).toEqual(data);
});
it('缺失的字段是空值，不会读到 Object 原型上的函数', () => {
  const data = fromJson(JSON.parse('[{"constructor":"x","toString":"y","__proto__":"z"},{}]'));
  expect(data.rows).toEqual([
    ['x', 'y', 'z'],
    [null, null, null]
  ]);
});
it('JSON 二维数组保留字符串、空串、null 和原始类型', () => {
  expect(parseJson('[["42","true","",null,42,true],["001"]]').rows).toEqual([
    ['42', 'true', '', null, 42, true],
    ['001', null, null, null, null, null]
  ]);
});
it('JSON 大整数在解析前按原文保留，普通数字维持数值', () => {
  const table = parseJson(
    '\uFEFF[{"id":9007199254740993,"negative":-9007199254740993,"small":42,"decimal":2.5,"huge":1e400,"nested":{"id":9007199254740993}}]'
  );
  expect(table.rows).toEqual([['9007199254740993', '-9007199254740993', 42, 2.5, '1e400', '{"id":"9007199254740993"}']]);
  expect(toCsv(table)).toContain('9007199254740993');
});
it('保留大整数不能掩盖非法 JSON', () => {
  for (const text of ['[1e+]', '[9007199254740993.]', '[01]', '[NaN]', '[Infinity]', '[9007199254740993,]', '[{9007199254740993:1}]']) {
    expect(() => parseJson(text)).toThrow();
  }
});

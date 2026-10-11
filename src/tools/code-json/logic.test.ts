import { expect, test } from 'vitest';
import { formatJson, jsonError, type JsonOptions } from './logic';
const opts: JsonOptions = { source: 'json', target: 'json', indent: '2', sort: true, compact: true };
test('排序保留特殊键和数组', () =>
  expect(formatJson('{"z":1,"__proto__":2,"a":[{"b":1,"a":2}]}', opts)).toBe('{"__proto__":2,"a":[{"a":2,"b":1}],"z":1}'));
test('修复尾逗号单引号缺逗号', () => expect(formatJson("{'a':1 'b':2,}", opts, true)).toBe('{"a":1,"b":2}'));
test('YAML 双向转换与别名限制', () => {
  expect(formatJson('a: 1', { ...opts, source: 'yaml' })).toBe('{"a":1}');
  expect(formatJson('{"a":1}', { ...opts, target: 'yaml' })).toBe('a: 1\n');
  expect(() => formatJson('a: 1\na: 2', { ...opts, source: 'yaml' })).toThrow();
});
test('错误包含行列', () => expect(jsonError('{\n!', new Error('Unexpected token at position 2'))).toContain('第 2 行第 1 列'));
test('JSON 数字精度与超大指数不丢失', () =>
  expect(formatJson('{"id":9007199254740993,"n":1e400,"decimal":0.12345678901234567890}', opts)).toBe(
    '{"decimal":0.12345678901234567890,"id":9007199254740993,"n":1e400}'
  ));
test('YAML 往返保留数字精度', () => {
  const yaml = formatJson('{"id":9007199254740993,"n":1e400,"decimal":0.12345678901234567890}', { ...opts, target: 'yaml' });
  expect(formatJson(yaml, { ...opts, source: 'yaml' })).toBe('{"decimal":0.12345678901234567890,"id":9007199254740993,"n":1e400}');
  expect(formatJson('a: .5\nb: +001.\nc: 0xFF', { ...opts, source: 'yaml' })).toBe('{"a":0.5,"b":1.0,"c":255}');
  expect(() => formatJson('a: .inf', { ...opts, source: 'yaml' })).toThrow('不支持');
});
test('对象不会被伪装成数字或改变原型', () => {
  expect(formatJson('{"isLosslessNumber":true,"value":"injected","__proto__":{"x":1}}', opts)).toBe(
    '{"__proto__":{"x":1},"isLosslessNumber":true,"value":"injected"}'
  );
  expect(formatJson('{}', opts)).toBe('{}');
  expect(formatJson('[]', opts)).toBe('[]');
});
test('循环 YAML 明确拒绝', () => expect(() => formatJson('&a [*a]', { ...opts, source: 'yaml' })).toThrow('循环'));
test('缺少冒号用中文解释', () => {
  try {
    formatJson('{"a" 1}', opts);
  } catch (e) {
    expect(jsonError('{"a" 1}', e)).toContain('少了冒号');
  }
});

test('YAML 的集合、二进制和日期转 JSON 时不丢内容', () => {
  const o = { source: 'yaml' as const, target: 'json' as const, indent: '2', sort: false, compact: true };
  expect(formatJson('a: !!set {x, z}', o)).toBe('{"a":["x","z"]}');
  expect(formatJson('a: !!omap [ {x: 1}, {y: 2} ]', o)).toBe('{"a":{"x":1,"y":2}}');
  expect(formatJson('a: !!binary aGVsbG8=', o)).toBe('{"a":"aGVsbG8="}');
  expect(formatJson('%YAML 1.1\n---\nd: 2001-12-14', o)).toBe('{"d":"2001-12-14"}');
});
test('YAML 里会在 JSON 中撞名的键直接报错，不悄悄丢一项', () => {
  const y = { ...opts, source: 'yaml' as const, target: 'json' as const, indent: '2' as const, compact: false };
  expect(() => formatJson('1: a\n"1": b', y)).toThrow(/"1"/);
  expect(() => formatJson('null: a\n"null": b', y)).toThrow(/改名/);
  // 不撞名的照常转换，嵌套映射和 !!omap 也一样
  expect(JSON.parse(formatJson('1: a\n"2": b\nn:\n  x: 1\no: !!omap\n  - k: v', y))).toEqual({
    '1': 'a',
    '2': 'b',
    n: { x: 1 },
    o: { k: 'v' }
  });
});

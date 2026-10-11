import { jsonrepair } from 'jsonrepair';
import { parseDocument, stringify, type ScalarTag } from 'yaml';
import { parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser';

class Decimal {
  constructor(readonly source: string) {}
  toString() {
    return this.source;
  }
}
const numberTag: ScalarTag = {
  tag: 'tag:yaml.org,2002:float',
  default: true,
  identify: (value) => value instanceof Decimal,
  test: /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/,
  resolve(source) {
    const normalized = source
      .replace(/^\+/, '')
      .replace(/^(-?)\./, '$10.')
      .replace(/\.(?=[eE]|$)/, '.0')
      .replace(/^(-?)0+(?=\d)/, '$1');
    return new Decimal(normalized);
  },
  stringify: (node) => (node.value as Decimal).source
};
export interface JsonOptions {
  source: 'json' | 'yaml';
  target: 'json' | 'yaml';
  indent: string;
  sort: boolean;
  compact: boolean;
}
export function sortKeys(value: unknown): unknown {
  if (value instanceof Decimal) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)])
    );
  return value;
}
function parseJson(text: string) {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false });
  if (errors.length || !root) {
    const issue = errors[0];
    throw new Error(`${issue ? printParseErrorCode(issue.error) : 'ValueExpected'} at position ${issue?.offset ?? 0}`);
  }
  function convert(node: Node): unknown {
    if (node.type === 'number') return new Decimal(text.slice(node.offset, node.offset + node.length));
    if (node.type === 'array') return node.children!.map(convert);
    if (node.type === 'object')
      return Object.fromEntries(node.children!.map((property) => [property.children![0].value, convert(property.children![1])]));
    return node.value;
  }
  return convert(root);
}
// YAML 的 !!set、!!omap、!!binary、时间戳会变成 Set、Map、Uint8Array、Date，直接按普通对象输出会变成 {} 或按下标展开
function base64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const describeKey = (k: unknown) =>
  typeof k === 'string'
    ? `文字 ${JSON.stringify(k)}`
    : typeof k === 'bigint' || typeof k === 'number' || k instanceof Decimal
      ? `数字 ${String(k instanceof Decimal ? k.source : k)}`
      : k === null
        ? '空值 null'
        : typeof k === 'boolean'
          ? `布尔值 ${k}`
          : '复合键';
export function normalizeYamlValue(value: unknown, ancestors = new Set<object>()): unknown {
  if (value instanceof Decimal || !value || typeof value !== 'object') return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return String(value);
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (value instanceof Uint8Array) return base64(value);
  if (ancestors.has(value)) throw new Error('JSON 不支持循环引用，请移除 YAML 中引用自身的锚点');
  ancestors.add(value);
  const key = (k: unknown) =>
    typeof k === 'string'
      ? k
      : k instanceof Decimal
        ? k.source
        : typeof k === 'object' && k !== null
          ? JSON.stringify(normalizeYamlValue(k, ancestors), (_, v) => (typeof v === 'bigint' || v instanceof Decimal ? String(v) : v))
          : String(k);
  // JSON 的键只能是文字：YAML 里数字 1 和字符串 "1"、null 和 "null" 这样的键转过去会撞在一起，直接报错，不能悄悄丢掉一项
  const entries = (map: Map<unknown, unknown>) => {
    const seen = new Map<string, unknown>();
    for (const k of map.keys()) {
      const name = key(k);
      if (seen.has(name))
        throw new Error(
          `YAML 里有两个键转成 JSON 后都是 ${JSON.stringify(name)}（${describeKey(seen.get(name))} 和 ${describeKey(k)}），JSON 只能留一个，请把其中一个改名`
        );
      seen.set(name, k);
    }
    return [...map].map(([k, v]) => [key(k), normalizeYamlValue(v, ancestors)] as const);
  };
  const out =
    value instanceof Set
      ? [...value].map((v) => normalizeYamlValue(v, ancestors))
      : value instanceof Map
        ? Object.fromEntries(entries(value))
        : Array.isArray(value)
          ? value.map((v) => normalizeYamlValue(v, ancestors))
          : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeYamlValue(v, ancestors)]));
  ancestors.delete(value);
  return out;
}
function serialize(value: unknown, gap: string, depth = 0, ancestors = new Set<object>()): string {
  if (value instanceof Decimal) return value.source;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('JSON 不支持 NaN 或 Infinity，请使用字符串明确表示');
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (ancestors.has(value)) throw new Error('JSON 不支持循环引用，请移除 YAML 中引用自身的锚点');
  ancestors.add(value);
  const array = Array.isArray(value);
  const entries = array
    ? value.map((v) => serialize(v, gap, depth + 1, ancestors))
    : Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}:${gap ? ' ' : ''}${serialize(v, gap, depth + 1, ancestors)}`);
  ancestors.delete(value);
  const [open, close] = array ? ['[', ']'] : ['{', '}'];
  return (
    open +
    (entries.length
      ? gap
        ? `\n${gap.repeat(depth + 1)}${entries.join(',\n' + gap.repeat(depth + 1))}\n${gap.repeat(depth)}`
        : entries.join(',')
      : '') +
    close
  );
}
export function formatJson(text: string, options: JsonOptions, repair = false) {
  let value: unknown;
  if (options.source === 'yaml') {
    const doc = parseDocument(text, { uniqueKeys: true, intAsBigInt: true, customTags: (tags) => [numberTag, ...tags] });
    if (doc.errors.length) throw doc.errors[0];
    // mapAsMap 保留键原本的类型，转换时才能发现撞名
    value = normalizeYamlValue(doc.toJS({ maxAliasCount: 100, mapAsMap: true }));
  } else value = parseJson(repair ? jsonrepair(text) : text);
  // 先验证循环和非有限值，排序时也不会陷入循环。
  const gap = options.compact ? '' : options.indent === 'tab' ? '\t' : ' '.repeat(Number(options.indent));
  const json = serialize(value, gap);
  if (options.sort) value = sortKeys(value);
  return options.target === 'yaml'
    ? stringify(value, { customTags: (tags) => [numberTag, ...tags] })
    : options.sort
      ? serialize(value, gap)
      : json;
}
export function jsonError(text: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const pos = raw.match(/position (\d+)/i);
  const lc = raw.match(/line (\d+)[, ]+column (\d+)/i);
  const before = text.slice(0, pos ? Number(pos[1]) : text.length);
  const line = lc ? Number(lc[1]) : before.split('\n').length;
  const column = lc ? Number(lc[2]) : before.length - before.lastIndexOf('\n');
  const hints: Record<string, string> = {
    PropertyNameExpected: '这里需要双引号包住的键名，也请检查末尾是否多了逗号',
    ColonExpected: '键名后面少了冒号',
    CommaExpected: '相邻项目之间少了逗号',
    ValueExpected: '这里需要一个值，例如文字、数字、true 或 null',
    CloseBraceExpected: '对象缺少右花括号 }',
    CloseBracketExpected: '数组缺少右方括号 ]',
    EndOfFileExpected: '完整 JSON 后还有多余内容，请删除或放进同一个数组',
    InvalidCommentToken: '标准 JSON 不支持注释，可以使用一键修复移除注释',
    UnexpectedEndOfString: '字符串缺少结尾的双引号',
    InvalidEscapeCharacter: '反斜杠后的转义字符不正确，普通反斜杠需要写两次',
    InvalidNumberFormat: '数字格式不完整，请检查小数点与指数'
  };
  const hint =
    hints[raw.split(/\s/)[0]] ||
    (/end|unterminated/i.test(raw) ? '内容还没写完，请检查引号和括号是否成对' : '请检查这一处的引号、冒号、逗号和括号');
  return `第 ${line} 行第 ${column} 列：${hint}。${raw}`;
}

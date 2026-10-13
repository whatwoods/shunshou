import { camelCase, pascalCase, snakeCase, kebabCase, constantCase, capitalCase } from 'change-case';
export const modes = {
  camel: 'camelCase',
  pascal: 'PascalCase',
  snake: 'snake_case',
  kebab: 'kebab-case',
  constant: 'CONSTANT_CASE',
  title: 'Title Case',
  sentence: '句首大写',
  upper: '全部大写',
  lower: '全部小写'
};
export function convert(text: string, mode: keyof typeof modes) {
  const fn = {
    camel: camelCase,
    pascal: pascalCase,
    snake: snakeCase,
    kebab: kebabCase,
    constant: constantCase,
    title: capitalCase,
    sentence: (s: string) => s.toLowerCase().replace(/(^\s*|[.!?。！？]\s*)(\p{L})/gu, (_, p, l) => p + l.toUpperCase()),
    upper: (s: string) => s.toUpperCase(),
    lower: (s: string) => s.toLowerCase()
  }[mode];
  if (!fn) throw new Error('请选择转换格式');
  return text
    .split(/\r\n?|\n/)
    .map((line) => fn(line))
    .join('\n');
}

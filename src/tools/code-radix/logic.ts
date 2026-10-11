const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
export function parseInteger(input: string, base: number): bigint {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error('进制请设为 2–36 的整数');
  let value = input.trim().toLowerCase();
  if (!value) throw new Error('请输入整数');
  if (value.length > 10000) throw new Error('每个整数最多 1 万位，请分开处理');
  const sign = value.startsWith('-') ? -1n : 1n;
  value = value.replace(/^[+-]/, '');
  const prefix = { 2: '0b', 8: '0o', 16: '0x' }[base];
  if (prefix && value.startsWith(prefix)) value = value.slice(2);
  if (!value) throw new Error('进制前缀后还需要数字');
  let result = 0n;
  for (const char of value) {
    const digit = digits.indexOf(char);
    if (digit < 0 || digit >= base) throw new Error(`“${char}”不是 ${base} 进制的有效数字；此工具仅转换整数`);
    result = result * BigInt(base) + BigInt(digit);
  }
  return sign * result;
}
export interface RadixOptions {
  from: number;
  to: number;
  upper: boolean;
  prefix: boolean;
}
export function convertIntegers(text: string, options: RadixOptions) {
  if (!Number.isInteger(options.to) || options.to < 2 || options.to > 36) throw new Error('输出进制请设为 2–36 的整数');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 10000) throw new Error('每次最多 1 万行，请拆开处理');
  let count = 0;
  const output = lines
    .map((line, index) => {
      if (!line.trim()) return '';
      try {
        const value = parseInteger(line, options.from);
        const sign = value < 0 ? '-' : '';
        let result = (value < 0 ? -value : value).toString(options.to);
        if (options.upper) result = result.toUpperCase();
        count++;
        return sign + (options.prefix ? { 2: '0b', 8: '0o', 16: '0x' }[options.to] || '' : '') + result;
      } catch (e) {
        throw new Error(`第 ${index + 1} 行：${(e as Error).message}`);
      }
    })
    .join('\n');
  return { output, count };
}

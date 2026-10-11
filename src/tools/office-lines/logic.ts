export const defaults = { trim: true, empty: true, unique: true, ignoreCase: false, sort: 'none', prefix: '', suffix: '' };
export function processLines(text: string, options: typeof defaults) {
  if (text.length > 5_000_000) throw new Error('文字超过 500 万字符，请分批处理');
  if (!text) return { text: '', before: 0, after: 0 };
  let lines = text.replace(/\r\n?/g, '\n').split('\n');
  const before = lines.length;
  if (options.trim) lines = lines.map((line) => line.trim());
  if (options.empty) lines = lines.filter((line) => line.trim());
  if (options.unique) {
    const seen = new Set<string>();
    lines = lines.filter((line) => {
      const key = options.ignoreCase ? line.toLocaleLowerCase('en') : line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const compare = new Intl.Collator('zh-CN', { numeric: true, sensitivity: options.ignoreCase ? 'accent' : 'variant' }).compare;
  if (options.sort === 'asc') lines.sort(compare);
  if (options.sort === 'desc') lines.sort((a, b) => compare(b, a));
  if (options.sort === 'reverse') lines.reverse();
  const after = lines.length;
  if ((options.prefix.length + options.suffix.length) * after + text.length > 10_000_000)
    throw new Error('添加前后缀后文字太长，请缩短前后缀或分批处理');
  return { text: lines.map((line) => options.prefix + line + options.suffix).join('\n'), before, after };
}

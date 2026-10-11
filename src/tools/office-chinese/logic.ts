export const variants = { cn: '简体中文', t: '通用繁体', tw: '台湾繁体', twp: '台湾繁体（含用词）', hk: '香港繁体' };
export type Variant = keyof typeof variants;
export async function convertChinese(text: string, from: Variant, to: Variant): Promise<string> {
  if (text.length > 2_000_000) throw new Error('文字超过 200 万字符，请分批转换');
  if (!(from in variants) || !(to in variants)) throw new Error('请选择有效的转换方式');
  if (!text || from === to) return text;
  const { Converter } = await import('opencc-js');
  return Converter({ from, to })(text);
}

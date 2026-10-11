import { encodeHTML, decodeHTML } from 'entities';
export type EscapeFormat = 'html' | 'unicode' | 'codepoint' | 'json';
export function unicodeEncode(text: string, codepoint = false): string {
  if (codepoint) return Array.from(text, (c) => `\\u{${c.codePointAt(0)!.toString(16)}}`).join('');
  let result = '';
  for (let i = 0; i < text.length; i++) result += '\\u' + text.charCodeAt(i).toString(16).padStart(4, '0');
  return result;
}
export function unicodeDecode(text: string): string {
  let output = '';
  const simple: Record<string, string> = {
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
    v: '\v',
    '0': '\0',
    "'": "'",
    '"': '"',
    '\\': '\\',
    '/': '/'
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') {
      output += text[i];
      continue;
    }
    const start = i;
    const next = text[++i];
    if (next === 'u' || next === 'x') {
      if (next === 'u' && text[i + 1] === '{') {
        const end = text.indexOf('}', i + 2);
        const digits = text.slice(i + 2, end);
        if (end < 0 || !/^[0-9a-f]{1,6}$/i.test(digits) || parseInt(digits, 16) > 0x10ffff)
          throw new Error(`第 ${start + 1} 个字符：Unicode 码点应在 0–10FFFF 之间，并以 } 结尾`);
        output += String.fromCodePoint(parseInt(digits, 16));
        i = end;
      } else {
        const length = next === 'u' ? 4 : 2;
        const digits = text.slice(i + 1, i + 1 + length);
        if (digits.length !== length || !/^[0-9a-f]+$/i.test(digits))
          throw new Error(`第 ${start + 1} 个字符：\\${next} 后需要 ${length} 位十六进制数`);
        output += String.fromCharCode(parseInt(digits, 16));
        i += length;
      }
    } else if (Object.hasOwn(simple, next)) {
      if (next === '0' && /\d/.test(text[i + 1] || '')) throw new Error('不支持八进制转义，请使用 \\uXXXX 或 \\xXX');
      output += simple[next];
    } else throw new Error(`第 ${start + 1} 个字符：无法识别转义，普通反斜杠需要写成 \\\\`);
  }
  return output;
}
export function transformEscape(text: string, format: EscapeFormat, decode: boolean): string {
  if (format === 'html') return decode ? decodeHTML(text) : encodeHTML(text);
  if (format === 'json') {
    if (!decode) return JSON.stringify(text);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('请输入完整 JSON 字符串，包含两端双引号，并检查内部转义');
    }
    if (typeof value !== 'string') throw new Error('这里需要 JSON 字符串，不能是对象、数组或数字');
    return value;
  }
  return decode ? unicodeDecode(text) : unicodeEncode(text, format === 'codepoint');
}

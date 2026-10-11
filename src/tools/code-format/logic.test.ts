import { describe, it, expect } from 'vitest';
import { formatCode, detectLanguage, type FormatOptions } from './logic';
const options: FormatOptions = { language: 'javascript', indent: 2, tabs: false, width: 80, dialect: 'sql' };
describe('code formatter', () => {
  it.each([
    ['javascript', 'const x={a:1}', 'const x = { a: 1 };'],
    ['typescript', 'const x:number=1', 'const x: number = 1;'],
    ['json', '{"x":1}', '{ "x": 1 }'],
    ['html', '<div><p>Hello</p></div>', '<div><p>Hello</p></div>'],
    ['css', 'a{color:red}', 'a {\n  color: red;\n}'],
    ['sql', 'select a,b from users where a=1', 'SELECT']
  ] as const)('formats %s', async (language, text, expected) => {
    const result = await formatCode(text, { ...options, language });
    expect(result).toContain(expected);
    expect(await formatCode(result, { ...options, language })).toBe(result);
  });
  it('preserves SQL string contents and honors dialect', async () => {
    const out = await formatCode("select `my field`, 'select from' from t", { ...options, language: 'sql', dialect: 'mysql' });
    expect(out).toContain('`my field`');
    expect(out).toContain("'select from'");
  });
  it('uses configured indentation', async () =>
    expect(await formatCode('if(true){f()}', { ...options, indent: 4 })).toContain('\n    f();'));
  it('reports malformed code', async () => {
    await expect(formatCode('const =', options)).rejects.toThrow();
  });
  it('rejects empty and oversize input', async () => {
    await expect(formatCode('', options)).rejects.toThrow();
    await expect(formatCode('a'.repeat(5_000_001), options)).rejects.toThrow();
  });
  it('detects filenames case insensitively', () => {
    expect(detectLanguage('HELLO.TSX')).toBe('typescript');
    expect(detectLanguage('readme.txt')).toBeUndefined();
  });
});

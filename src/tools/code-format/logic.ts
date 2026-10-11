export type Language = 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'sql';
export type Dialect = 'sql' | 'mysql' | 'postgresql' | 'sqlite';
export interface FormatOptions {
  language: Language;
  indent: number;
  tabs: boolean;
  width: number;
  dialect: Dialect;
}
export async function formatCode(text: string, options: FormatOptions): Promise<string> {
  if (!text.trim()) throw new Error('请先输入代码或打开文件');
  if (text.length > 5_000_000) throw new Error('代码超过 500 万字符，请拆分后再格式化');
  if (![2, 4, 8].includes(options.indent) || ![80, 100, 120].includes(options.width)) throw new Error('请选择有效的缩进和行宽');
  if (options.language === 'sql') {
    const { format } = await import('sql-formatter');
    return format(text, { language: options.dialect, tabWidth: options.indent, useTabs: options.tabs, keywordCase: 'upper' }) + '\n';
  }
  const { format } = await import('prettier/standalone');
  const common = { tabWidth: options.indent, useTabs: options.tabs, printWidth: options.width };
  if (options.language === 'html') {
    const html = await import('prettier/plugins/html');
    return format(text, { ...common, parser: 'html', plugins: [html] });
  }
  if (options.language === 'css') {
    const postcss = await import('prettier/plugins/postcss');
    return format(text, { ...common, parser: 'css', plugins: [postcss] });
  }
  const estree = await import('prettier/plugins/estree');
  if (options.language === 'typescript') {
    const typescript = await import('prettier/plugins/typescript');
    return format(text, { ...common, parser: 'typescript', plugins: [typescript, estree] });
  }
  const babel = await import('prettier/plugins/babel');
  return format(text, { ...common, parser: options.language === 'json' ? 'json' : 'babel', plugins: [babel, estree] });
}
export function detectLanguage(name: string): Language | undefined {
  const ext = name.toLowerCase().split('.').pop() || '';
  return (
    {
      html: 'html',
      htm: 'html',
      css: 'css',
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      sql: 'sql'
    } as Record<string, Language>
  )[ext];
}

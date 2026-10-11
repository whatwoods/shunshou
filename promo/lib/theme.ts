import { createContext, useContext } from 'react';

// 网站的深色变量写在 :root[data-theme='dark'] 上，只能整页切换。宣传片里要用圆形把一部分画面切成深色，
// 所以启动时把所有深色规则复制一份，挂到 .dark-scope 上：同一套变量值，网站改了配色这里自动跟着变
export function installDarkScope() {
  const ROOT = /:root\[data-theme=["']dark["']\]/;
  const out: string[] = [];
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (!ROOT.test(rule.selectorText)) continue;
        const sel = rule.selectorText
          .split(/,(?![^(]*\))/)
          .filter((s) => ROOT.test(s))
          .map((s) => s.trim().replace(ROOT, '.dark-scope'))
          .join(', ');
        out.push(`${sel} { ${rule.style.cssText} }`);
      } else if (rule instanceof CSSMediaRule && !/reduce/.test(rule.conditionText)) {
        visit(rule.cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      /* 跨域样式表读不到，跳过 */
    }
  }
  let style = document.getElementById('dark-scope') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'dark-scope';
    document.head.append(style);
  }
  style.textContent = out.join('\n');
  return out.length;
}

export type Theme = 'light' | 'dark';
export const ThemeCtx = createContext<Theme>('light');
export const useThemeHere = () => useContext(ThemeCtx);

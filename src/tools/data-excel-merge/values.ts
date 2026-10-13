import type { Val } from './xlsx';

// Excel 的日期序号（1900 日期系统）和年月日互转
const EPOCH = Date.UTC(1899, 11, 30);
export function serialText(n: number): string {
  const d = new Date(EPOCH + Math.round(n * 86400) * 1000);
  const day = d.toISOString().slice(0, 10);
  const secs = Math.round((n % 1) * 86400);
  return secs ? `${day} ${d.toISOString().slice(11, secs % 60 ? 19 : 16)}` : day;
}

// “2026-09-03”“2026/9/3”“2026年9月3日”这类文字转成日期序号；认不出返回 null
export function parseDate(text: string): number | null {
  const m = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h = '0', mi = '0', se = '0'] = m.slice(1);
  const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  const back = new Date(t);
  if (back.getUTCMonth() !== +mo - 1 || back.getUTCDate() !== +d) return null;
  return (t - EPOCH) / 86400000;
}

export function valText(v: Val | null | undefined): string {
  if (!v) return '';
  if (v.t === 'd') return serialText(v.v);
  if (v.t === 'b') return v.v ? 'TRUE' : 'FALSE';
  if (v.t === 'n') return String(v.v);
  return v.v;
}

// 比较用：全角转半角、去首尾和多余空格、不分大小写；数字 1 和文字 “1” 算一样
export function normVal(v: Val | null | undefined): string {
  return valText(v).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
export const isEmpty = (v: Val | null | undefined) => !v || (v.t === 's' && !v.v.trim());

// 列名比较用：去掉空格、星号、冒号、换行，全角转半角
export function normName(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s*:：·•]/g, '');
}
// 再宽松一点：去掉括号里的说明（“金额（元）”“姓名(必填)”）
export function looseName(s: string): string {
  return normName(s).replace(/[(（[【].*?[)）\]】]/g, '') || normName(s);
}

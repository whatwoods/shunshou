import { Temporal } from '@js-temporal/polyfill';
export type Disambiguation = 'reject' | 'earlier' | 'later';
export function parseTimestamp(input: string, unit: 's' | 'ms'): number {
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(input.trim())) throw new Error('请输入数字时间戳，可使用负数或小数');
  const normalized = input.trim();
  const negative = normalized.startsWith('-');
  const [integer, fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
  const digits = unit === 's' ? 3 : 0;
  if (integer.length > 17 || /[1-9]/.test(fraction.slice(digits))) throw new Error('时间戳超出范围，或精度小于 1 毫秒');
  // 用十进制字符串组装毫秒，避免 1.001 × 1000 的浮点误差。
  const magnitude = BigInt(integer) * (unit === 's' ? 1000n : 1n) + BigInt(fraction.slice(0, digits).padEnd(digits, '0') || '0');
  const ms = Number(negative ? -magnitude : magnitude);
  if (!Number.isSafeInteger(ms) || Math.abs(ms) > 8640000000000000) throw new Error('时间戳超出可转换范围');
  return ms;
}
export function parseDate(input: string, zone: string, disambiguation: Disambiguation = 'reject'): number {
  const value = input.trim();
  if (!value) throw new Error('请输入日期和时间');
  try {
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return Temporal.Instant.from(value).epochMilliseconds;
    return Temporal.PlainDateTime.from(value, { overflow: 'reject' }).toZonedDateTime(zone, { disambiguation }).epochMilliseconds;
  } catch {
    throw new Error('日期或时区不对，或碰上了夏令时跳过、重复的时刻，请检查输入');
  }
}
export function formatTime(ms: number, zone: string) {
  const instant = Temporal.Instant.fromEpochMilliseconds(ms);
  const zoned = instant.toZonedDateTimeISO(zone);
  return {
    seconds: String(ms / 1000),
    milliseconds: String(ms),
    iso: instant.toString({ fractionalSecondDigits: 3 }),
    local: zoned.toPlainDateTime().toString({ fractionalSecondDigits: 3 }),
    zoned: zoned.toString({ fractionalSecondDigits: 3 }),
    rfc: new Date(ms).toUTCString()
  };
}

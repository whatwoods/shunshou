import { describe, expect, it } from 'vitest';
import { formatTime, parseDate, parseTimestamp } from './logic';
describe('时间戳与时区', () => {
  it('秒、毫秒、负数和小数', () => {
    expect(parseTimestamp('1704067200', 's')).toBe(1704067200000);
    expect(parseTimestamp('-0.001', 's')).toBe(-1);
    expect(parseTimestamp('1.001', 's')).toBe(1001);
    expect(parseTimestamp('1704067200.123', 's')).toBe(1704067200123);
    expect(parseTimestamp('1704067200000', 'ms')).toBe(1704067200000);
    expect(() => parseTimestamp('', 's')).toThrow();
    expect(() => parseTimestamp('1e9', 's')).toThrow();
    expect(() => parseTimestamp('0.0001', 's')).toThrow();
  });
  it('按时区解释无偏移日期，保留显式偏移', () => {
    expect(parseDate('2024-01-01T08:00:00', 'Asia/Shanghai')).toBe(1704067200000);
    expect(parseDate('2024-01-01T08:00:00+08:00', 'America/New_York')).toBe(1704067200000);
    expect(formatTime(0, 'Asia/Kolkata').local).toBe('1970-01-01T05:30:00.000');
  });
  it('拒绝无效日期和夏令时跳过的时间', () => {
    expect(() => parseDate('2024-02-30T12:00', 'UTC')).toThrow();
    expect(() => parseDate('2024-03-10T02:30', 'America/New_York')).toThrow();
  });
  it('重新解析带时区标注的输出时保留原来的时刻', () => {
    const time = 1704067200123;
    const formatted = formatTime(time, 'Asia/Shanghai');
    expect(parseDate(formatted.zoned, 'America/New_York')).toBe(time);
  });
  it('重复时间允许显式选择前后两次', () => {
    const early = parseDate('2024-11-03T01:30', 'America/New_York', 'earlier');
    const late = parseDate('2024-11-03T01:30', 'America/New_York', 'later');
    expect(late - early).toBe(3600000);
    expect(() => parseDate('2024-11-03T01:30', 'America/New_York')).toThrow();
  });
});

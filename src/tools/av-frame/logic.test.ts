import { describe, expect, it } from 'vitest';
import { timestamps, timeLabel } from '../../lib/av/logic';
describe('截帧计划', () => {
  it('排除结束边界，避免导出重复尾帧', () => {
    expect(timestamps(1, 2, 0.25)).toEqual([1, 1.25, 1.5, 1.75]);
  });
  it('限制张数，拒绝无效间隔', () => {
    expect(() => timestamps(0, 100, 0.01, 500)).toThrow('最多 500');
    expect(() => timestamps(0, 1, 0)).toThrow();
    expect(() => timestamps(0, 1, NaN)).toThrow();
  });
  it('处理浮点边界与跨分钟显示', () => {
    expect(timestamps(0, 0.3, 0.1)).toHaveLength(3);
    expect(timeLabel(59.9999)).toBe('1:00.000');
  });
});

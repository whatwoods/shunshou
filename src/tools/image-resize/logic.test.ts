import { it, expect } from 'vitest';
import { dimensions } from '../../lib/image/logic';
it('长边与包围盒都保持比例', () => {
  expect(dimensions(4000, 3000, 'long', 1000, 500, 50, true)).toEqual({ width: 1000, height: 750 });
  expect(dimensions(4000, 3000, 'box', 1000, 500, 50, true)).toEqual({ width: 667, height: 500 });
});
it('百分比和拉伸尺寸', () => {
  expect(dimensions(100, 80, 'percent', 100, 100, 50, true)).toEqual({ width: 50, height: 40 });
  expect(dimensions(100, 80, 'box', 50, 50, 50, false)).toEqual({ width: 50, height: 50 });
});
it('拒绝非法和超大尺寸', () => {
  expect(() => dimensions(10, 10, 'long', 0, 10, 50, true)).toThrow();
  expect(() => dimensions(100, 100, 'long', 100000, 10, 50, true)).toThrow();
});

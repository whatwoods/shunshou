import { it, expect } from 'vitest';
import { bmpBytes } from '../../lib/image/logic';
it('BMP 24 位像素使用 BGR 与四字节行对齐', () => {
  const out = bmpBytes(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1);
  expect(out.length).toBe(58);
  expect([...out.slice(54)]).toEqual([3, 2, 1, 0]);
  expect(new DataView(out.buffer).getUint32(2, true)).toBe(58);
});

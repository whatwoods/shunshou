import { it, expect } from 'vitest';
import { units, convert } from './logic';
it('converts affine temperatures', () => {
  expect(convert(32, units['温度'][1], units['温度'][0])).toBeCloseTo(0);
  expect(() => convert(-274, units['温度'][0], units['温度'][2])).toThrow();
});
it('distinguishes binary storage and traditional units', () => {
  expect(convert(1, units['存储'][6], units['存储'][0])).toBe(1024);
  expect(convert(1, units['重量'][4], units['重量'][1])).toBe(500);
});

it('rejects negative Kelvin even without an offset', () => expect(() => convert(-1, units['温度'][2], units['温度'][2])).toThrow());

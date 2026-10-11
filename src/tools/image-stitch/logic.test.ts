import { it, expect } from 'vitest';
import { stitchLayout, stitchDefaults } from '../../lib/image/extras';
it('长图等宽保持比例且间隔不多加', () => {
  expect(
    stitchLayout(
      [
        { width: 100, height: 50 },
        { width: 50, height: 100 }
      ],
      { ...stitchDefaults, size: 200, gap: 10 }
    )
  ).toEqual({
    width: 200,
    height: 510,
    boxes: [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 0, y: 110, width: 200, height: 400 }
    ]
  });
});
it('横向等高拼接', () => {
  const r = stitchLayout(
    [
      { width: 100, height: 50 },
      { width: 50, height: 100 }
    ],
    { ...stitchDefaults, size: 100, direction: 'horizontal' }
  );
  expect([r.width, r.height]).toEqual([250, 100]);
});
it('限制超长图与不合法参数', () => {
  expect(() => stitchLayout([{ width: 1, height: 100000 }], stitchDefaults)).toThrow();
  expect(() => stitchLayout([], stitchDefaults)).toThrow();
  expect(() => stitchLayout([{ width: 1, height: 1 }], { ...stitchDefaults, gap: -1 })).toThrow();
});

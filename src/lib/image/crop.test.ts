import { describe, expect, it } from 'vitest';
import { dragCrop, type CropRect } from './crop';

const box: CropRect = { x: 10, y: 10, w: 80, h: 80 };
const inside = (r: CropRect) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 100 + 1e-9 && r.y + r.h <= 100 + 1e-9;

describe('dragCrop', () => {
  it('整体移动，不出图片', () => {
    expect(dragCrop(box, 'move', 50, 50, 5, -3)).toEqual({ x: 15, y: 7, w: 80, h: 80 });
    expect(dragCrop(box, 'move', 50, 50, 50, 50)).toEqual({ x: 20, y: 20, w: 80, h: 80 });
  });
  it('拖角改大小，对角固定', () => {
    expect(dragCrop(box, 'se', 0, 0, -30, -20)).toEqual({ x: 10, y: 10, w: 50, h: 60 });
    expect(dragCrop(box, 'nw', 0, 0, 20, 30)).toEqual({ x: 30, y: 40, w: 60, h: 50 });
  });
  it('拖边只动一条边', () => {
    expect(dragCrop(box, 'e', 0, 0, -40, 0)).toEqual({ x: 10, y: 10, w: 40, h: 80 });
    expect(dragCrop(box, 'n', 0, 0, 0, 20)).toEqual({ x: 10, y: 30, w: 80, h: 60 });
  });
  it('锁定比例时保持宽高比，也不出图片', () => {
    for (const kind of ['se', 'nw', 'ne', 'sw', 'e', 'w', 'n', 's', 'draw'] as const) {
      for (const [dx, dy] of [
        [30, 10],
        [-60, 5],
        [90, 90],
        [-5, -70]
      ]) {
        const r = dragCrop(box, kind, 40, 40, dx, dy, 1.5);
        expect(r.w / r.h).toBeCloseTo(1.5, 6);
        expect(inside(r)).toBe(true);
      }
    }
  });
  it('框外拖动画一个新框，可以往任意方向拉', () => {
    expect(dragCrop(box, 'draw', 60, 60, -20, -10)).toEqual({ x: 40, y: 50, w: 20, h: 10 });
  });
  it('拖过头会翻到另一边，但不会小于最小尺寸', () => {
    const r = dragCrop(box, 'e', 0, 0, -200, 0);
    expect(inside(r)).toBe(true);
    expect(r.w).toBeGreaterThanOrEqual(2);
  });
});

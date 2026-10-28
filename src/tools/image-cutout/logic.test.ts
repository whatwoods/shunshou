import { describe, expect, it } from 'vitest';
import { applyMask, bounds, dabs, MODELS, toMask, toPixels, toTensor } from './logic';

it('抠图保留原图透明度，并与模型遮罩相乘', () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 128, 0, 255, 0, 255]);
  applyMask(pixels, new Uint8ClampedArray([255, 0, 0, 255, 128, 0, 0, 255, 64, 0, 0, 255]));
  expect(Array.from(pixels)).toEqual([0, 0, 0, 0, 255, 0, 0, 64, 0, 255, 0, 64]);
});

describe('toTensor', () => {
  it('按通道排成 NCHW 并归一化', () => {
    const px = new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 0, 255]);
    const { mean, std } = MODELS.fine;
    const t = toTensor(px, 1, mean, std);
    expect(t.length).toBe(3);
    expect(t[0]).toBeCloseTo(1 - 0.485);
    expect(t[2]).toBeCloseTo(128 / 255 - 0.406);
  });
});

describe('toMask', () => {
  it('拉伸到 0–255', () => {
    expect(Array.from(toMask(new Float32Array([2, 3, 4]), false))).toEqual([0, 128, 255]);
  });
  it('清理后背景的残影归零、主体变实心，中间保留半透明', () => {
    const m = toMask(new Float32Array([0, 0.05, 0.5, 0.95, 1]), true);
    expect(m[0]).toBe(0);
    expect(m[1]).toBe(0);
    expect(m[2]).toBe(128);
    expect(m[3]).toBe(255);
    expect(m[4]).toBe(255);
  });
  it('全是同一个值时不出 NaN', () => {
    expect(Array.from(toMask(new Float32Array([0.3, 0.3]), true))).toEqual([0, 0]);
  });
});

describe('bounds', () => {
  it('找出不透明像素的外接框', () => {
    const a = new Uint8Array(5 * 4);
    a[1 * 5 + 2] = 200;
    a[2 * 5 + 3] = 200;
    expect(bounds((i) => a[i], 5, 4)).toEqual({ x: 2, y: 1, w: 2, h: 2 });
  });
  it('全透明时返回 null', () => {
    expect(bounds(() => 0, 3, 3)).toBeNull();
  });
});

describe('toPixels', () => {
  it('百分比范围换成像素，不出界', () => {
    expect(toPixels({ x: 25, y: 10, w: 50, h: 80 }, 200, 100)).toEqual({ x: 50, y: 10, w: 100, h: 80 });
    expect(toPixels({ x: 99.9, y: 99.9, w: 5, h: 5 }, 100, 100)).toEqual({ x: 99, y: 99, w: 1, h: 1 });
  });
});

describe('dabs', () => {
  it('一个点就是一个圆点', () => {
    expect(dabs([5, 5], 4)).toEqual([5, 5]);
  });
  it('两点之间补齐，间隔不超过半径的 0.4', () => {
    const d = dabs([0, 0, 10, 0], 5);
    expect(d.slice(0, 2)).toEqual([0, 0]);
    expect(d.slice(-2)).toEqual([10, 0]);
    for (let i = 2; i < d.length; i += 2) expect(d[i] - d[i - 2]).toBeLessThanOrEqual(2);
  });
  it('从中间开始只给新的一段', () => {
    expect(dabs([0, 0, 0, 1, 0, 3], 10, 2)).toEqual([0, 3]);
  });
});

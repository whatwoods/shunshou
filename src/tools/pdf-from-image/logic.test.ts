import { expect, it } from 'vitest';
import { fitPage, jpegOrientation, orientedDraw, visibleBox } from '../../lib/pdf/logic';
it('fits portrait and landscape images without distortion', () => {
  expect(fitPage(100, 200, 600, 800, 20)).toEqual({ x: 110, y: 20, width: 380, height: 760 });
  expect(fitPage(200, 100, 600, 800, 20)).toEqual({ x: 20, y: 260, width: 560, height: 280 });
});
it('rejects margins that leave no room', () => expect(() => fitPage(100, 100, 100, 100, 50)).toThrow());

// 手机竖拍：像素横着存、EXIF 方向标 6。转 PDF 时要按转正后的方向放
function exifJpeg(orientation: number, little: boolean) {
  const u16 = (n: number) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n: number) =>
    little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
  const tiff = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0)
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    4,
    0,
    0,
    0xff,
    0xe1,
    (app1.length + 2) >> 8,
    (app1.length + 2) & 255,
    ...app1,
    0xff,
    0xda,
    0,
    2
  ]);
}
it('读出 JPEG 的 EXIF 方向', () => {
  for (const o of [1, 3, 6, 8, 2]) {
    expect(jpegOrientation(exifJpeg(o, true))).toBe(o);
    expect(jpegOrientation(exifJpeg(o, false))).toBe(o);
  }
  expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1);
  expect(jpegOrientation(new Uint8Array([0x89, 0x50]))).toBe(1);
});
it('按 EXIF 方向画：原图左上角落到转正后应在的角上，四个角都在框里', () => {
  // 转正后是竖的 60×120，原始像素是横的 120×60
  const box = { x: 10, y: 20, width: 60, height: 120 };
  const corner = (o: number, u: number, v: number) => {
    const d = orientedDraw(o, box);
    const t = (d.rotate * Math.PI) / 180;
    const pu = u * d.width,
      pv = v * d.height;
    return [Math.round(d.x + pu * Math.cos(t) - pv * Math.sin(t)), Math.round(d.y + pu * Math.sin(t) + pv * Math.cos(t))];
  };
  const [L, R, B, T] = [10, 70, 20, 140];
  // 原图左上角在图像坐标里是 (0, 1)
  expect(corner(6, 0, 1)).toEqual([R, T]);
  expect(corner(8, 0, 1)).toEqual([L, B]);
  for (const o of [6, 8])
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ]) {
      const [x, y] = corner(o, u, v);
      expect(x >= L && x <= R && y >= B && y <= T).toBe(true);
    }
  const wide = { x: 0, y: 0, width: 120, height: 60 };
  const d3 = orientedDraw(3, wide);
  expect([d3.x - d3.width, d3.y - d3.height, d3.rotate]).toEqual([0, 0, 180]);
});

it('可见区域是裁剪框和媒体框的交集', () => {
  const media = { x: 0, y: 0, width: 100, height: 100 };
  // 裁剪框伸出媒体框左右两边：只留中间
  expect(visibleBox(media, { x: -50, y: 0, width: 200, height: 100 })).toEqual(media);
  expect(visibleBox(media, { x: 20, y: 10, width: 200, height: 50 })).toEqual({ x: 20, y: 10, width: 80, height: 50 });
  // 反着写的坐标先摆正
  expect(visibleBox(media, { x: 80, y: 90, width: -60, height: -80 })).toEqual({ x: 20, y: 10, width: 60, height: 80 });
  // 不相交：裁剪框无效，用媒体框
  expect(visibleBox(media, { x: 200, y: 200, width: 10, height: 10 })).toEqual(media);
});

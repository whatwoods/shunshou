import { describe, it, expect } from 'vitest';
import { stripMetadata, preserveOrientation } from '../../lib/image/logic';
describe('无损元数据清理', () => {
  it('JPEG 删除拍摄信息、保留像素扫描数据与 ICC', () => {
    const icc = [255, 226, 0, 14, ...new TextEncoder().encode('ICC_PROFILE\0')];
    const scan = [255, 218, 0, 2, 8, 9, 255, 217];
    const bytes = new Uint8Array([255, 216, 255, 225, 0, 4, 11, 22, ...icc, ...scan]);
    expect([...stripMetadata(bytes).bytes]).toEqual([255, 216, ...icc, ...scan]);
  });
  it('拒绝截断的 JPEG', () => expect(() => stripMetadata(new Uint8Array([255, 216, 255, 225, 0, 9]))).toThrow());
  it('仅重新加入方向，不带 GPS', () => {
    const clean = new Uint8Array([255, 216, 255, 218, 0, 2, 7, 255, 217]);
    const out = preserveOrientation(clean, 'jpg', 6);
    expect(out.length).toBe(clean.length + 36);
    expect(out[30]).toBe(6);
    expect(stripMetadata(out).bytes).toEqual(clean);
  });
  it('清除 WebP 扩展标志与 EXIF 数据', () => {
    const bytes = new Uint8Array(40);
    bytes.set([82, 73, 70, 70, 32, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, 12]);
    bytes.set([69, 88, 73, 70, 2, 0, 0, 0, 1, 2], 30);
    const out = stripMetadata(bytes).bytes;
    expect(out.length).toBe(30);
    expect(out[20]).toBe(0);
    expect(out[4]).toBe(22);
  });
});

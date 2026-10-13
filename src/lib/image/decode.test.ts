import { afterEach, expect, it, vi } from 'vitest';
import { decode } from './decode';

const { avifDecode } = vi.hoisted(() => ({ avifDecode: vi.fn() }));
vi.mock('@jsquash/avif/decode', () => ({ default: avifDecode }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('HEIC 优先使用浏览器解码', async () => {
  const bitmap = { width: 20, height: 10 };
  const native = vi.fn().mockResolvedValue(bitmap);
  vi.stubGlobal('createImageBitmap', native);
  const file = new File(['heic'], 'photo.heic', { type: 'image/heic' });
  expect(await decode(file)).toBe(bitmap);
  expect(native).toHaveBeenCalledExactlyOnceWith(file);
});

it('AVIF 没有扩展名时仍按 MIME 使用降级解码', async () => {
  const pixels = { width: 2, height: 1, data: new Uint8ClampedArray(8) };
  const bitmap = { width: 2, height: 1 };
  const native = vi.fn().mockRejectedValueOnce(new Error('unsupported')).mockResolvedValueOnce(bitmap);
  avifDecode.mockResolvedValue(pixels);
  vi.stubGlobal('createImageBitmap', native);
  expect(await decode(new File(['avif'], 'download', { type: 'image/avif' }))).toBe(bitmap);
  expect(avifDecode).toHaveBeenCalledTimes(1);
  expect(native).toHaveBeenLastCalledWith(pixels);
});

it('不支持的损坏文件给出可操作的错误', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad file')));
  await expect(decode(new File(['bad'], 'broken.png', { type: 'image/png' }))).rejects.toThrow('图片打不开');
});

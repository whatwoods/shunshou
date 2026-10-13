import { it, expect } from 'vitest';
import { wifi, validColors } from './logic';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
it('escapes Wi-Fi delimiters', () => {
  expect(wifi('a;b', 'p:q', 'WPA', true)).toBe('WIFI:T:WPA;S:a\\;b;P:p\\:q;H:true;;');
  expect(() => wifi('', '', 'WPA', false)).toThrow();
});
it('does not embed a previous password in an open-network QR code', () => {
  expect(wifi('Guest', 'private-password', 'nopass', false)).toBe('WIFI:T:nopass;S:Guest;P:;H:false;;');
  expect(() => wifi('Guest', '', 'WPA;P:injected', false)).toThrow('加密方式');
});
it('rejects indistinguishable colors', () => expect(() => validColors('#ffffff', '#FFFFFF')).toThrow());
it('round trips unicode QR content', () => {
  const text = '顺手 https://example.com/?a=你好';
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size,
    scale = 6,
    size = (n + 8) * scale,
    pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const a = Math.floor(x / scale) - 4,
        b = Math.floor(y / scale) - 4;
      const black = a >= 0 && b >= 0 && a < n && b < n && qr.modules.get(b, a);
      const i = (y * size + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = black ? 0 : 255;
      pixels[i + 3] = 255;
    }
  expect(jsQR(pixels, size, size)?.data).toBe(text);
});

import { validColors } from './logic';
self.onmessage = async (e) => {
  try {
    const d = e.data;
    if (d.action === 'decode') {
      // 浏览器自己打不开的 HEIC（iPhone 截图、照片）用 WebAssembly 解码器
      const bitmap = await createImageBitmap(d.file).catch(() => import('../../lib/image/decode').then((m) => m.decode(d.file)));
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import('jsqr');
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      if (!code) throw new Error('没找到二维码，请换清晰、完整的图片，或裁掉多余背景');
      self.postMessage({ text: code.data });
      return;
    }
    validColors(d.dark, d.light);
    if (!d.text.trim()) throw new Error('请输入文字、网址或 Wi-Fi 信息');
    const { default: QR } = await import('qrcode');
    const qr = QR.create(d.text, { errorCorrectionLevel: d.logo ? 'H' : d.level });
    const margin = 4,
      scale = 8,
      n = qr.modules.size,
      size = (n + margin * 2) * scale;
    const canvas = new OffscreenCanvas(size, size),
      ctx = canvas.getContext('2d')!;
    ctx.fillStyle = d.light;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = d.dark;
    let path = '';
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (qr.modules.get(y, x)) {
          ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
          path += `M${x + margin} ${y + margin}h1v1h-1z`;
        }
    let logoSvg = '';
    if (d.logo) {
      const bitmap = await createImageBitmap(d.logo);
      const square = Math.round(size * 0.18),
        pad = Math.round(size * 0.02),
        start = (size - square) / 2;
      ctx.fillStyle = d.light;
      ctx.fillRect(start - pad, start - pad, square + 2 * pad, square + 2 * pad);
      const ratio = Math.min(square / bitmap.width, square / bitmap.height),
        w = bitmap.width * ratio,
        h = bitmap.height * ratio;
      ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
      const lc = new OffscreenCanvas(square, square);
      const lctx = lc.getContext('2d')!;
      lctx.fillStyle = d.light;
      lctx.fillRect(0, 0, square, square);
      lctx.drawImage(bitmap, (square - w) / 2, (square - h) / 2, w, h);
      bitmap.close();
      const blob = await lc.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      logoSvg = `<rect x="${(start - pad) / scale}" y="${(start - pad) / scale}" width="${(square + 2 * pad) / scale}" height="${(square + 2 * pad) / scale}" fill="${d.light}"/><image x="${start / scale}" y="${start / scale}" width="${square / scale}" height="${square / scale}" href="data:image/png;base64,${btoa(binary)}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${d.light}"/><path d="${path}" fill="${d.dark}"/>${logoSvg}</svg>`;
    self.postMessage({ svg, png: await canvas.convertToBlob({ type: 'image/png' }) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message || '二维码处理失败，请检查输入后重试' });
  }
};

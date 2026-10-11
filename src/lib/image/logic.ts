export function dimensions(w: number, h: number, mode: string, width: number, height: number, percent: number, keep: boolean) {
  if (![w, h, width, height, percent].every((v) => Number.isFinite(v) && v > 0)) throw new Error('尺寸必须大于 0');
  const scale = mode === 'percent' ? percent / 100 : mode === 'long' ? width / Math.max(w, h) : Math.min(width / w, height / h);
  const result = mode === 'box' && !keep ? [width, height] : [w * scale, h * scale];
  const [ow, oh] = result.map((v) => Math.max(1, Math.round(v)));
  if (ow * oh > 80_000_000 || ow > 32767 || oh > 32767) throw new Error('输出图片太大，请减小尺寸（最多 8000 万像素）');
  return { width: ow, height: oh };
}
export function bmpBytes(data: Uint8ClampedArray, width: number, height: number) {
  const stride = Math.ceil((width * 3) / 4) * 4,
    out = new Uint8Array(54 + stride * height),
    v = new DataView(out.buffer);
  out.set([66, 77]);
  v.setUint32(2, out.length, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = (y * width + x) * 4,
        b = 54 + (height - 1 - y) * stride + x * 3;
      out[b] = data[a + 2];
      out[b + 1] = data[a + 1];
      out[b + 2] = data[a];
    }
  return out;
}
export function stripMetadata(b: Uint8Array): { bytes: Uint8Array; extension: string } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength),
    parts: Uint8Array[] = [];
  if (b[0] === 255 && b[1] === 216) {
    parts.push(b.slice(0, 2));
    let p = 2;
    while (p < b.length) {
      if (b[p] !== 255) throw new Error('JPEG 结构损坏');
      const marker = b[p + 1];
      if (marker === 218 || marker === 217) {
        parts.push(b.slice(p));
        break;
      }
      if (p + 4 > b.length) throw new Error('JPEG 不完整');
      const len = v.getUint16(p + 2) + 2;
      if (len < 4 || p + len > b.length) throw new Error('JPEG 不完整');
      const icc = marker === 226 && String.fromCharCode(...b.slice(p + 4, p + 16)) === 'ICC_PROFILE\0';
      if (!((marker >= 225 && marker <= 237 && !icc) || marker === 239 || marker === 254)) parts.push(b.slice(p, p + len));
      p += len;
    }
    return { bytes: join(parts), extension: 'jpg' };
  }
  if (b[0] === 137 && String.fromCharCode(...b.slice(1, 4)) === 'PNG') {
    parts.push(b.slice(0, 8));
    let p = 8;
    while (p + 12 <= b.length) {
      const len = v.getUint32(p) + 12;
      if (p + len > b.length) throw new Error('PNG 不完整');
      const type = String.fromCharCode(...b.slice(p + 4, p + 8));
      if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) parts.push(b.slice(p, p + len));
      p += len;
    }
    if (p !== b.length) throw new Error('PNG 结构损坏');
    return { bytes: join(parts), extension: 'png' };
  }
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    parts.push(b.slice(0, 12));
    let p = 12;
    while (p + 8 <= b.length) {
      const len = v.getUint32(p + 4, true),
        end = p + 8 + len + (len % 2);
      if (end > b.length) throw new Error('WebP 不完整');
      const type = String.fromCharCode(...b.slice(p, p + 4));
      if (!['EXIF', 'XMP '].includes(type)) {
        const part = b.slice(p, end);
        if (type === 'VP8X') part[8] &= ~12;
        parts.push(part);
      }
      p = end;
    }
    if (p !== b.length) throw new Error('WebP 结构损坏');
    const out = join(parts);
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return { bytes: out, extension: 'webp' };
  }
  throw new Error('只支持 JPEG、PNG、WebP，其他格式请先转换');
}
function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}
export function preserveOrientation(bytes: Uint8Array, extension: string, orientation: number): Uint8Array {
  if (!Number.isInteger(orientation) || orientation < 2 || orientation > 8) return bytes;
  const tiff = new Uint8Array([73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]);
  if (extension === 'jpg') {
    const segment = new Uint8Array(10 + tiff.length);
    segment.set([255, 225, 0, segment.length - 2, 69, 120, 105, 102, 0, 0]);
    segment.set(tiff, 10);
    return join([bytes.slice(0, 2), segment, bytes.slice(2)]);
  }
  if (extension === 'png') {
    const chunk = new Uint8Array(tiff.length + 12);
    const v = new DataView(chunk.buffer);
    v.setUint32(0, tiff.length);
    chunk.set([101, 88, 73, 102], 4);
    chunk.set(tiff, 8);
    let crc = 0xffffffff;
    for (const b of chunk.slice(4, -4)) {
      crc ^= b;
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    v.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
    return join([bytes.slice(0, 33), chunk, bytes.slice(33)]);
  }
  if (extension === 'webp') {
    const chunk = new Uint8Array(8 + tiff.length);
    chunk.set([69, 88, 73, 70]);
    new DataView(chunk.buffer).setUint32(4, tiff.length, true);
    chunk.set(tiff, 8);
    const out = join([bytes, chunk]);
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    if (String.fromCharCode(...out.slice(12, 16)) === 'VP8X') out[20] |= 8;
    return out;
  }
  return bytes;
}

// 不解码图片、直接改文件结构：读 JPEG 方向、搬运或去掉 EXIF、去掉 PNG 的文本块

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

export function sniffType(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'image/png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (/^(hei|hev|mif1|msf1)/.test(brand)) return 'image/heic';
  }
  if (ascii(b, 0, 3) === 'GIF') return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return '';
}

interface Seg {
  marker: number;
  start: number;
  end: number;
}

// SOS 之前的所有段；SOS 之后是压缩数据，原样保留
function segments(b: Uint8Array): { segs: Seg[]; sos: number } {
  const segs: Seg[] = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xda) return { segs, sos: i };
    const len = (b[i + 2] << 8) | b[i + 3];
    segs.push({ marker, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  return { segs, sos: i };
}

const isExif = (b: Uint8Array, s: Seg) => s.marker === 0xe1 && ascii(b, s.start + 4, 6) === 'Exif\0\0';

// 返回 Orientation 值在整个文件里的位置，没有就是 -1
function orientationAt(b: Uint8Array, s: Seg): number {
  const tiff = s.start + 10;
  if (tiff + 8 > s.end) return -1;
  const le = ascii(b, tiff, 2) === 'II';
  const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) =>
    le
      ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
      : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > s.end) return -1;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > s.end) break;
    if (u16(e) === 0x0112) return e + 8;
  }
  return -1;
}

export function jpegOrientation(b: Uint8Array): number {
  const s = segments(b).segs.find((x) => isExif(b, x));
  if (!s) return 1;
  const at = orientationAt(b, s);
  if (at < 0) return 1;
  const le = ascii(b, s.start + 10, 2) === 'II';
  return le ? b[at] : b[at + 1];
}

// 复制原图的 EXIF 段，并把方向改成 1（像素已经按方向转正了）
export function jpegExifSegment(b: Uint8Array): Uint8Array | null {
  const s = segments(b).segs.find((x) => isExif(b, x));
  if (!s) return null;
  const seg = b.slice(s.start, s.end);
  const at = orientationAt(b, s);
  if (at >= 0) {
    const le = ascii(b, s.start + 10, 2) === 'II';
    const o = at - s.start;
    seg[o] = le ? 1 : 0;
    seg[o + 1] = le ? 0 : 1;
  }
  return seg;
}

// 把 EXIF 段插在 SOI（以及 JFIF 头）后面
export function jpegInsert(out: Uint8Array, seg: Uint8Array): Uint8Array {
  const first = segments(out).segs[0];
  const at = first && first.marker === 0xe0 ? first.end : 2;
  const res = new Uint8Array(out.length + seg.length);
  res.set(out.subarray(0, at), 0);
  res.set(seg, at);
  res.set(out.subarray(at), at + seg.length);
  return res;
}

// 去掉 EXIF、XMP、IPTC 和注释；保留色彩配置（APP2）和 Adobe 段（APP14，影响 CMYK 颜色）
export function jpegStripMeta(b: Uint8Array): Uint8Array {
  const { segs, sos } = segments(b);
  const keep = segs.filter((s) => s.marker !== 0xe1 && s.marker !== 0xed && s.marker !== 0xfe);
  const parts = [b.subarray(0, 2), ...keep.map((s) => b.subarray(s.start, s.end)), b.subarray(sos)];
  const res = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    res.set(p, o);
    o += p.length;
  }
  return res;
}

// 去掉 PNG 里的文本、EXIF 和时间块
export function pngStripMeta(b: Uint8Array): Uint8Array {
  const drop = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (!drop.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  const res = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    res.set(p, o);
    o += p.length;
  }
  return res;
}

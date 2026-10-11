// 认出动图：GIF 有不止一帧、PNG 带 acTL（APNG）、WebP 带动画标记。只读文件头和块结构，不解码像素
export async function isAnimated(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
  if (ascii(head, 0, 4) === 'GIF8') return gifFrames(new Uint8Array(await file.arrayBuffer())) > 1;
  if (head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') return apng(new Uint8Array(await file.slice(0, 1 << 20).arrayBuffer()));
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return webp(new Uint8Array(await file.slice(0, 1 << 16).arrayBuffer()));
  return false;
}

// 数到第二帧就停
export function gifFrames(b: Uint8Array): number {
  if (b.length < 13) return 0;
  let p = 13;
  if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1));
  const skipSubBlocks = () => {
    while (p < b.length && b[p] !== 0) p += b[p] + 1;
    p++;
  };
  let frames = 0;
  while (p < b.length) {
    const kind = b[p];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      p += 2;
      skipSubBlocks();
    } else if (kind === 0x2c) {
      if (++frames > 1) return frames;
      const flags = b[p + 9];
      p += 10;
      if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
      p++; // LZW 最小码长
      skipSubBlocks();
    } else break;
  }
  return frames;
}

// APNG：acTL 出现在第一个 IDAT 之前，且帧数大于 1
export function apng(b: Uint8Array): boolean {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  while (p + 8 <= b.length) {
    const size = view.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (type === 'IDAT' || type === 'IEND') return false;
    if (type === 'acTL') return p + 12 <= b.length && view.getUint32(p + 8) > 1;
    p += 12 + size;
  }
  return false;
}

// WebP：扩展格式 VP8X 的动画标记位，或者直接出现 ANIM/ANMF 块
export function webp(b: Uint8Array): boolean {
  let p = 12;
  while (p + 8 <= b.length) {
    const type = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    const size = b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16) | (b[p + 7] << 24);
    if (type === 'VP8X') return !!(b[p + 8] & 0x02);
    if (type === 'ANIM' || type === 'ANMF') return true;
    if (type === 'VP8 ' || type === 'VP8L') return false;
    p += 8 + size + (size & 1);
  }
  return false;
}

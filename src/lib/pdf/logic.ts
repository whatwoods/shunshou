import type { PdfSettings } from './types';

export function pageGroups(count: number, mode: PdfSettings['split'], ranges: string, every: number): number[][] {
  if (!Number.isInteger(count) || count < 1) throw new Error('文档没有可用页面');
  if (mode !== 'ranges') {
    const step = mode === 'each' ? 1 : every;
    if (!Number.isInteger(step) || step < 1) throw new Error('每份页数需要是大于 0 的整数');
    return Array.from({ length: Math.ceil(count / step) }, (_, n) =>
      Array.from({ length: Math.min(step, count - n * step) }, (_, i) => n * step + i)
    );
  }
  if (!ranges.trim()) return [Array.from({ length: count }, (_, i) => i)];
  return ranges
    .replace(/，/g, ',')
    .replace(/；/g, ';')
    .split(';')
    .map((part) => {
      if (!part.trim()) throw new Error('分组不能为空，请用分号分隔各份 PDF');
      const pages: number[] = [];
      for (const token of part.split(',')) {
        const m = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) throw new Error('页码格式不对，例如 1-3,5;6-8');
        const first = Number(m[1]),
          last = Number(m[2] || m[1]);
        if (first < 1 || last > count || last < first) throw new Error(`页码必须在 1–${count} 内，范围从小到大填写`);
        for (let page = first; page <= last; page++) if (!pages.includes(page - 1)) pages.push(page - 1);
      }
      return pages;
    });
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items;
  const result = [...items];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}
export function fitPage(width: number, height: number, pageWidth: number, pageHeight: number, margin: number) {
  if (
    ![width, height, pageWidth, pageHeight].every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin * 2 >= Math.min(pageWidth, pageHeight)
  )
    throw new Error('页面尺寸或边距无效');
  const ratio = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
  const w = width * ratio,
    h = height * ratio;
  return { x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, width: w, height: h };
}
export function pageNumberText(index: number, total: number, settings: Pick<PdfSettings, 'start' | 'skipCover' | 'numberStyle'>) {
  if (settings.skipCover && index === 0) return '';
  const num = index + settings.start - (settings.skipCover ? 1 : 0);
  return settings.numberStyle === 'chinese'
    ? `第 ${num} 页`
    : settings.numberStyle === 'total'
      ? `${num} of ${total - (settings.skipCover ? 1 : 0)}`
      : String(num);
}

// JPEG 的 EXIF 方向（1–8，没有就是 1）：和图片压缩共用一份解析
export { jpegOrientation } from '../../tools/image-compress/fileMeta';

// 按 EXIF 方向把原始像素画进页面上 box 这个（已经按转正后的宽高算好的）位置：
// 返回 pdf-lib drawImage 的参数。只处理旋转（3、6、8）；带镜像的 2、4、5、7 交给调用方先转正像素
export function orientedDraw(orientation: number, box: { x: number; y: number; width: number; height: number }) {
  if (orientation === 3) return { x: box.x + box.width, y: box.y + box.height, width: box.width, height: box.height, rotate: 180 };
  // 原图要顺时针转 90° 才是正的：以左上角为锚点顺时针画
  if (orientation === 6) return { x: box.x, y: box.y + box.height, width: box.height, height: box.width, rotate: -90 };
  // 原图要逆时针转 90°：以右下角为锚点逆时针画
  if (orientation === 8) return { x: box.x + box.width, y: box.y, width: box.height, height: box.width, rotate: 90 };
  return { ...box, rotate: 0 };
}

// 页面真正可见的区域：裁剪框和媒体框的交集（和 PDF.js、阅读器一致）。坐标反着写的先摆正；
// 两个框不相交时裁剪框无效，退回媒体框
type Rect = { x: number; y: number; width: number; height: number };
export function visibleBox(media: Rect, crop: Rect): Rect {
  const norm = (r: Rect) => ({
    left: Math.min(r.x, r.x + r.width),
    right: Math.max(r.x, r.x + r.width),
    bottom: Math.min(r.y, r.y + r.height),
    top: Math.max(r.y, r.y + r.height)
  });
  const m = norm(media),
    c = norm(crop);
  const left = Math.max(m.left, c.left),
    right = Math.min(m.right, c.right),
    bottom = Math.max(m.bottom, c.bottom),
    top = Math.min(m.top, c.top);
  if (right <= left || top <= bottom) return { x: m.left, y: m.bottom, width: m.right - m.left, height: m.top - m.bottom };
  return { x: left, y: bottom, width: right - left, height: top - bottom };
}

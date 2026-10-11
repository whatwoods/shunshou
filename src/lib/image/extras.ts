export interface StitchSettings {
  direction: 'vertical' | 'horizontal';
  size: number;
  gap: number;
  format: 'png' | 'jpeg';
  background: 'white' | 'black' | 'transparent';
}
export const stitchDefaults: StitchSettings = { direction: 'vertical', size: 1080, gap: 0, format: 'png', background: 'white' };
export function stitchLayout(sizes: { width: number; height: number }[], s: StitchSettings) {
  if (!sizes.length) throw new Error('请先添加图片');
  if (!Number.isInteger(s.size) || s.size < 1 || s.size > 8192 || !Number.isInteger(s.gap) || s.gap < 0 || s.gap > 500)
    throw new Error('统一尺寸需在 1–8192 像素，间距在 0–500 像素');
  let cursor = 0;
  const boxes = sizes.map(({ width, height }) => {
    if (width <= 0 || height <= 0) throw new Error('图片尺寸无效');
    const w = s.direction === 'vertical' ? s.size : Math.max(1, Math.round((width * s.size) / height)),
      h = s.direction === 'horizontal' ? s.size : Math.max(1, Math.round((height * s.size) / width));
    const box = { x: s.direction === 'horizontal' ? cursor : 0, y: s.direction === 'vertical' ? cursor : 0, width: w, height: h };
    cursor += (s.direction === 'vertical' ? h : w) + s.gap;
    return box;
  });
  const width = s.direction === 'vertical' ? s.size : cursor - s.gap,
    height = s.direction === 'horizontal' ? s.size : cursor - s.gap;
  if (width > 32767 || height > 32767 || width * height > 80_000_000) throw new Error('拼接结果太大，请减小统一尺寸或减少图片');
  return { width, height, boxes };
}
export function colorValues(rgb: number[]) {
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  return {
    hex:
      '#' +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    rgb: `rgb(${r}, ${g}, ${b})`
  };
}

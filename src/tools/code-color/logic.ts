import {
  parse,
  converter,
  formatHex,
  formatHex8,
  formatRgb,
  formatHsl,
  formatCss,
  clampRgb,
  displayable,
  wcagContrast,
  type Rgb
} from 'culori';
const rgb = converter('rgb');
const oklch = converter('oklch');
export function colorInfo(input: string) {
  const parsed = parse(input.trim());
  if (!parsed) throw new Error('无法识别这个颜色，请输入 HEX、RGB、HSL 或 OKLCH 色值');
  const converted = rgb(parsed);
  if (![converted.r, converted.g, converted.b, converted.alpha ?? 1].every(Number.isFinite)) throw new Error('颜色分量必须是有效数字');
  const clipped = rgb(clampRgb(parsed));
  const hex = (clipped.alpha ?? 1) < 1 ? formatHex8(clipped) : formatHex(clipped);
  const perceptual = oklch(parsed);
  const rounded = {
    ...perceptual,
    l: Number(perceptual.l.toFixed(5)),
    c: Number(perceptual.c.toFixed(5)),
    h: Number((perceptual.h ?? 0).toFixed(3))
  };
  return {
    hex,
    picker: formatHex(clipped),
    rgb: formatRgb(clipped),
    hsl: formatHsl(clipped),
    oklch: formatCss(rounded),
    clipped: !displayable(parsed),
    color: clipped,
    perceptual
  };
}
export function contrastInfo(foreground: string, background: string) {
  const fg = colorInfo(foreground).color;
  const bg = colorInfo(background).color;
  if ((bg.alpha ?? 1) < 1) throw new Error('对比背景需要不透明的颜色，请去掉背景透明度');
  const alpha = fg.alpha ?? 1;
  const composite: Rgb = {
    mode: 'rgb',
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha)
  };
  const ratio = wcagContrast(composite, bg);
  return { ratio, aa: ratio >= 4.5, aaa: ratio >= 7, large: ratio >= 3, foreground: formatRgb(composite), background: formatRgb(bg) };
}
export function makePalette(input: string, kind: 'shades' | 'analogous' | 'complementary') {
  const source = colorInfo(input).perceptual;
  return Array.from({ length: 5 }, (_, i) => {
    const color =
      kind === 'shades'
        ? { ...source, l: 0.22 + i * 0.16, alpha: 1 }
        : { ...source, h: ((source.h ?? 0) + (kind === 'analogous' ? (i - 2) * 25 : [0, 15, 180, 195, 345][i]) + 360) % 360, alpha: 1 };
    return formatHex(clampRgb(color));
  });
}

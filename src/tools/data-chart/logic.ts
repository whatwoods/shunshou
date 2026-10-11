import type { ChartPoint, ChartType } from '../../lib/dataCore';
export interface ChartStyle {
  ink: string;
  muted: string;
  line: string;
  background: string;
  palette: string[];
}
export const xml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);
const nice = (n: number) => (Math.abs(n) >= 10000 ? n.toExponential(1) : String(Number(n.toPrecision(4))));
// 横轴标签：日期（10 个字）要完整显示，太长的才截断加省略号
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function renderChart(points: ChartPoint[], type: ChartType, title: string, style: ChartStyle): string {
  const w = 960,
    h = 560,
    left = 95,
    right = 920,
    top = 85,
    bottom = 465;
  const text = (x: number, y: number, content: string, extra = '') =>
    `<text x="${x}" y="${y}" fill="${xml(style.ink)}" font-size="14" ${extra}>${xml(content)}</text>`;
  let content = `<rect width="${w}" height="${h}" fill="${xml(style.background)}"/>${text(40, 42, title || '数据图表', 'style="font-size:24px" font-weight="600"')}`;
  const visible = type === 'bar' ? points.slice(0, 100) : points;
  if (!visible.length) content += text(w / 2, h / 2, '选一个含数字的数值列', 'text-anchor="middle"');
  else if (type === 'pie') {
    const positive = visible.filter((p) => p.y > 0);
    const slices =
      positive.length > 12
        ? [...positive.slice(0, 11), { label: '其他', x: 0, y: positive.slice(11).reduce((n, p) => n + p.y, 0) }]
        : positive;
    const total = slices.reduce((n, p) => n + p.y, 0);
    let angle = -Math.PI / 2;
    if (!total) content += text(480, 280, '饼图需要大于 0 的数值', 'text-anchor="middle"');
    slices.forEach((point, i) => {
      const delta = (point.y / total) * Math.PI * 2,
        end = angle + delta;
      const cx = 325,
        cy = 292,
        radius = 180,
        color = xml(style.palette[i % style.palette.length]);
      if (slices.length === 1) content += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}"/>`;
      else
        content += `<path d="M${cx},${cy} L${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius} A${radius},${radius} 0 ${delta > Math.PI ? 1 : 0} 1 ${cx + Math.cos(end) * radius},${cy + Math.sin(end) * radius} Z" fill="${color}" stroke="${xml(style.background)}" stroke-width="2"/>`;
      const y = 105 + i * 32;
      content += `<rect x="575" y="${y - 12}" width="14" height="14" rx="3" fill="${color}"/>${text(600, y, `${point.label.slice(0, 19)} · ${((point.y / total) * 100).toFixed(1)}%`)}`;
      angle = end;
    });
  } else {
    let minY = Math.min(0, ...visible.map((p) => p.y)),
      maxY = Math.max(0, ...visible.map((p) => p.y));
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    const minX = Math.min(...visible.map((p) => p.x)),
      maxX = Math.max(...visible.map((p) => p.x));
    const y = (v: number) => bottom - ((v - minY) / (maxY - minY)) * (bottom - top);
    const x = (p: ChartPoint, i: number) =>
      type === 'scatter'
        ? left + ((p.x - minX) / (maxX - minX || 1)) * (right - left)
        : left + ((i + 0.5) / visible.length) * (right - left);
    for (let i = 0; i <= 5; i++) {
      const v = minY + ((maxY - minY) * i) / 5,
        yy = y(v);
      content += `<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="${xml(style.line)}"/>${text(left - 12, yy + 5, nice(v), 'text-anchor="end"')}`;
    }
    const labelStep = Math.max(1, Math.ceil(visible.length / 8));
    visible.forEach((p, i) => {
      if (i % labelStep === 0 && type !== 'scatter') content += text(x(p, i), bottom + 30, short(p.label, 12), 'text-anchor="middle"');
      if (type === 'bar') {
        const width = ((right - left) / visible.length) * 0.7;
        content += `<rect x="${x(p, i) - width / 2}" y="${Math.min(y(0), y(p.y))}" width="${width}" height="${Math.max(1, Math.abs(y(p.y) - y(0)))}" rx="3" fill="${xml(style.palette[0])}"><title>${xml(p.label)}: ${p.y}</title></rect>`;
      } else if (type === 'scatter')
        content += `<circle cx="${x(p, i)}" cy="${y(p.y)}" r="4" fill="${xml(style.palette[0])}" opacity="0.75"><title>${xml(p.label)}: ${p.y}</title></circle>`;
    });
    if (type === 'scatter')
      for (let i = 0; i <= 5; i++)
        content += text(left + (i / 5) * (right - left), bottom + 30, nice(minX + ((maxX - minX) * i) / 5), 'text-anchor="middle"');
    if (type === 'line')
      content += `<polyline points="${visible.map((p, i) => `${x(p, i)},${y(p.y)}`).join(' ')}" fill="none" stroke="${xml(style.palette[0])}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560" role="img" aria-label="${xml(title || '数据图表')}" font-family="system-ui, sans-serif"><title>${xml(title || '数据图表')}</title>${content}</svg>`;
}

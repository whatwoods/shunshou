import { expect, it } from 'vitest';
import { chartPoints, numericColumns, recommendChart } from '../../lib/dataCore';
import { renderChart } from './logic';
const style = {
  ink: 'var(--ink)',
  muted: 'var(--ink-2)',
  line: 'var(--divider)',
  background: 'var(--surface)',
  palette: ['var(--accent)']
};
it('图表数据跳过空值与非数字，识别日期折线', () => {
  const data = {
    columns: ['date', 'value'],
    rows: [
      ['2026-01-01', 0],
      ['2026-01-02', ''],
      ['2026-01-03', 'bad']
    ]
  };
  expect(chartPoints(data, 0, 1)).toEqual([{ label: '2026-01-01', x: 0, y: 0 }]);
  expect(recommendChart(data)).toBe('line');
});
it('SVG 转义标题标签，负值柱状图与单项饼图有效', () => {
  const points = [
    { label: '<script>alert(1)</script>', x: 0, y: -5 },
    { label: 'b', x: 1, y: 10 }
  ];
  for (const type of ['bar', 'line', 'scatter', 'pie'] as const) {
    const svg = renderChart(points, type, 'a&b', style);
    expect(svg).toContain('a&amp;b');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toMatch(/NaN|Infinity/);
  }
  expect(renderChart([{ label: 'a', x: 0, y: 1 }], 'pie', '', style)).toContain('<circle');
});
it('数值轴默认找数字列，跳过文字列', () => {
  const data = {
    columns: ['日期', '城市', '销量', '备注'],
    rows: [
      ['2026-09-01', '上海', '32', ''],
      ['2026-09-02', '北京', '18', '缺货'],
      ['2026-09-03', '杭州', '', '']
    ]
  };
  expect(numericColumns(data)).toEqual([2]);
});

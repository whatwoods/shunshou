import { expect, test } from 'vitest';
import { KINDS, kindOf, matchFiles, type Kind } from './match';
import { timeAgo } from './store';
import { POPULAR, TOOLS, toolById } from '../tools';

const file = (name: string, type = '') => new File(['x'], name, { type });

test('按扩展名认文件，没有扩展名时看 MIME', () => {
  const cases: [File, Kind][] = [
    [file('IMG_0001.HEIC'), 'image'],
    [file('logo.svg'), 'svg'],
    [file('合同.pdf'), 'pdf'],
    [file('clip.MOV'), 'video'],
    [file('voice.m4a'), 'audio'],
    [file('报表.xlsx'), 'sheet'],
    [file('orders.csv'), 'table'],
    [file('page.htm'), 'html'],
    [file('README.md'), 'markdown'],
    [file('query.sql'), 'code'],
    [file('notes.txt'), 'text'],
    [file('blob', 'image/png'), 'image'],
    [file('blob', 'text/html'), 'html'],
    [file('archive.zip'), 'other']
  ];
  for (const [f, kind] of cases) expect(kindOf(f), f.name).toBe(kind);
});

test('推荐里的工具都真实存在、已上线，并且列表里没有重复', () => {
  for (const [kind, info] of Object.entries(KINDS)) {
    expect(new Set(info.tools).size, kind).toBe(info.tools.length);
    for (const id of info.tools) expect(toolById(id)?.ready, `${kind} → ${id}`).toBe(true);
  }
  for (const id of POPULAR) expect(toolById(id)?.ready, id).toBe(true);
});

test('照片和 PDF 一起拖进来，首先建议合成一份', () => {
  const files = [file('a.jpg'), file('b.heic'), file('c.pdf'), file('d.txt')];
  const { combo, groups } = matchFiles(files);
  expect(combo?.tool.id).toBe('pdf-merge');
  expect(combo?.files.map((f) => f.name)).toEqual(['a.jpg', 'b.heic', 'c.pdf']);
  expect(groups.map((g) => g.kind)).toEqual(['image', 'pdf', 'text']);
  expect(groups[0].title).toBe('2 张图片可以');
});

test('多张图片建议做成 PDF；单个文件不给组合建议', () => {
  expect(matchFiles([file('a.png'), file('b.png')]).combo?.tool.id).toBe('pdf-from-image');
  expect(matchFiles([file('a.png')]).combo).toBeNull();
  expect(matchFiles([file('a.pdf'), file('b.pdf')]).combo?.title).toBe('把 2 份 PDF 合成一份');
});

test('“接着用”不再推荐当前工具', () => {
  const { groups, combo } = matchFiles([file('a.pdf'), file('b.pdf')], 'pdf-merge');
  expect(combo).toBeNull();
  expect(groups[0].tools.some((t) => t.id === 'pdf-merge')).toBe(false);
});

test('工具按分类顺序排列：办公、PDF、图像、视频、开发、数据', () => {
  const order = [...new Set(TOOLS.map((t) => t.cat))];
  expect(order).toEqual(['office', 'pdf', 'image', 'av', 'code', 'data']);
});

test('相对时间', () => {
  const now = new Date(2026, 9, 14, 12, 0).getTime(); // 周三中午
  const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m).getTime();
  expect(timeAgo(undefined, now)).toBe('');
  expect(timeAgo(now - 20_000, now)).toBe('刚刚');
  expect(timeAgo(at(14, 11, 35), now)).toBe('25 分钟前');
  expect(timeAgo(at(14, 8), now)).toBe('4 小时前');
  expect(timeAgo(at(13, 23), now)).toBe('昨天');
  expect(timeAgo(at(11), now)).toBe('周日');
  expect(timeAgo(at(6), now)).toBe('10 月 6 日');
});

test('TIFF 多数浏览器打不开，不推荐图片工具', () => {
  expect(kindOf(file('scan.tiff'))).toBe('other');
  expect(kindOf(new File(['x'], 'scan', { type: 'image/tiff' }))).toBe('other');
  expect(kindOf(file('photo.heic'))).toBe('image');
});

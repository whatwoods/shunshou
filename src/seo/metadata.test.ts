import { describe, expect, it } from 'vitest';
import { TOOLS } from '../tools';
import { GUIDES } from './ToolGuide';
import { absoluteUrl, indexablePaths, pageMetadata, serializeSchema } from './metadata';
import { renderAssets, renderPage } from './render';

const template =
  '<html><head><title>默认标题</title><meta name="description" content="默认描述"></head><body><div id="root"></div></body></html>';

describe('公开内容与索引范围', () => {
  it('每个已上线工具都有经过整理的说明和有效关联', () => {
    for (const tool of TOOLS.filter((t) => t.ready)) {
      const guide = GUIDES[tool.id];
      expect(guide, tool.id).toBeDefined();
      expect(guide.summary.length).toBeGreaterThan(20);
      expect(guide.steps).toHaveLength(3);
      expect(guide.tips.length).toBeGreaterThan(0);
      for (const id of guide.related)
        expect(
          TOOLS.some((t) => t.id === id && t.ready),
          `${tool.id} → ${id}`
        ).toBe(true);
    }
  });

  it('公开路径唯一，排除隔离页、404 和未上线工具', () => {
    const paths = indexablePaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).not.toContain('/html-preview-frame');
    expect(paths).not.toContain('/404');
    for (const t of TOOLS) expect(paths.includes(t.path)).toBe(t.ready);
    expect(pageMetadata('/does-not-exist').indexable).toBe(false);
    expect(pageMetadata('/image/compress/').path).toBe('/image/compress');
  });

  it('所有页面首次响应都有独立标题、描述、canonical 和可见正文', () => {
    const titles = new Set<string>();
    for (const path of indexablePaths()) {
      const meta = pageMetadata(path);
      const html = renderPage(template, path);
      expect(html).toContain(`<link rel="canonical" href="${absoluteUrl(path)}">`);
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(meta.schema['@graph']).not.toEqual([]);
      const guide = GUIDES[TOOLS.find((t) => t.path === path)?.id ?? ''];
      if (guide) expect(html).toContain(guide.summary);
      expect(titles.has(meta.title), meta.title).toBe(false);
      titles.add(meta.title);
    }
  });

  it('站点地图和纯文本目录使用相同已上线清单', () => {
    const { files, routes } = renderAssets(template);
    for (const path of indexablePaths()) {
      expect(files['sitemap.xml']).toContain(`<loc>${absoluteUrl(path)}</loc>`);
      expect(routes).toContain(path);
      expect(files[path === '/' ? 'index.html' : `${path.slice(1)}.html`]).toBeDefined();
    }
    expect(files['sitemap.xml']).not.toContain('<lastmod>');
    expect(files['robots.txt']).toContain(`Sitemap: ${absoluteUrl('/sitemap.xml')}`);
    expect(files['404.html']).toContain('noindex, follow');
    for (const tool of TOOLS.filter((t) => t.ready)) expect(files['llms.txt']).toContain(absoluteUrl(tool.path));
  });

  it('JSON-LD 中的文案不能结束 script 标签', () => {
    const value = { text: '</script><script>alert(1)</script>\u2028' };
    const serialized = serializeSchema(value);
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual(value);
  });
});

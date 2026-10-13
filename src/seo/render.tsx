import { renderToStaticMarkup } from 'react-dom/server';
import { CATEGORIES, TOOLS, toolByPath } from '../tools';
import { LicenseContent } from '../pages/Licenses';
import { ContentBody, Directory, SiteLinks } from './Content';
import ToolGuide, { GUIDES } from './ToolGuide';
import {
  absoluteUrl,
  categoryByPath,
  HOME_DESCRIPTION,
  indexablePaths,
  metaTags,
  pageMetadata,
  serializeSchema,
  toolTitle
} from './metadata';

function StaticPage({ path }: { path: string }) {
  const tool = toolByPath(path);
  const page = pageMetadata(path);
  return (
    <div className="tool-page seo-static">
      <nav className="seo-static-nav" aria-label="主导航">
        <a href="/">顺手</a>
        {CATEGORIES.map((c) => (
          <a key={c.id} href={`/${c.id}`}>
            {c.name}
          </a>
        ))}
      </nav>
      {path === '/licenses' ? (
        <LicenseContent />
      ) : (
        <main className="tool-main seo-page">
          {path === '/' ? (
            <>
              <h1>顺手的小工具，全在浏览器里。</h1>
              <p>{HOME_DESCRIPTION}</p>
              <Directory />
              <SiteLinks />
            </>
          ) : tool ? (
            <>
              <p className="crumb">
                <a href={`/${tool.cat}`}>{CATEGORIES.find((c) => c.id === tool.cat)!.name}</a>
              </p>
              <h1>{tool.name}</h1>
              <p>{tool.desc} · 0 B 上传</p>
              <noscript>使用交互工具需要启用 JavaScript。以下说明和相关工具链接仍可阅读。</noscript>
              {!tool.ready && <p>这个工具还在准备中。</p>}
            </>
          ) : categoryByPath(path) || path === '/about' || path === '/privacy' ? (
            <ContentBody path={path} />
          ) : (
            <>
              <h1>这个页面不存在。</h1>
              <p>{page.description}</p>
              <a href="/">查看全部工具</a>
            </>
          )}
        </main>
      )}
      {tool && <ToolGuide tool={tool} />}
      <footer className="tool-foot">顺手 · 把小事做顺手</footer>
    </div>
  );
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function renderPage(template: string, path: string) {
  const page = pageMetadata(path);
  const head = [
    `<title>${escapeHtml(page.title)}</title>`,
    ...metaTags(page).map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`),
    `<link rel="canonical" href="${escapeHtml(absoluteUrl(page.path))}">`,
    `<script type="application/ld+json" id="page-schema">${serializeSchema(page.schema)}</script>`
  ].join('\n');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderToStaticMarkup(<StaticPage path={path} />)}</div>`);
}

export function renderAssets(template: string) {
  const paths = indexablePaths();
  const files: Record<string, string> = {};
  for (const path of [...paths, ...TOOLS.filter((t) => !t.ready).map((t) => t.path), '/404']) {
    files[path === '/' ? 'index.html' : `${path.slice(1)}.html`] = renderPage(template, path);
  }
  // 未掌握真实内容修改时间时省略 lastmod，避免每次构建都虚报更新。
  files['sitemap.xml'] =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${escapeHtml(absoluteUrl(path))}</loc></url>`).join('\n')}\n</urlset>\n`;
  files['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
  // 补充纯文本目录，事实来自与网页相同的数据；它不替代 HTML、站点地图或可抓取内链。
  files['llms.txt'] =
    `# 顺手\n\n> ${HOME_DESCRIPTION}\n\n## 站点说明\n\n- [关于顺手](${absoluteUrl('/about')})\n- [隐私说明](${absoluteUrl('/privacy')})\n- [开源许可](${absoluteUrl('/licenses')})\n\n${CATEGORIES.map(
      (c) =>
        `## ${c.name}\n\n${TOOLS.filter((t) => t.ready && t.cat === c.id)
          .map((t) => `- [${toolTitle(t)}](${absoluteUrl(t.path)}): ${GUIDES[t.id]?.summary || t.desc}`)
          .join('\n')}`
    ).join('\n\n')}\n`;
  return { files, routes: [...paths, ...TOOLS.filter((t) => !t.ready).map((t) => t.path)] };
}

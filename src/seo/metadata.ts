import { site } from '../site';
import { CATEGORIES, TOOLS, categoryOf, toolByPath, type CatId, type Tool } from '../tools';

export const HOME_TITLE = '顺手 · 图片、PDF、音视频、文本和数据在线工具';
export const HOME_DESCRIPTION =
  '顺手提供图片压缩、PDF 合并、视频处理、二维码、JSON 格式化和表格转换等浏览器工具。无需注册，文件在设备上处理，不上传；支持手机、深色模式与已缓存工具的离线使用。';
export const CATEGORY_DESCRIPTIONS: Record<CatId, string> = {
  office: '统计字数、对比文本、转换简繁与大小写，生成二维码和密码，预览 Markdown 与 HTML。',
  pdf: '合并、拆分、压缩 PDF，转换图片，整理页面，添加页码，提取文字和内嵌图片。',
  image: '压缩、转换、缩放和裁剪图片，去背景、拼图、加水印、去除 EXIF、提取配色与优化 SVG。',
  av: '压缩和转换音视频，截取片段、提取音频、编辑声音、制作 GIF 与导出视频画面。',
  code: '格式化 JSON 和代码，处理 Base64、URL、JWT、时间戳、正则表达式、哈希和颜色。',
  data: '查看 CSV、转换 Excel、合并工作簿、清洗表格，用 SQL 查询数据、生成图表，或生成随机数与抽签。'
};

export function siteOrigin() {
  const url = new URL(site.url);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('VITE_SITE_URL 必须是 HTTPS 站点根地址，例如 https://example.com');
  }
  return url.origin;
}

export const absoluteUrl = (path: string) => new URL(path, siteOrigin()).href;
export const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
export const categoryByPath = (path: string) => CATEGORIES.find((c) => `/${c.id}` === normalizePath(path));

// 卡片上的短名字借助分类上下文阅读；搜索标题需要单独说清处理对象。
export function toolTitle(tool: Tool) {
  if (tool.cat === 'image' && !/图片|图像|SVG|EXIF/.test(tool.name)) return `图片${tool.name}`;
  if (tool.cat === 'pdf' && !/PDF/i.test(tool.name)) return `PDF ${tool.name}`;
  if (tool.cat === 'av' && tool.id === 'av-trim') return '视频截取片段';
  return tool.name;
}

export interface PageMetadata {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
  schema: Record<string, unknown>;
}

export function pageMetadata(rawPath: string): PageMetadata {
  const path = normalizePath(rawPath);
  const tool = toolByPath(path);
  const category = categoryByPath(path);
  let title = '找不到页面 · 顺手';
  let description = '这个页面不存在。回到顺手首页，查找图片、PDF、音视频、文本、代码和数据工具。';
  let indexable = true;
  if (path === '/') {
    title = HOME_TITLE;
    description = HOME_DESCRIPTION;
  } else if (tool) {
    title = `${toolTitle(tool)}在线工具 · ${tool.desc} · 顺手`;
    description = `用顺手${toolTitle(tool)}工具，${tool.desc}。在浏览器里打开就能用，无需注册，内容在设备上处理，不上传。`;
    indexable = tool.ready;
  } else if (category) {
    title = `${category.name}在线工具 · 顺手`;
    description = `${CATEGORY_DESCRIPTIONS[category.id]}顺手${category.name}工具在浏览器里处理文件和内容，无需上传。`;
  } else if (path === '/about') {
    title = '关于顺手 · 浏览器里的实用工具箱';
    description = '了解顺手的工具分类、使用方式、浏览器兼容性和离线限制，查看源代码与问题反馈入口。';
  } else if (path === '/privacy') {
    title = '隐私说明 · 文件在设备上处理 · 顺手';
    description = '顺手不上传选中的文件或输入内容，不使用账号、统计和追踪脚本。了解本机偏好、离线缓存与静态托管请求的范围。';
  } else if (path === '/licenses') {
    title = '开源许可 · 顺手';
    description = '顺手所用第三方组件的版本、用途、开源许可全文与源代码获取方式。';
  } else indexable = false;

  const url = absoluteUrl(path);
  const website = {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    url: absoluteUrl('/'),
    name: '顺手',
    description: HOME_DESCRIPTION,
    inLanguage: 'zh-CN'
  };
  const graph: Record<string, unknown>[] = indexable
    ? [
        website,
        {
          '@type': category || path === '/' ? 'CollectionPage' : path === '/about' ? 'AboutPage' : 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: title,
          description,
          inLanguage: 'zh-CN',
          isPartOf: { '@id': website['@id'] }
        }
      ]
    : [];
  if (tool?.ready) {
    graph.push({
      '@type': 'WebApplication',
      '@id': `${url}#application`,
      name: toolTitle(tool),
      url,
      description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      browserRequirements: '需要启用 JavaScript；格式支持取决于浏览器。',
      isAccessibleForFree: true,
      inLanguage: 'zh-CN',
      featureList: tool.desc,
      mainEntityOfPage: { '@id': `${url}#webpage` }
    });
  }
  if (indexable && path !== '/') {
    const crumbs = [{ name: '顺手', item: absoluteUrl('/') }];
    if (tool) crumbs.push({ name: categoryOf(tool.cat).name, item: absoluteUrl(`/${tool.cat}`) });
    crumbs.push({ name: tool ? toolTitle(tool) : title.split(' · ')[0], item: url });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb }))
    });
  }
  if (category || path === '/') {
    const listed = TOOLS.filter((t) => t.ready && (!category || t.cat === category.id));
    graph.push({
      '@type': 'ItemList',
      '@id': `${url}#tools`,
      numberOfItems: listed.length,
      itemListElement: listed.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: toolTitle(t), url: absoluteUrl(t.path) }))
    });
  }
  return { title, description, path, indexable, schema: { '@context': 'https://schema.org', '@graph': graph } };
}

export function indexablePaths() {
  return ['/', ...CATEGORIES.map((c) => `/${c.id}`), ...TOOLS.filter((t) => t.ready).map((t) => t.path), '/about', '/privacy', '/licenses'];
}

export const robotsValue = (page: PageMetadata) =>
  page.indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow';
export const serializeSchema = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function metaTags(page: PageMetadata): [string, string, string][] {
  return [
    ['name', 'description', page.description],
    ['name', 'robots', robotsValue(page)],
    ['property', 'og:type', 'website'],
    ['property', 'og:locale', 'zh_CN'],
    ['property', 'og:site_name', '顺手'],
    ['property', 'og:title', page.title],
    ['property', 'og:description', page.description],
    ['property', 'og:url', absoluteUrl(page.path)],
    ['property', 'og:image', absoluteUrl('/og-image.png')],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', '顺手：图片、PDF、音视频、文本、代码和数据工具，文件在设备上处理'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', page.title],
    ['name', 'twitter:description', page.description],
    ['name', 'twitter:image', absoluteUrl('/og-image.png')],
    ['name', 'twitter:image:alt', '顺手 · 浏览器里的实用工具箱']
  ];
}

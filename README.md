# 顺手

顺手的小工具，全在浏览器里。图片、PDF、音视频、文本、代码和表格，打开就能用；文件只在你的设备上处理，不会上传。

**在线使用：<https://shunshou.waya.workers.dev>**

<a href="docs/media/shunshou-promo.mp4"><img src="docs/media/promo-preview.gif" alt="顺手宣传片：拖入照片自动推荐工具、压缩、转 PDF、⌘K 搜索、手机版和深色模式" width="720"></a>

▶ [看完整宣传片（51 秒，带声音）](docs/media/shunshou-promo.mp4)

整站是纯静态资源，部署在 Cloudflare Workers 的静态资源托管上，没有后端代码。

## 有什么

- **工具**：六个分类（办公文本、PDF、图像、音视频、开发编码、数据），清单在 `src/tools.ts`，每个工具一个文件夹 `src/tools/<分类>-<名字>/`。
- **拖入任意文件**：首页把文件拖进来（手机上点“打开任意文件”），自动认出类型、推荐能用的工具，点一下文件就跟着过去。
- **⌘K / Ctrl+K**：任何页面都能快速搜索工具；最近使用和收藏只存在本机。
- **离线可用**：Service Worker 缓存首页和用过的工具，断网也能打开。
- **深色模式、手机版**：手机上是单独的首页和工具页顶栏。

## 隐私是怎么保证的

- `public/_headers` 给所有页面加了内容安全策略，`connect-src 'self'`：页面只能连接本站，就算代码想把文件发出去，浏览器也会拦下。没有统计或追踪脚本，所有依赖（包括 WebAssembly 和字体）都由本站提供。
- HTML 预览在单独的隔离页（`public/html-preview-frame.html`）里运行：iframe 不给 `allow-same-origin`，隔离页另有一套禁止联网、禁止跳转的策略。

## 开发

需要 Node.js 20 以上。

```bash
npm install
```

```bash
npm run dev
```

开发服务器默认在 http://localhost:5173 。常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 类型检查 |
| `npm test` | 单元测试（vitest） |
| `npm run build` | 类型检查 + 生产构建，输出到 `dist/` |
| `npm run preview` | 用 Workers 运行时在本机跑正式构建（会应用 `_headers`） |
| `npm run format` | Prettier 统一格式 |
| `npm run promo:build` | 重新渲染宣传片（需要 ffmpeg 和 Chrome，源码在 `promo/`，成片在 `promo/out/`） |

加工具、写样式、选库的约定都在 [AGENTS.md](AGENTS.md)。简单说：新建 `src/tools/<分类>-<名字>/Page.tsx` 就会自动注册，不用改路由或清单；清单外的工具再放一个 `meta.ts`。

## 部署

### Cloudflare Workers（推荐）

第一次部署前登录：

```bash
npx wrangler login
```

构建并部署：

```bash
npm run deploy
```

Worker 的名字在 `wrangler.jsonc` 里，默认是 `shunshou`。`public/_headers` 会被自动应用。

### 其他静态托管

`dist/` 可以放到别的静态托管上，但**必须**在托管平台上配出和 `public/_headers` 等价的响应头，否则隐私和 HTML 预览隔离都会失效：

1. 所有页面：`Content-Security-Policy`（`connect-src 'self'`、`script-src 'self' 'wasm-unsafe-eval'` 等，照抄 `_headers` 第一段）、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`。
2. `/html-preview-frame` 和 `/html-preview-frame.html`：**换成**单独的那套策略（`default-src 'none'` 开头），不是在第一套上追加。
3. `/image/compress` 这类无扩展名路径读取对应的 `/image/compress.html`；带 `.html` 或尾斜杠的地址跳转到无尾斜杠版本。未知路径返回 `404.html` 和 HTTP 404，不要统一回退到首页。

部署后检查一下响应头：

```bash
curl -sI https://你的域名/ | grep -i content-security-policy
```

```bash
curl -sI https://你的域名/html-preview-frame | grep -i content-security-policy
```

第一条应包含 `connect-src 'self'`，第二条应以 `default-src 'none'` 开头。

## 自定义

`src/site.ts` 里配置仓库地址和正式站点地址。自行部署到其他域名时，在 `.env.production` 设置 `VITE_SITE_URL=https://你的域名`，再构建部署；这个值必须是 HTTPS 根地址，不带路径、查询参数或账号信息。它会同时用于 canonical、分享链接、结构化数据和站点地图。未设置时使用本项目 README 顶部的在线地址。

填上仓库地址后，页脚会出现“源代码”“提需求”，首页部署说明也会显示真实的 `git clone` 地址。

## 搜索与 AI 搜索

`npm run build` 会根据已上线工具清单生成每个工具、6 个分类、关于、隐私和许可页面的 HTML，同时生成 `sitemap.xml`、`robots.txt` 和 `llms.txt`。首次响应就包含标题、描述、规范地址、分享信息、JSON-LD、可见说明和链接；浏览器加载后继续使用原有交互工具。不同爬虫和用户收到相同的页面。

- 元信息：`src/seo/metadata.ts`。未上线工具和错误页使用 `noindex`，不进站点地图；筛选和收藏等查询参数不产生新的索引地址。
- 工具说明：`src/seo/guides-media.ts`、`guides-text.ts`。新增工具或修改功能后同步维护能力、步骤、限制和相关工具，单元测试会检查所有已上线工具都有说明。
- 隐私与站点说明：`src/seo/Content.tsx`。静态页面和交互页面共用内容，不添加评分、虚构评价或隐藏关键词。
- `llms.txt` 是同源纯文本目录，作为补充资料；它不是排名或 AI 引用保证，也不替代 HTML、链接和站点地图。不填写无法准确追踪的 `lastmod`。
- `robots.txt` 允许抓取公开资源；隔离预览页通过 `X-Robots-Tag: noindex` 排除。Cloudflare 控制台中的 WAF、AI 爬虫规则或访问验证也可能阻挡抓取，部署者需核对，仓库不能替控制台配置。

上线后，在 Google Search Console 和 Bing Webmaster Tools 验证自己的域名并提交 `/sitemap.xml`，用 URL 检查工具确认首次 HTML 与渲染结果。观察索引数量、有效访问和 Bing 的 AI Performance；收录、排名和 AI 引用由搜索服务决定。没有加入统计脚本。

依据：[Google 的 AI 搜索说明](https://developers.google.com/search/docs/appearance/ai-features)、[JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[Bing 网站指南](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a)、[OpenAI 抓取说明](https://developers.openai.com/api/docs/bots)、[Cloudflare 静态站点路由](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)。

## 许可

第三方组件的许可见网站的“开源许可”页（`/licenses`）和 [docs/licenses.md](docs/licenses.md)。HEIC 解码（libheif）和 MP3 编码（LAME）是 LGPL 组件，原样使用、单独加载。

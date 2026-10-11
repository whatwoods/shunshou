# B 批交付与续接记录

更新：2026-10-11，第二轮。B 批现有 24 个工具（原 18 个，本轮新增 6 个），不含 Claude 负责的 image-compress。

## 第二轮完成范围

- 用户已明确批准 libheif-js 和 LAME 的 LGPL 使用；接入 HEIC/HEIF WASM 解码与 MP3 输出。第三方源码未修改、组件按需加载，本地运行。删除了 `docs/heic-wasm-pending.*`。
- PDF 默认压缩只替换可安全重压的图像 XObject，不重建页面内容流，保留文字选择/搜索、矢量与文档结构。强力模式整页图片化，UI 明确提示不能再选中和搜索文字。两模式分别记录与原文件的体积对比。
- 新增图片拼接、取色调色板、音频剪辑转换、视频转换旋转静音、PDF 提取文字、PDF 提取图片。它们覆盖截图整理、配色、铃声、媒体兼容和文档素材提取，均适合纯浏览器离线处理。
- 全部 B 批 24 个接收文件的工具通过共用工作区调用公共 `useHandOff`；下载、复制、清空等操作补上 toast。AV/PDF 用真实 React StrictMode 回归验证交接不会被清理探测吞掉。
- 新建 `docs/licenses.md`，涵盖非 MIT/BSD/Apache/ISC 的运行与开发依赖、底层 LGPL 编码器、用途、源代码与加载方式。

## 工具列表

| 地址 | 核心能力 | 实现 |
| --- | --- | --- |
| /image/convert | HEIC/HEIF 输入，批量 PNG/JPEG/WebP/AVIF/GIF 首帧/BMP、画质、ZIP | libheif-js 1.23.5、原生 Canvas、@jsquash/avif 2.1.1、gifenc 1.0.3、自写 BMP（简单结构免依赖） |
| /image/resize | 比例、宽高、长边、保持比例、批量 | @jsquash/resize 2.1.1，Lanczos 3 |
| /image/crop | 拖框、比例、社交尺寸、旋转翻转 | 原生 Canvas、@jsquash/resize 2.1.1 |
| /image/exif | 元数据、GPS 警示、JPEG/PNG/WebP 无损清理、保留方向 | exifr 7.1.3、自写结构清理（免重编码） |
| /image/watermark | 文字/图片、位置、透明度、大小、平铺、批量 | 原生 Canvas，免额外依赖 |
| /image/svg | 可调优化、前后预览与体积 | svgo 4.1.0 浏览器版 |
| /av/gif | 选段、帧率、尺寸、调色板、抖动、预览 | mediabunny 1.61.3、gifenc 1.0.3 |
| /av/compress | MP4/WebM、分辨率、码率、体积估算 | mediabunny 1.61.3 / WebCodecs |
| /av/audio | 主音轨导出 MP3/WAV/M4A/OGG | mediabunny 1.61.3、@mediabunny/mp3-encoder 1.61.3 / LAME 3.100 |
| /av/trim | 关键帧流复制、精确剪辑 | mediabunny 1.61.3 |
| /av/frame | 真实帧步进、PNG/JPEG、间隔截图 ZIP | mediabunny 1.61.3、fflate 0.8.3 |
| /pdf/merge | 文件/页面视图、缩略图、拖排、混图片、A4、玻璃栏 | @cantoo/pdf-lib 2.11.1、pdfjs-dist 6.4.299 |
| /pdf/split | 页码范围、每 N 页、每页、ZIP | 同上，fflate 0.8.3 |
| /pdf/to-image | PNG/JPEG、72–300 DPI、ZIP | pdfjs-dist 6.4.299、fflate 0.8.3 |
| /pdf/from-image | 多图排序、纸张、方向、边距 | @cantoo/pdf-lib 2.11.1、原生 Canvas |
| /pdf/organize | 旋转、删页、拖排、空白页、撤销 | @cantoo/pdf-lib 2.11.1、pdfjs-dist 6.4.299 |
| /pdf/compress | 默认仅压图片、保留文字矢量；强力整页图片化；双模式体积对比 | @cantoo/pdf-lib 2.11.1、pdfjs-dist 6.4.299 |
| /pdf/page-numbers | 六位置、三样式、起始页码、字号、跳封面 | @cantoo/pdf-lib 2.11.1、原生 Canvas 中文页码 |

| /image/stitch（新增） | 横向/长图、排序、尺寸、间距、背景、PNG/JPEG | 自写布局、原生 OffscreenCanvas（简单拼接无需新依赖） |
| /image/palette（新增） | 主题色、像素/坐标取色、HEX/RGB/CSS 复制、调色板 PNG | gifenc 1.0.3 量化、自写颜色格式 |
| /av/audio-edit（新增） | 选段试听与剪辑、MP3/WAV/M4A/OGG、码率 | mediabunny 1.61.3、MP3 扩展 1.61.3 / LAME 3.100 |
| /av/convert（新增） | MP4/WebM、90°旋转、静音、兼容时流复制 | mediabunny 1.61.3 |
| /pdf/extract-text（新增） | 提取已有文字、预览、复制、TXT 下载 | pdfjs-dist 6.4.299 |
| /pdf/extract-images（新增） | 图片 XObject 导出、JPEG 原字节、PNG 透明度、ZIP | @cantoo/pdf-lib 2.11.1、原生 OffscreenCanvas |

## 处理与资源约束

原文件留在浏览器，不请求外部服务。图像/音视频/PDF 重处理在 Worker，PDF 字体/CMap/WASM 与 HEIC 解码器均由本站提供。主页面不静态加载工具引擎。依赖安装取得 `.npm-lock`；未修改 Claude 归属文件。

第二轮开始检查 5173 没有监听进程，上一轮由本代理启动的开发服务器已停止。本轮没有启动依赖热更新的开发服务器，以测试和生产构建为验证依据。

## 真实文件与回归验证

- HEIC：将 `/System/Library/Desktop Pictures/Mac Blue.heic`（9,282,587 bytes）复制到项目临时文件，用未修改的 libheif-js 1.23.5 WASM 实际解码为 6016×6016、144,769,024 RGBA bytes；像素范围正常，临时文件已删除。测试运行在 Node WASM 实例，不冒充浏览器 CSP 验收。
- MP3：真实 PCM → LAME 编码，重新解析输出。音频精确选段、MP4→WebM 双轨转换、旋转/静音及原始编码字节保留均有引擎测试。
- PDF：混合文字/矢量/图片/表单/嵌套 Form 的真实 PDF，压缩后页面内容流字节不变、文字提取一致、表单保留、共享图片降采样且文件变小；另测透明蒙版与特殊颜色安全跳过。提取图片验证 JPEG 原字节、PNG alpha；提取文字验证实际 PDF 内容。
- 新增工具分别有逻辑或真实引擎测试，详情见各分类进度文件。最终全仓检查结果在文末。
- 浏览器 UI、触控及正式 CSP 实机验收没有执行；视觉交互按约定由用户人工验收。

## 已知边界

- HEIC 目前提供解码，不提供 HEIC 编码；动态照片/多图容器只取首图。GIF 图像转换取首帧；JPEG/BMP/GIF 输出透明区域铺白。
- 默认 PDF 压缩支持 RGB/灰度、8 位、常见 JPEG/Flate 图片；透明蒙版、特殊色彩空间/解码参数/编码保持原样并报告。按最大页面长边估算图片像素上限，保守降采样；不能保证文件一定变小，默认模式变大则保留原文件。强力模式才会丢失可选择文字、链接、表单等；任何实际修改都会使原数字签名失效。
- PDF 提取文字不做 OCR，扫描件没有文字层时会明确说明；多栏与表格输出可能需要整理。提取图片不导出内联图片或矢量，共享图片只导出一次，不支持的对象会列出原因。
- 音视频只处理主轨，浏览器原生解码/编码支持随系统而异；MP3 编码提供本地 LAME 后备。大图、PDF 与最终媒体/ZIP 输出仍受设备内存限制。
- 修改 PDF 的其他整理工具保留页面内容，不保留文件级书签、交互表单和数字签名；加密文件仍需先解锁。

## 请求与文件归属

本轮没有新增 Claude 修改请求。上一轮 `docs/requests.md` 的 SW 预缓存请求已由 Claude 标记处理：只预缓存首页，工具资源按需缓存。已有 image-compress/oxipng 的动态函数分支核查请求仍保留，B 批未改该工具。

当前目录没有 Git 仓库，按本批文件清单复核源码、依赖、资源与导入。详细历史与分类结果见 `progress-b-image.md`、`progress-b-av.md`、`progress-b-pdf.md`；最终状态以本文收尾验证为准。

## 第二轮最终验证

2026-10-11 收尾检查（A 批仍同步修改，以下为检查当时的全仓结果）：

- `npm run typecheck`：通过。
- `npm test`：54 个测试文件、193 项测试全部通过。
- `npm run build`：通过，正式 Vite 构建完成。
- 首页入口 `index-BX888GEA.js`：280,320 bytes，gzip 90.18 kB；未包含 HEIC、PDF、媒体与 MP3 引擎，工具与处理库仍独立拆包。首页体积也包含同时进行的 A 批和全站修改。
- 所有构建产物均小于 25 MiB；HEIC WASM 为 1,463,506 bytes，与 npm 原文件 SHA-256 一致。
- `docs/heic-wasm-pending.*` 与实际 HEIC 测试临时文件已删除；5173 未发现监听服务。

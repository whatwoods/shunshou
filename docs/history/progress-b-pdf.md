# B 批 PDF 进度

更新：2026-10-11。PDF 七个工具均已实现，主代理可合并进 docs/progress-b.md。

## 完成工具
- `/pdf/merge`：按文件 / 按页面缩略图网格，拖动排序、按钮排序、文件名自然排序、撤销，混入图片，统一 A4、边距和文件名；底部浮动 Glass 工具栏。
- `/pdf/split`：页码范围分组、每 N 页、每页一份，真实 PDF 页面复制，ZIP 下载。
- `/pdf/to-image`：逐页 PNG / JPEG，72–300 DPI、JPEG 画质，ZIP 下载。
- `/pdf/from-image`：PNG / JPEG / WebP / AVIF / GIF 首帧 / BMP（浏览器可解码格式），多图拖动 / 按钮排序，A4 / Letter / 原尺寸，边距、横纵向。
- `/pdf/organize`：缩略图旋转、删除、拖动 / 按钮排序、插入空白页、撤销；可加入其他 PDF 页面。
- `/pdf/compress`：扫描件逐页栅格化 JPEG、画质与 DPI、体积对比；保留原文件，明确说明文字、表单、链接和书签会丢失。
- `/pdf/page-numbers`：六种位置、数字 / 第 1 页 / 1 of N、起始页码、字号、跳过封面；处理原有旋转与 CropBox，中文页码由本机字体绘制透明 PNG。

所有页面支持拖入、粘贴、首页 handoff、空状态、忙碌状态、错误、完成、下载、取消清空，以及 load/save 设置。

## 依赖与实现
- `@cantoo/pdf-lib 2.11.1`，MIT，npm 查询最近维护 2026-09-15。活跃维护的 pdf-lib fork；原 pdf-lib 1.17.1 长期未发版，所以使用 fork。用于复制页面、嵌入图片和生成 PDF。
- `pdfjs-dist 6.4.299`，Apache-2.0，npm 查询最近维护 2026-10-03。现代 build，不使用 eval / new Function。
- `@napi-rs/canvas 1.0.11`，MIT，仅显式 devDependency，用于 Node 下真实栅格化引擎测试，不进入浏览器生产包。
- 已按 `.npm-lock` 协议安装依赖。
- 所有重活放在 `src/lib/pdf/worker.ts`，PDF.js 解析另用本地嵌套 Worker。自定义 OffscreenCanvasFactory 与 BinaryDataFactory，禁用 FontFace，CMap、标准字体、WASM 通过 Vite `?url&no-inline` 全部作为本地文件发布，防止 data URL 被 connect-src 阻止。
- PDF.js 6 使用较新的内建 API，Worker 局部 `compat.ts` 补足 Map/WeakMap getOrInsert、getOrInsertComputed、Uint8Array toHex/base64 和 Set intersection，避免引入含动态求值兼容代码的 legacy build。
- 缩略图按视口可见性生成，导出逐页渲染，单次 Canvas 上限 5000 万像素。单文件更换会释放旧来源；取消与离页终止 Worker、释放 URL。
- 共用工作区 `src/components/kit/PdfWorkbench.tsx`，7 个 Page.tsx 是独立懒加载入口，首页没有静态引入 PDF 依赖。

## 验证
- 纯逻辑测试：页码范围、分组、非法页码、保序移动、适配尺寸、页码文本。
- `pdf-merge/engine.test.ts` 使用真实 PDF.js 与 @cantoo/pdf-lib、Node canvas 测试：加载、合并、A4、拆分、整理、三种页码、无 DOM 缩略图、PNG/JPEG、扫描件压缩、图片 PDF。测试仅替换 Worker 传输与 Canvas 平台，不替换 PDF 解析或编码。
- `08:21:07` 的 `npm run typecheck`、`npm test`、`npm run build` 全部通过（36 个测试文件、111 项测试；包含本批 30 项 PDF 测试）。最终生命周期修正后 typecheck 通过；08:21:40 全量测试为 115 通过、1 失败，失败在 A 批 `code-json/logic.test.ts` 特殊键排序，新并发改动导致，与 PDF 无关，已通知主代理。构建 PDF workbench 16.35 kB / gzip 6.56 kB，PDF.js 431.30 kB、parser worker 1.19 MB 为独立按需文件，首页入口未引入 PDF 库。
- 浏览器实机验证受当前环境限制：主代理 Chrome headless 退出 134，CUA 无可用浏览器。视觉、触控和部署 CSP 实机验收尚未进行。

## 已知边界
- 修改后的文档不保留文件级书签、数字签名、交互表单。扫描件压缩会栅格化所有内容（页面内有明确说明）；结果不保证更小。
- 加密 PDF 需先由原软件解锁。未嵌入的特殊字体、复杂 PDF 颜色混合可能与原阅读器存在差异，需要核对重要文档。
- PDF 写出库仍需在 Worker 内持有文档；极大 PDF 与打包结果受浏览器可用内存限制。
- PDF 图片输入暂不含 HEIC；本工具明确显示支持的浏览器图片格式，不宣传 HEIC 支持。
- 未新增清单外 PDF 工具；未修改 Claude 负责的文件；本子批次没有写 docs/requests.md（全站 SW 预缓存问题由主代理提出）。

## 第二轮：保留文字压缩、提取工具与统一交接（2026-10-11）

本节覆盖上文第一轮压缩与文件交接的实现说明。

- `/pdf/compress` 默认“保留文字”：在原 PDF 文档上识别页面资源与嵌套 Form 中的 Image XObject，以同一 PDFRef 替换可安全重压的图片。页面内容流、文字/矢量、链接、表单、书签和其他文档对象保留；不重新组装页面。仅处理 8 位 DeviceRGB/DeviceGray 的 JPEG、Flate 或未压缩像素，支持默认 Decode；透明、蒙版、特殊颜色空间、特殊 Decode/DecodeParms 与其他编码原样保留并报告原因。共享对象只处理一次；蒙版引用不会误当普通灰度图重压。
- 默认模式按文档最大页面长边与选定 DPI 估算图片像素上限，再用高质量 Canvas 缩放、JPEG 重新编码。只替换变小的图像；最终 PDF 若未变小则原字节返回。此 DPI 是整页长边上限估计，不是逐次绘制变换得到的精确有效 DPI。
- “强力”模式保留为主动选择，整页 JPEG 栅格化；显式提示“文字会变成图片，不能再选中和搜索”。两模式保留独立体积记录，显示原文件/保留文字/强力三列，切换模式不丢比较记录；更换文件或画质/DPI 后清除过时记录。实际重写 PDF 会使数字签名失效，界面已说明。
- 新增 `/pdf/extract-text`：使用真实 PDF.js `getTextContent` 提取已有文字，逐页 TXT、文字预览、完整复制/下载；无文字时明确提示扫描件需要 OCR。按内容顺序与位置恢复简单行距，多栏、表格不承诺完整布局。
- 新增 `/pdf/extract-images`：遍历页面及嵌套 Form 的图片资源，共享图片只导出一次；常见 JPEG 保留原始字节，RGB/灰度原始或 Flate 像素导出 PNG，支持同尺寸 8 位灰度软蒙版透明通道。特殊编码、颜色、复杂蒙版跳过并在界面/ZIP 说明文件中报告；内联图片和矢量图形不导出。无可用图片时给明确原因。
- 新工具均在自己的目录提供 `meta.ts`，用途是常见离线“取文字/取原图”，未改中央工具清单。
- 全部 9 个 PDF 页面通过共用工作区接入公共 `useHandOff`，用待处理队列和微任务跨 StrictMode 探测卸载保留文件，不修改公共 hook。下载、复制、清空增加 toast，复制失败使用 error 状态。
- 没有新增生产依赖。继续使用 `@cantoo/pdf-lib 2.11.1`、`pdfjs-dist 6.4.299`；Canvas 仅为 Worker 原生能力，测试使用现有显式 devDependency `@napi-rs/canvas 1.0.11` 与 `jsdom 30.1.2`。

### 第二轮验证

- 真实混合 PDF 回归：图像实际降采样/变小，压缩前后 PDF.js 提取文字一致，页面 content stream 原字节一致，矢量保留，表单字段值保留，嵌套 Form 的流与共享引用保持。
- 蒙版与 CMYK 图片保留原文件并报告；JPEG 提取与原图片字节一致，PNG 软蒙版导出实际 alpha 值正确；排除孤立图片对象并去重；文字提取行距/中文、完整导出测试。
- jsdom + React StrictMode 实际挂载工作区，验证首页文件仅接收一次且成功显示（公共 useHandOff 未 mock）。
- `08:30:09` 最终全量 `npm run typecheck`、`npm test`、`npm run build` 全通过：46 个测试文件，148 项测试。此后仅删除重复体积表并补全强力模式提示文案。
- 本轮不启动开发服务器；视觉与交互默认交用户验收。
- 第二轮未修改受保护文件、未写新的 `docs/requests.md`。许可证总表由主代理维护。

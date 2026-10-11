# A 批 / office 进度

7 个工具均已实现，2026-10-11。由 office 子代理负责；未修改 Claude 文件，未新增清单外工具。

- `/office/word-count`：实时汉字/英文单词/Unicode 字符/段落/句子/阅读时间；TXT、MD 拖入及首页交接；统计 Worker。自写：规则短小、避免额外依赖。段落以空行分隔，字符按 Unicode 码点；未做可选 DOCX。
- `/office/text-diff`：行级 + 行内词差异、左右/上下、忽略行首尾空白、两文件拖入、差异下载；diff 9.0.0（BSD-3-Clause），Worker + 算法超时。超过 5000 行只截断预览，导出完整。
- `/office/case`：9 种格式，批量逐行，文件拖入，Worker；change-case 5.4.4（MIT），维护周期较长但 API 成熟，避免重复实现缩写与分词规则。
- `/office/qrcode`：文本/网址/Wi-Fi、纠错、颜色、Logo、PNG/SVG、图片粘贴/拖入识别；qrcode 1.5.4（MIT）、jsqr 1.4.0（Apache-2.0）。两库发布时间较早但专注稳定的 QR 算法，浏览器纯 JS 可离线，不引入大体积 WASM；QR 编解码在 Worker。Logo 自动 H 级纠错，识别单个二维码；扫描图片最长边缩到 2400。
- `/office/password`：crypto.getRandomValues + 拒绝采样，字符集/易混排除/批量/熵估计/口令短语；自写随机选择，@scure/bip39 2.4.0（MIT）仅使用 2048 英文词表，非钱包助记词，不保存生成内容。选择字符集意味着均匀抽样，明确说明不保证每条含所有类型。
- `/office/markdown`：GFM 表格/任务列表/代码高亮、实时 Worker 预览、安全 HTML 导出；marked 18.1.0（MIT）、dompurify 3.4.16（MPL-2.0 OR Apache-2.0）、highlight.js 11.12.0（BSD-3-Clause）。消毒在 DOM 主线程；远程图片剥除，导出加严格 CSP。jsdom 30.1.2（MIT，仅开发）用于 XSS 回归测试。
- `/office/units`：8 分类，含市斤/亩/市尺和 KB/KiB，仿射温度换算、绝对零度检查、复制下载。自写：有限明确系数，避免通用单位库体积。

共享：新建 `src/components/kit/OfficeKit.tsx/.css`。全部 CSS 使用项目变量；表单 label，375px 单列；视觉由用户人工验收。偏好只存设置，原文/密码/Wi-Fi 不持久化。

依赖已逐个 `npm view ... version time.modified license`；安装持 `.npm-lock` 并 trap 释放。依赖产物需最终构建验证；DOMPurify 发布包中 coverage 专用文件有 new Function，但正常 ESM 入口没有此调用，不会打入前端。

每完成工具均跑 typecheck 和全局 npm test，office 类型检查无错误；最近全局 26 文件 / 68 测试通过（新增 XSS 测试待最后运行）。当时 typecheck 仅 B 批 pdf worker 两个类型错误，已通知主代理。最终结果待主代理全批集成构建。

## 最终子批验证（08:19）

- office 专项：8 文件、17 测试全部通过，包含实际 QR Unicode 往返、DOMPurify XSS、随机拒绝采样、负 Kelvin 同单位回归。
- 08:18 全局 `npm run build` 成功，首页 index 为 273.67 kB / gzip 87.96 kB，office Page/Worker/OfficeKit 独立分包。工具依赖未并入首页。
- 08:19 新增 B 批测试后全局 `npm test` 为 33 文件通过 / 1 文件失败，101 测试通过 / 4 失败，均为 `src/tools/pdf-merge/engine.test.ts` 的 Map.getOrInsertComputed 环境问题；typecheck 当时也仅同文件 Buffer/BlobPart 类型错误。已通知主代理，由对应代理处理，最终全批结果以主进度为准。
- 正常发布入口扫描无 eval/new Function；DOMPurify coverage 文件未被使用。
- 新增 XSS 开发依赖的第一次测试与安装并发，环境未就绪导致一次 jsdom 找不到；安装结束后重跑通过。
- 修复：OfficeKit 每轮处理及 worker 异常清旧结果；温度包括 K→K 均检查绝对零度；输入盒使用 border-box 防窄屏溢出。
- `docs/requests.md`：无请求。未新增工具。可选 DOCX 未实现；视觉与浏览器交互按约定由用户验收。
- 08:20 最后一次全局 `npm run typecheck` 已通过（B 批同步修复）。

## 08:25 主代理复核修正

- word-count 接入 Worker error，异常时不再误报完成。
- word-count / case / markdown / diff 共享 latest-read 代次检查：新文件、用户编辑使旧文件读取失效；旧错误不会覆盖当前状态，读取时禁止复制旧结果。卸载后不提交，兼容 StrictMode effect 重放。
- OutputActions 新增显式 ready，允许有效转换得到空字符串时复制与下载空文件；Markdown 空 HTML 也可导出。
- 新增读取竞态与空结果按钮回归，office 9 文件 / 20 测试通过；全局 typecheck 通过。

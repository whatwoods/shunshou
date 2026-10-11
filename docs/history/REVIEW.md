# 顺手 · 审查记录（2026-10-11）

## 这一轮是怎么做的

- **Codex 独立审查（未完成）**：GPT6Astra Medium 读完约定、Claude 负责的全部文件和构建产物，用真实库写探针确认了 8 个问题。之后账号额度用尽（提示 2026-10-14 11:30 恢复），没来得及写完整报告。下面标「Codex」的条目，是它停下前已确认的。
- **Claude 实测**：在开发服务器和 wrangler 正式 CSP 预览里，用真实文件把 53 个工具跑了一遍。测试文件包括 6016² 的 HEIC、240/60/30 帧的 H.264 视频、扫描件和文字 PDF、GBK CSV，以及带 XSS 的 Markdown。下面标「实测」的条目来自这里。
- 修完后：类型检查通过，**56 个测试文件、199 项测试**通过，生产构建通过（首页入口 gzip 约 90 KB），正式 CSP 下无违规。

**待办：额度恢复后，再让 Codex 做一次完整的独立审查**，覆盖本轮没有逐行看过的工具代码。

## 已修复

| # | 级别 | 问题 | 位置 | 来源 | 修法 |
|---|---|---|---|---|---|
| 1 | P0 | 视频压缩体积暴涨：1.2 MB 的视频按 2 Mbps 压完是 45.9 MB。`new Quality(数字)` 的参数是 0–1 质量系数，不是码率。MP3 码率也因此不对。 | `src/lib/av/convert.ts` | 实测 | 改为 `new Quality({ bitrate })` |
| 2 | P0 | 60 帧视频输出码率是目标的两倍（240 帧时 7 倍）：编码器没拿到帧率，按 30 帧分配码率 | `src/lib/av/convert.ts` | 实测 | 压缩时传 `frameRate`，最高 60 |
| 3 | P0 | 视频转 GIF、视频压缩直接报错：mediabunny 同时给宽高时必须给 `fit` | `src/lib/av/worker.ts`、`convert.ts` | 实测 | 加 `fit: 'fill'`（尺寸已按比例算好） |
| 4 | P1 | 拆分、整理、合并、加页码后的 PDF 体积约为原来 4 倍：每页单独 `copyPages` / `embedPage`，共享的字体和图片每页各复制一份 | `src/lib/pdf/worker.ts` `compose()` | 实测 | 同一来源一次复制完；75 KB 的 PDF 拆分后约 73 KB |
| 5 | P1 | PDF「统一为 A4」会把裁剪框外的内容画出来：pdf-lib 默认按 MediaBox 嵌入 | `src/lib/pdf/worker.ts` | Codex | 按每页的 CropBox 嵌入 |
| 6 | P1 | 在别的工具页上用 ⌘K 或拖入面板交接文件，会被当前页先接走 | `src/lib/store.ts` 及三处调用 | Codex | `handOff(files, 目标路径)`，只有目标页能取走 |
| 7 | P1 | StrictMode 下首次交接丢失 | `src/lib/useHandOff.ts` | Codex A 批 | 在微任务里取文件，清理时取消；删除多余的 `useDeferredFiles` |
| 8 | P1 | 图片压缩：取消正在处理的那张后，排队的图片不再开始 | `src/tools/image-compress/pool.ts` | Codex | `cancel()` 之后继续 `pump()` |
| 9 | P1 | YAML 的 `!!set`、`!!omap`、日期转出来是 `{}`，`!!binary` 变成按下标展开的对象 | `src/tools/code-json/logic.ts` | Codex | 先转成数组、对象、日期字符串、Base64，保留循环引用检测 |
| 10 | P1 | SQL 结果导出 JSON 时，同名列（如 `a.id, b.id`）后一列覆盖前一列 | `src/lib/dataCore.ts` | Codex | 重名列加 `_2`、`_3` 后缀 |
| 11 | P1 | 缩放、裁剪、水印默认输出 PNG：2.6 MB 的 JPEG 照片缩放后 8 MB，裁剪后 17 MB | `ImageWorkbench.tsx`、`src/lib/image/worker.ts` | 实测 | 新增「原格式」并设为默认（格式转换除外）；现在缩放输出 798 KB 的 JPEG |
| 12 | P2 | 格式转换改了输出格式后，旧结果还显示「完成」 | `ImageWorkbench.tsx` | 实测 | 设置变化时退回待处理，并回收旧结果的 Blob URL |
| 13 | P2 | 跟随系统时，系统切换深浅色后，导航栏的主题图标不更新 | `src/lib/theme.ts` | Codex | 快照里带上实际生效的主题 |
| 14 | P2 | Service Worker 版本号只按文件名计算，改了 `index.html`、`theme.js`、图标或 manifest，已安装的用户收不到更新 | `vite.config.ts` | Codex | 这些文件的内容也算进版本号；已验证改 `index.html` 会换版本 |
| 15 | P2 | `--ink-3` 灰字对比度 3.2–3.5，低于 4.5 | `src/styles.css` | Codex | 浅色 `#76736E`，深色 `#8F8C86` |
| 16 | P2 | PDF 输出统一叫「顺手文档」 | `PdfWorkbench.tsx`、`src/lib/pdf/*` | 实测 | 不填文件名时沿用来源文件名，例如 `license-split-001.pdf` |
| 17 | P2 | 哈希输入文字后还要再点「开始计算」 | `src/tools/code-hash/Page.tsx` | 实测 | 文字停顿 250 ms 后自动计算；文件选好就开始 |
| 18 | P2 | 各 kit 的原生下拉框、滑杆、勾选框与规范 E 不一致；`btn-soft` 单独使用时只是一个灰框 | `src/styles.css` | 实测 | 全局统一 `.tool-main` 里的原生控件；`btn-soft` 可以单独使用；工具页标题下补上间距 |

上面 6–8、13 已写成回归测试，放在 `src/lib/regressions.test.tsx`；9、10 在各自工具的 `logic.test.ts` 里。

## 核实过、没有问题的

- **oxipng 的 `Function(...)`**：只在多线程构建里出现，多线程需要 COOP/COEP，本站不开启。正式 CSP 下实测 PNG 无损优化（4.1 MB → 3.6 MB）没有违规。
- **正式 CSP 下实测通过**：HEIC 解码（libheif wasm）、Prettier（Worker）、sql.js、mediabunny 与 WebCodecs、pdf.js（强力压缩、缩略图）、Markdown 预览。
- **Markdown 预览**：DOMPurify 清理后，`<img onerror>` 和 `<script>` 都不会执行。
- **外部请求**：PDF 字体与 CMap、HEIC 的 wasm 都从本站加载。构建产物里出现的外部地址只是命名空间和文档链接，CSP 也会拦截。
- **SQL**：`load_extension` 不可用，`ATTACH` 读不到本机文件。
- **其他**：JSON 的大整数不丢精度；二维码生成后能识别回来；EXIF 清理后不含 GPS，竖拍方向正确。
- **手机宽度**：375px 下 52 个工具页都没有横向溢出。

## 还没处理的

- **P3 代码可维护性**：部分 kit 和工具页的 CSS/TSX 被压成了一行，例如 `ImageWorkbench.tsx`、`PdfWorkbench.css`、`office-text-diff/Page.tsx`。建议在下一次 Codex 审查完成、改动稳定后，用仓库里已有的 Prettier 统一格式化，并在 AGENTS.md 里禁止这种写法。
- **P3 组件一致性**：全局样式已经统一了原生控件的外观，但 2–4 个选项的场景，更好的做法是换成 `Segmented`，开关换成 `SwitchRow`。图片工作台的 `fieldset` / `legend` 也建议换成 `.group-title` + `.group`。
- **P3 小问题**：音频剪辑默认输出 WAV，铃声场景用 MP3 更合适；简繁转换默认不转换地区用词（「软件」只变成「軟件」），可以在界面上说明。
- **许可证**：libheif-js 和 LAME 是 LGPL。按 Claude 的决定作为独立、未修改的组件按需加载，说明见 `docs/licenses.md`。如果不希望引入 LGPL，可以去掉 HEIC 输入和 MP3 输出，改动很小。

# A 批进度

当前：第二轮完成，累计 28 个工具。新增 7 个工具、DOCX 正文统计、统一 handoff/toast。最终 55 文件 / 194 测试、类型检查和构建通过；详情见文末第二轮记录。

2026-10-11：A 批 21 个工具已完成。已通读 AGENTS、参考工具、注册机制、组件、CSS 变量与 JSON 设计稿。

## 分工与范围
- 主代理：code-json、base64、url、regex、jwt；集成验证。
- office 子代理：全部 7 个 office 工具，详细进度在 progress-a-office.md。
- data 子代理：全部 6 个 data 工具，详细进度在 progress-a-data.md。
- code_extra 子代理：hash、timestamp、color，详细进度在 progress-a-code-extra.md。
- 不改 Claude 或 B 批文件；依赖安装使用 .npm-lock。

## 实现选择
- JSON：jsonrepair 3.15.0、yaml 2.9.1（均 ISC，npm 最新维护时间分别 2026-07-03、2026-09-11）；解析、修复和转换放 Worker。
- Base64、URL、正则、JWT：采用浏览器原生编码、URL、RegExp 和 Web Crypto，避免额外运行时依赖。正则 Worker 超时终止。
- 使用 react-best-practices 的按需加载、状态最小化与重活隔离原则。

## 验证
尚在实现，未完成最终验证。目录没有 .git，最终差异通过文件范围与源代码检查。

## 主代理编码工具已实现
- `/code/json`：Worker 校验、美化/压缩、缩进、递归键排序、JSON/YAML、错误定位、jsonrepair 修复；大文件在 Worker 读取，语法高亮预览上限 100,000 字符，导出完整。修复结果保留原输入方便核对。
- `/code/base64`：UTF-8、URL-safe、文本/文件/data URL，Worker 编解码、图片预览、下载原始二进制。原生 TextEncoder/TextDecoder/atob/btoa，无额外库。
- `/code/url`：URI/参数编码解码、协议域名端口路径片段解析，重复参数编辑与重组。原生 URL 保留重复项。
- `/code/regex`：Worker 匹配/捕获位置/命名分组/替换，1.5 秒超时终止，Unicode 零宽匹配前进，常用片段；最多返回 10,000 个匹配，替换为全文。
- `/code/jwt`：三段解析与着色、UTC 时间/过期状态，HS/RS/PS256/ES/EdDSA 本地 Web Crypto 验签；预期算法显式选择，拒绝算法不符，不保存令牌或密钥。
- 每个工具完成后已运行 typecheck 和全量测试；本组无类型错误，测试通过。当前 typecheck 的残留错误在 B 批 `src/lib/pdf/worker.ts`，等待外部修复。

## 集成审查修复
- JSON 新增 `jsonc-parser 3.3.1`（MIT，npm 最新修改 2026-07-16）：使用语法树中原始数值片段，格式化、排序和 YAML 往返保留超大整数、高精度小数和超大指数；简单序列化层只处理已解析数据，不执行代码。循环 YAML / 非有限 YAML 数值给出错误。额外测试原型特殊键和数字类型伪装。
- 正则匹配只回传位置/长度，捕获详情仅前 100 处、每项最多 1,000 字符、总字符预算 100,000。替换全文通过 Blob 传回，避免捕获前瞻造成平方级传输与渲染。补 v 标志零宽匹配回归；空结果可复制、下载。
- Base64 文件按 3 MiB 分块读取，编码块边界与填充正确；支持带 charset 参数、前导空白的图片 data URL。
- 数据组审查修复了 File.text 方法导致的输入类型误判，补真实 File 分流回归；清洗结果与原工作表分开存储；大表分页+虚拟化避免超过 CSS 高度上限；CSV 多字节跨块与真实 Parquet 文件测试已通过。
- office 审查补充负 Kelvin 同单位、Worker旧结果清理、DOMPurify安全测试。
- 最新阶段全局 typecheck 通过，36 文件/121 测试通过；最终检查仍在进行。


## 完整交付索引

办公 7 个：见 [progress-a-office.md](progress-a-office.md)。
开发 8 个：本文件记录 JSON / Base64 / URL / 正则 / JWT；其余见 [progress-a-code-extra.md](progress-a-code-extra.md)。
数据 6 个：见 [progress-a-data.md](progress-a-data.md)。

未新增清单外工具，优先完成本批 21 项。A 批没有向 `docs/requests.md` 添加请求，没有修改 Claude / B 批归属文件。安装修改仅 package.json / package-lock.json，均持有安装锁。

## 交付边界

- 可选 DOCX 导入未实现；字数统计支持 TXT / MD。
- JSON 和正则结果预览有限额，复制/下载完整结果；正则捕获预览也限额，1.5 秒超时可重写表达式再运行。
- JSON 数字保留原精度；CSV 类型推断保留前导零和超安全整数文本。一般表格 JSON/SQLite 数值仍受 JavaScript/SQLite 数值范围约束。
- 数据存放在 Worker 内存；流式读取与虚拟表格降低峰值/DOM成本，不能消除超大数据的内存需求。
- Excel 使用已保存公式结果；图表最多 2,000 点，柱状最多 100 点，页面已注明；拆分和合并列分次执行。
- 二维码识别单个码；Markdown 远程图片不加载。时间转换精确到毫秒；屏幕取色依赖 EyeDropper。
- 依约未自动验收视觉和交互；浏览器实际页面、PNG 导出和原生权限交互留人工验收。依赖发布入口已静态检查，不放宽 CSP。

## 最终集成证据（08:27）

- `npm test`：40 个文件、133 项全部通过。覆盖 A 批全部工具及当时 B 批测试。
- 独立生产打包 `npx vite build --manifest`：通过。
- manifest：21 个 A 批 Page 均为动态入口；另有两个按需逻辑分包。首页静态依赖只有主入口与 rolldown runtime，没有 A 批工具或其大依赖。
- 当次首页主 JS：275.01 kB / gzip 88.38 kB。构建最大资源约 3.37 MiB（既有 AVIF WASM），没有任何静态文件超过 25 MiB。
- A 批子批完成时全站 typecheck/build 均曾通过。最终集成期间 B 批进入第二轮开发，全站类型错误随对方改动变化；最后一次 typecheck 的错误均为 B 批 PdfWorkbench.tsx 模式文案未补齐、pdf/worker.ts 文本项类型不匹配。A 批无类型错误，不越界修改。
- 以最终 `npm run build` 日志为最后状态，位置 `/tmp/shunshou-a-final-build.log`。运行结果在下一条记录补充。

### 最后结果更新（08:29）

B 批同步补齐类型后，主代理的 `npm run build -- --manifest` **成功退出 0**，其中 `tsc --noEmit` 和 Vite 均通过（883 ms 构建）。因此最终类型检查与生产构建通过，上述 B 批错误仅为并行写入时的中间状态。最近一次全量测试仍为 **40 文件 / 133 项通过**，A 批此后没有生产代码改动。

最终构建日志：首页主 JS **276.47 kB / gzip 88.84 kB**。此前 manifest 的静态依赖核验已完成，后续首页体积变化来自并行全站/B 批更新。A 批的 21 个 Page 全为动态入口。后续其他代理可能重建 dist，故以当次日志与核验记录为准。

A 批已完成并停止修改。

# A 批第二轮（2026-10-11）

已重读新版 AGENTS、useHandOff 与 Toast。新增 7 个工具，不修改 Claude/B 批归属文件。

## 新增工具

- `/office/lines`：行排序、去重、去空行、去首尾空白、前后缀、批量导出；自写 Set/Intl.Collator，规则简单，Worker 处理。
- `/office/chinese`：简繁及港台用词转换；opencc-js 1.4.2，Worker 按需加载词典。
- `/data/random`：随机整数、有无放回抽签、打乱名单、均衡分组；原生 Crypto、自写拒绝采样与稀疏 Fisher–Yates，避免取模偏差和分配整个范围。
- `/code/id`：UUID v4/v7、单调 ULID、批量复制下载；uuid 14.0.3、ulid 3.0.2，首次生成动态加载。
- `/code/format`：HTML/CSS/JS/TS/JSON/SQL，缩进、行宽、SQL 方言、文件输入；Prettier 3.9.10、sql-formatter 15.9.0，Worker 按需加载解析器，20 秒超时/取消。
- `/code/radix`：2–36 进制批量整数互转，正负号/对应前缀/大写/输出前缀，BigInt 保留整数精度；自写，原生 BigInt 足够，Worker 处理。
- `/code/escape`：HTML 实体、UTF-16 Unicode 转义、码点转义、JSON 字符串双向转换，TXT 文件输入，Blob 完整导出；entities 8.1.0（BSD-2-Clause，npm 修改时间2026-09-07），Unicode 使用明确扫描逻辑、不执行输入，Worker 处理。

选择理由：覆盖批量文字整理、繁简阅读、抽签分组、开发标识、格式整理及转义/数值排查。所有新工具通过 meta.ts 自动注册，源文本/名单/生成结果不持久化。

## 已有工具修改

- 字数统计支持 DOCX：fflate 0.8.3（已有）+ saxes 6.0.0，Worker 仅解压 `word/document.xml`，提取正文与表格文本，保留段落和 XML 实体；50 MiB 文件 / 20 MiB 解压正文上限，拒绝 DTD。页面编辑时停止旧 DOCX Worker。
- CodeFiles、OfficeKit.useIncoming、DataImport、code-hash 均改调公共 useHandOff，覆盖 A 批所有文件接收入口。
- CodeOutput、Office OutputActions、CodeExtraResult、数据导出，以及 Base64 原文件/二维码/Markdown/色板等直接下载统一 toast；保留必要处理状态与错误信息。
- 修复 code-id 设置变更后的过期结果；格式化失败时保留导入文件原文，便于直接修改语法。

## 文件交接回归与请求

真实 React StrictMode 测试重现首次 handoff 启动的 Worker 被 effect 重放清理的问题。A 批用新建 `useDeferredFiles` 延后接收处理，仍使用公共 useHandOff，完成后正常交接且已挂载页面再次交接可用。

`docs/requests.md` 增加一项：请 Claude 在公共 useHandOff 中延后/取消首次取文件任务，避免所有工具开发模式首次交接丢失；A 批无需等待此改动。

## 边界

- DOCX 仅正文/表格，不包含页眉、页脚、批注、删除修订或排版。简繁专名与一简多繁需要人工核对。
- 格式化上限10MB/500万字符，HTML内嵌脚本/样式不单独格式化。
- 随机最多10,000项，整数范围宽度最多2³²；进制仅整数，每行10,000位/10,000行；转义最多500万字符。大结果预览限100,000字符，复制下载完整（格式化器显示完整编辑结果）。
- 无浏览器视觉自动验收；依约留人工。未启动开发服务器，规避热更新旧代码问题。

详细分组记录：[office](progress-a-office-round2.md)、[data](progress-a-data-round2.md)、[code](progress-a-code-round2.md)。最终全仓 typecheck/test/build 与分包核验待下条记录。

## 第二轮最终验证

- `npm run typecheck`：通过。
- `npm test`：**55 个文件、194 项测试通过**，包含新增 7 工具、DOCX 解压/实体/大小限制、StrictMode 首次及再次文件交接回归。
- `npm run build -- --manifest --outDir /tmp/shunshou-a2-build`：通过（705 ms）。独立输出目录避免与 B 批构建互相清空 dist。
- manifest 核验：A 批累计 **28 个 Page** 均动态加载；首页静态依赖仅入口与 rolldown runtime，没有 A 批工具实现。新页面各约 2–6.4 kB；Prettier、SQL formatter、OpenCC 等另行按需分包。
- 首页主 JS 280.43 kB / gzip 90.23 kB（包含并行全站/B 批更改）；最大产物为既有 AVIF WASM 3,534,665 bytes，**无文件超过25 MiB**。
- entities、OpenCC、saxes、Prettier及其实际插件、sql-formatter、uuid/ulid 发布入口检查无 eval/new Function。未新增外部资源请求。
- 代码审查确认 A 批生产文件没有手写 takeHandOff/事件监听残留，文件入口统一公共 hook；复制/下载提示经共享组件和直接调用均使用 toast。
- `docs/requests.md` 有一项公共 handoff/StrictMode 请求，A 批已有接收端修复，交付不受阻。

第二轮完成，停止修改。

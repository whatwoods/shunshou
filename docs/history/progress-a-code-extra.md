# A 批补充：哈希、时间戳、颜色

2026-10-11。三个工具已完成，未修改 Claude 所有文件，无额外工具，无 requests 请求。

## 已完成

- `/code/hash`：文本 UTF-8 与任意文件摘要；MD5、SHA-1、SHA-256、SHA-512、SHA3-256、BLAKE3、CRC32；Worker 内固定 2 MiB 分块读取，进度、取消、拖入／粘贴／首页移交、算法设置记忆、逐项复制、全部下载、已有值比对。空文本／空文件正常处理。
- `/code/timestamp`：Unix 秒／毫秒和 ISO 日期互转；14 个常用 IANA 时区（含浏览器本地时区）、显式偏移、ISO 8601 和 RFC 2822 输出；当前秒时间实时刷新；夏令时重复／缺失时刻默认拒绝，允许较早／较晚策略；精确到毫秒，十进制组装避免浮点误差；时区／单位／冲突偏好记忆，复制结果。
- `/code/color`：HEX／RGB／HSL／OKLCH 互转、透明度、原生取色器、支持时显示屏幕取色、WCAG 2.x 对比度与 AA／AAA／大字判断、透明前景合成、色域裁剪提示、明暗／邻近／互补色板、复制与 CSS 下载、偏好记忆。

## 依赖与选型

已按 `.npm-lock` 安装，安装前通过 `npm view <包> version time.modified license` 核实：

- `hash-wasm 4.12.0`，MIT，npm 最近修改 2024-11-19。发行频率较低；选用其成熟的单线程增量 WASM 实现覆盖全部指定算法，原生 crypto.subtle 不支持增量摘要与 MD5／CRC32／BLAKE3。WASM 内嵌，运行时不请求外部地址、不依赖 SharedArrayBuffer。
- `@js-temporal/polyfill 0.5.1`，ISC，npm 最近修改 2025-12-07。处理 IANA 时区、严格日期和夏令时歧义；按首次转换动态加载，避免自写时区转换的不完整边界。
- `culori 4.0.2`，MIT，npm 最近修改 2026-04-03；`@types/culori 4.0.1` 仅开发依赖。成熟 CSS Color 转换与对比度算法，随颜色页面独立加载。
- 三个运行依赖的实际 ESM 入口静态扫描无 `eval`、`new Function`、`fetch`、`XMLHttpRequest` 调用。

## 验证

- 每个工具完成时均执行了 `npm run typecheck` 与 `npm test`。
- 最新全量测试：25 个文件、65 项通过。本分组 10 项测试覆盖全部哈希标准向量、空文件、跨块中文数据与 Node SHA-256 对照、十进制时间戳、时区／无效日期／夏令时冲突、颜色转换／透明合成／色域和色板。
- 自己负责代码无 typecheck 错误。当前全局 typecheck／`npm run build` 受 B 批 `src/lib/pdf/worker.ts` 的 `disableWorkerRendering`、`destroy` 类型错误阻塞，未越界修改。
- 独立 `npx vite build` 成功，证明当前页面与 Worker 可分包。首页入口未包含哈希、Temporal 或 Culori 实现；Temporal 单独动态分包，哈希实现只在 Worker，颜色实现随页面加载。最终整批构建由父代理在其他批次修复后复核。
- 无浏览器自动视觉验收，按用户约定留给人工；CSS 使用主题变量，375px 改为单列、摘要允许换行。

## 范围与局限

- 时间戳精度为毫秒，亚毫秒数字时间戳会明确拒绝。日期输入采用 ISO 8601；RFC 2822 为导出格式。
- 颜色对比度要求背景不透明；透明前景按背景合成。超出 sRGB 色域的 RGB／HEX／HSL 与对比预览会裁剪，OKLCH 保留源色。屏幕取色依赖浏览器 EyeDropper，其他浏览器仍可用原生颜色选择器。
- MD5／SHA-1／CRC32 的兼容校验用途在页面有简要说明。

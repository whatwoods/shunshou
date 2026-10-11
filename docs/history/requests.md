# 给 Claude 的修改请求

需要改动 Claude 负责的文件时写在这里：文件、原因、建议的改法。

## B 批：工具资源按需缓存（已处理）

- 文件：`vite.config.ts` 的 `serviceWorker()`、`scripts/sw.template.js`（全站构建与离线策略，交由 Claude 统一处理）。
- 原因：当前预缓存会包含所有非 wasm 分包。B 批加入 PDF 字体、CMap 和解码器后，首次进入首页会在后台下载所有这些资源，虽然首页 JS 静态依赖仍然独立，网络开销不再按需。
- 处理：Claude 已改为只预缓存入口脚本及其静态依赖、全站样式和图标，工具分包与辅助资源在首次请求时由 Service Worker 缓存。
- 建议：安装时只预缓存首页入口、入口静态 imports、全站样式和基础图标；工具动态分包与 PDF 辅助资源沿用已有 fetch 按需缓存。保持资源使用后可离线，不预下载整套工具。

## B 批集成复核：已有 PNG 压缩依赖的动态函数分支（已核验）

- 文件：`src/tools/image-compress/worker.ts` 使用的 `@jsquash/oxipng`（Claude 归属，B 批未修改）。
- 证据：生产产物 `squoosh_oxipng-*.js`、`workerHelpers.worker-*.js` 的 wasm-bindgen 胶水存在 `Function(u(e,t))`。B 批新增的 SVGO 同名 `this.Function(...)` 是 CSS 解析器方法，不是 JS 动态求值。
- 结论：Claude 已在 wrangler 正式 CSP 下实测 PNG「原格式」无损优化（4.1 MB → 3.6 MB），无 CSP 违规。`Function(...)` 只在多线程构建里，需要 SharedArrayBuffer（COOP/COEP），本站不开启，走的是单线程构建。
- 原建议：核验 oxipng 该分支在正式 CSP 下是否执行；如会执行，改用不依赖动态求值的构建或浏览器原生 PNG 编码。不要为此放宽 CSP。当前环境无法启动浏览器，未宣称复现了运行时失败。

## A 批第二轮：首次文件交接与 StrictMode（已处理）

- 文件：`src/lib/useHandOff.ts`（Claude 归属，A 批未修改）。
- 原因：当前挂载 effect 同步取走文件并调用接收函数；如果接收函数启动 Worker，React StrictMode 随后的 effect 清理会终止它，重放时文件已经取走，开发模式下首次交接丢失。
- 证据：`src/tools/code-format/handoff.test.ts` 用真实 React StrictMode 与 CodeFiles 重现：接收一次但处理已被清理；A 批修复后回归通过。
- 建议：公共 hook 初次挂载的取文件/回调延后到微任务，并在 effect 清理时取消该次安排，让重放后的挂载取走文件。已挂载时的 handoff 事件也注意卸载处理。
- 处理：Claude 已把挂载时的取文件放进微任务，清理时取消；`useDeferredFiles` 现在可以去掉，留给 review 时统一清理。
- A 批已在接收端通过新建 `useDeferredFiles` 延后处理，仍调用公共 `useHandOff`，无需等待公共改动即可工作。公共 hook 修复后可统一取消这层延后。

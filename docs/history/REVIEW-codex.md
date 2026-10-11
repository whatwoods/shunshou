# 顺手 · Codex 独立审查

审查日期：2026-10-11。当前版本仍有需要先修复的隐私和静默数据错误，暂不建议把“0 B 上传、内容不留存”作为已经完整验证的承诺。首页与工具依赖的隔离、Worker 使用和大部分上一轮修复做得扎实，类型检查、现有测试与构建均通过。新问题主要集中在输入边界、恢复默认后的结果一致性，以及 Service Worker 更新时对已打开页面的处理。本轮没有浏览器，涉及实际浏览器行为且未通过真实引擎或 DOM 探针确认的结论均标为“推断”。

**共 17 项：P0 5 项、P1 6 项、P2 5 项、P3 1 项。** 严重度按本次任务的定义划分；其中 P0 包含用户不易察觉的结果错误，并非全部代表可远程利用的漏洞。

## 范围、版本与验证

- 已阅读 `AGENTS.md`、`docs/REVIEW.md`、`docs/requests.md`、`docs/progress-a.md`、`docs/progress-b.md`、`docs/licenses.md`，检查全站基础设施、54 个工具入口及其共享 kit、引擎、测试、静态资源、构建与部署配置。没有排除 Claude 归属文件。
- `npm run typecheck`：通过。最终 `npm test`：**58 个文件、208 项通过**。`npm run build -- --manifest --outDir .review-tmp/dist`：通过，包含再次类型检查；使用临时输出目录避免覆盖正常 `dist`。最初为 207 项，审查期间另一位开发者增加了图表数字列测试。
- 最终首页入口 `index-ByegwzYe.js`：296.52 kB，gzip 94.47 kB。manifest 的首页静态 JS 依赖只有入口和 Rolldown runtime，没有工具引擎；工具动态加载关系正常。最大资源为 AVIF 多线程 WASM，3,534,665 bytes，未超过 25 MiB。产物里存在多线程版本不等于实际启用了它。
- 额外探针直接调用已安装的 YAML、数据转换、PDF 引擎；用真实 React + jsdom 验证恢复默认和焦点；用 VM 执行 SW 激活逻辑。PDF 探针只替换浏览器 Worker/Canvas 接口和本地资源读取，没有替换 pdf-lib/PDF.js 的文档解析与输出逻辑。探针输出在相关条目内保留，临时脚本、构建产物和日志在审查结束前删除。
- 本地 Wrangler HTTP 验证：`/office/html` 返回主 CSP；`/html-preview-frame` 返回独立 CSP，`connect-src 'none'`、`form-action 'none'`、`frame-ancestors 'self'` 正确；`.html` 地址 307 到无后缀地址，也带独立策略。`! Content-Security-Policy` 分离实际生效，符合 [Cloudflare 官方规则](https://developers.cloudflare.com/workers/static-assets/headers/)。这验证响应头，不能替代浏览器沙盒测试。
- 审查期间通过文件 SHA-256 发现以下 19 个已有文件被并行修改，均已重读相关最新内容：`src/styles.css`；`src/lib/dataCore.ts`、`dataWorker.ts`；`src/components/kit/{CodeKit,DataKit,CodeExtra,PdfWorkbench,OfficeKit,ImageWorkbench}.css`；`src/components/kit/ImageWorkbench.tsx`；`src/tools/data-chart/{Page.tsx,logic.test.ts}`；`src/tools/{code-radix,code-hash,data-clean}/Page.tsx`。随后 `src/components/{CommandPalette,Select,Glass,DropAnywhere}.tsx` 也发生了格式调整，已按最新内容复核，相关问题仍存在。下列行号以最后读取版本为准，最终检查时间约为本地 12:30；并行后续改动不在这个快照内。
- 本次只新增本报告，没有修改源码、配置、依赖或原审查记录。当前目录没有 Git 元数据，使用文件哈希记录范围。没有把上一轮 Claude 的浏览器实测当作本轮新增改动的浏览器验收。

## P0

### R01 · SQL 正文及部分用户文字被自动持久化

- **位置**：`src/tools/data-sql/Page.tsx:15`、`:63`；`src/lib/settings.ts:28`；`src/tools/data-clean/Page.tsx:13`；`src/components/kit/ImageWorkbench.tsx:52`；`src/tools/office-lines/Page.tsx:18`。
- **证据**：SQL 使用 `usePersisted('data-sql', { query: ... })`，编辑器每次输入都经过 `setSaved({ query: q })`；公共 hook 执行 `save(key, value)`。例如输入 `SELECT 'customer-secret-123';` 后，正文进入 `localStorage['shunshou:data-sql']`。清空数据库只清 Worker、表和结果，没有删除 query。全仓同类检查发现清洗的 `find/replace`、图片水印 `text`、行处理 `prefix/suffix` 也随设置保存。
- **影响**：查询可能包含客户信息、令牌或业务数据；关页、刷新或清空数据库后仍留下正文。同机后续使用者可以读到，违反“只存设置，不存用户内容”的明确约定。此处没有证据表明内容被发送到外部。
- **建议修法**：在上述页面把内容字段改为内存 state，仅把格式、质量等偏好交给 `usePersisted`；对已经发布的对应存储键做一次字段清理，避免旧内容继续残留。增加输入敏感标记、卸载再挂载及清空后的存储断言。
- **归属**：A（SQL、清洗、行处理）/ B（水印）。**置信度：确定**。

### R02 · HTML 脚本沙盒仍能通过自身导航把内容发给本站

- **位置**：`src/tools/office-html/Page.tsx:192`、`:222`；`public/_headers:3`、`:14`；`public/html-preview-frame.html:17`；`scripts/sw.template.js:37`。
- **证据**：隔离页有 `connect-src 'none'`，但 iframe 的 sandbox 允许脚本，父页面的 frame 限制从 `default-src 'self'` 回退而来。它不禁止 iframe 导航自身到本站 URL。用于浏览器复现的最小输入如下，选择“运行脚本”后观察网络请求：

  ```html
  <p id="secret">review-private-marker</p>
  <script>
    if (!location.search) {
      location.replace('/html-preview-frame?review_probe=' +
        encodeURIComponent(document.getElementById('secret').textContent));
    }
  </script>
  ```

  这条路径不是 fetch/XHR，`connect-src` 不覆盖它；SW 对导航优先执行 `fetch(req)`，也没有切断这条请求。沙盒允许导航自身的边界见 [HTML 标准](https://html.spec.whatwg.org/multipage/browsers.html#sandboxing)，CSP 指令的作用范围见 [CSP 标准](https://www.w3.org/TR/CSP/#directive-connect-src)。
- **影响**：预览内容可以进入同源托管服务收到的 URL、访问日志或监控记录；“不能联网”和“0 B 上传”不能由现有配置保证。没有发现由此读取父 DOM/localStorage 的途径，也没有把它描述成允许顶层跳转或弹窗。
- **建议修法**：在能够拦截预览发起的全部网络请求前，暂时禁用 `scripts` 模式。安全模式应净化导航入口（如 meta refresh），并给预览内容使用只允许内嵌资源的策略；不能把删除某几个 JS 网络 API 当成完整隔离。恢复脚本模式前，在真实浏览器用上述自身导航、fetch、图片、表单、弹窗和顶层跳转分别断言请求是否到达服务器；不要放宽当前 CSP 或加入 `allow-same-origin`。
- **归属**：Claude。**置信度：推断**（响应头已实测；导航行为依据标准和源码，本环境未运行浏览器）。

### R03 · GBK 文件在 64 KiB 之后才出现中文时静默损坏

- **位置**：`src/lib/dataReader.ts:4`、`:21`。
- **证据**：自动检测只读取 `slice(0, 65536)`，实际读取却使用非 fatal 的 `new TextDecoder(encoding)`。真实读取探针：文件为 `'name\n' + 'a\n'.repeat(33000)`，末尾追加 GBK 字节 `D6 D0 CE C4 0A`。自动模式检测为 UTF-8，末行输出 `['����']`；明确指定 GB18030 时同一文件输出 `['中文']`，两者都不报错。
- **影响**：CSV 查看、转换、清洗、Excel/SQL 导入等共用读取链路会把后部中文变成替换字符，后续导出也保留乱码。常见于前段为编号、后段才出现人名或备注的表格。
- **建议修法**：采样只决定初始候选；自动 UTF-8 模式在整段流式解码时启用 fatal，发现非法字节后用 GB18030 重新读取，或明确要求选择编码后重试。UTF-8 明确指定模式也应报告非法输入，不能静默替换。增加上述跨采样边界 fixture，并验证最后一行和导出字节。
- **归属**：A。**置信度：确定**。

### R04 · YAML 不同类型的键在转 JSON 时互相覆盖

- **位置**：`src/tools/code-json/logic.ts:119`、`:121`、`:86`。
- **证据**：实际 `formatJson('1: a\n"1": b', { source: 'yaml', target: 'json', indent: '2', sort: false, compact: false })` 只输出 `{"1":"b"}`。`uniqueKeys: true` 不会拒绝数字 1 与字符串 "1" 这两个不同 YAML 键；默认 `doc.toJS()` 先转普通对象，第一项已经丢失。`!!omap` 的 Map 分支随后也直接 `Object.fromEntries`，没有检测字符串化碰撞。
- **影响**：合法 YAML 的配置项会无错误提示地消失；切回 YAML 也无法恢复。上一轮 #9 的 Set/Map/日期/二进制值修复正常，但没有解决键的表示冲突。
- **建议修法**：从 YAML 保留 Map 键类型（如 `mapAsMap`），在转换成 JSON 对象前检查规范化后的键是否重复；不支持无损表示时明确报错并指出冲突键。若选择键值对数组表示，须在界面说明格式变化。测试数字/字符串键和复合键碰撞。
- **归属**：A。**置信度：确定**。

### R05 · JSON 表格缺失字段会读到 Object 原型上的值

- **位置**：`src/lib/dataCore.ts:59`、`:70`。
- **证据**：执行 `fromJson(JSON.parse('[{"constructor":"x","toString":"y","__proto__":"z"},{}]'))`，第二行实际为：

  ```text
  ["function Object() { [native code] }",
   "function toString() { [native code] }", "{}"]
  ```

  原因是列集合取自自身键，但单元格用 `row[key]` 读取继承属性；预期三个缺失值都为 null。
- **影响**：JSON/Parquet 到表格、CSV、清洗和 SQL 导入时凭空增加数据，且没有异常。这是继承属性误读，不是已证明的原型污染执行漏洞。
- **建议修法**：读取前使用 `Object.hasOwn(row, key)`，不存在则输出 null；不要因字段名特殊而删除用户真实的自身字段。增加上例及正常同名自身值的回归测试。
- **归属**：A。**置信度：确定**。

## P1

### R06 · SW 强制接管并删除旧分包，会破坏仍打开的旧页面

- **位置**：`scripts/sw.template.js:14`、`:22`、`:24`、`:25`；`src/main.tsx:13`。
- **证据**：新 SW 安装即 `skipWaiting()`，激活时删除所有旧 shell 和不属于 `CURRENT` 的资源，再 `clients.claim()`。VM 执行真实模板的 activate：缓存中同时放入 `Page-old.js`、`Page-new.js`，结果只保留后者。当前页面仍运行旧入口，它引用的旧 lazy chunk/Worker URL 不会被这套流程改写；入口也没有更新协调。
- **影响**：部署更新后，未关闭的页面再打开工具或启动尚未加载的 Worker，离线时必然无法取得已删除资源；在线且托管已不提供旧资源时也会失败。用户只能刷新，正在编辑且未导出的内容可能随之丢失。
- **建议修法**：默认让新 SW 等待旧客户端退出，或明确协调“保存后更新”；不要在仍有旧客户端时立即清掉它们可能使用的资源。若需要立即接管，需保留旧版本资源并按客户端版本回收。增加 v1 页面保持打开、v2 激活、再取 v1 懒加载资源的生命周期测试。
- **归属**：Claude。**置信度：推断**（缓存删除已实测；旧标签页故障未用浏览器复现）。

### R07 · 恢复默认绕过结果失效逻辑，处理中还可能接回旧任务结果

- **位置**：`src/lib/settings.ts:30`；`src/components/ToolPage.tsx:71`；`src/tools/code-id/Page.tsx:7`、`:39`、`:79`；`src/tools/data-clean/Page.tsx:22`；`src/components/kit/ImageWorkbench.tsx:69`、`:155`、`:161`；`src/components/kit/AvWorkbench.tsx:130`；`src/components/kit/PdfWorkbench.tsx:208`、`:269`。
- **证据**：真实 React 探针先以 `kind: 'ulid', count: 1` 生成一条 26 字符 ULID，再点击页面“恢复默认”。设置变成 `{kind:'uuid4',count:10}`，textarea 仍是同一 ULID，状态仍为完成，下载名取新的 `uuid4.txt`。清洗、格式化和时间戳页也把失效处理放在个别 onChange 中；密码页的长度/字符集普通修改同样保留旧结果。B 批虽有 settings effect 清结果，但标题恢复按钮在 busy 时仍可点，运行请求的 generation 不因设置变化而更新，旧请求完成后会重新写回结果。
- **影响**：结果与当前选项、文件名不对应；用户容易导出按旧条件产生的文件。上一轮 #12 仅修好了已经完成后正常改选项的路径。
- **建议修法**：每个工具以完整输入/设置版本决定结果有效性，不只在控件回调里清空；设置变化时让旧任务结果不能提交。公共恢复默认支持 busy 禁用，或走统一取消/失效通道。给 code-id 加上述真实组件回归，并用可延迟的 Worker 回包覆盖“运行中恢复默认”。
- **归属**：A / B；Claude 负责公共恢复入口配合。**置信度：确定**（完成后路径实测；运行中回包路径为源码推断）。

### R08 · 带 EXIF 方向的 JPEG 转 PDF 没有转正

- **位置**：`src/lib/pdf/worker.ts:155`、`:168`、`:170`。
- **证据**：JPEG 直接 `doc.embedJpg(bytes)`，跳过浏览器按 EXIF 方向解码。真实探针生成原始像素 120×60、EXIF Orientation=6 的 JPEG，以“原图尺寸”导出 PDF，结果页面为 **90×45 pt**；正常显示方向应为 60×120，对应 **45×90 pt**。PDF 的 JPEG 图像嵌入没有应用该 EXIF 旋转，而缩略图通过 `createImageBitmap` 解码。
- **影响**：手机竖拍照片在预览与下载 PDF 中方向不一致；图片转 PDF、PDF 混合图片合并均受影响。
- **建议修法**：读取方向后对 JPEG 2–8 的旋转/镜像进行显式处理，或通过遵循 EXIF 的解码路径得到正向像素再嵌入；纸张尺寸也使用转正后的尺寸。增加方向 1–8 的非对称图片输出验证，检查四角像素与页面宽高。
- **归属**：B。**置信度：确定**。

### R09 · A4 嵌入仍会暴露超出 MediaBox 的内容

- **位置**：`src/lib/pdf/worker.ts:207`；同类边界还应检查 `:341` 的页码定位。
- **证据**：上一轮 #5 改成原始 CropBox，但有效可见区域需要考虑 MediaBox。真实 PDF 探针：MediaBox `[0,0,100,100]`，CropBox `[-50,0,150,100]`，在 x=-40 放置文字。PDF.js 读取源页面的 `view` 为 `[0,0,100,100]`；本站 A4 输出中嵌入对象的 BBox 却是 `[-50,0,150,100]`。
- **影响**：源文件阅读时看不到的页外内容被纳入新 A4 页，缩放比例也不正确；“按 CropBox 嵌入”尚未完整修复上一轮问题。
- **建议修法**：集中计算与 PDF.js 一致的有效页面框，正常重叠时取 CropBox/MediaBox 的交集，对无交集、反向坐标等异常情况采用明确且一致的处理。compose 的嵌入边界和页码定位共用该结果；增加超出左边、右边和旋转页的 fixture。
- **归属**：B。**置信度：确定**。

### R10 · 压缩、缩放和水印会把动图静默变成静态图

- **位置**：`src/tools/image-compress/worker.ts:49`、`:59`、`:74`；`src/lib/image/worker.ts:49`、`:135`；`src/components/kit/ImageWorkbench.tsx:532`。
- **证据**：输入接受 GIF/动画 WebP/APNG 等图片，处理统一取一个 ImageBitmap，再编码一次；GIF 输出只有一次 `encoder.writeFrame(...)`。动画提示只在 `mode === 'convert'` 下显示，压缩、缩放、裁剪、水印没有同样提示。压缩“原格式”对 GIF 实际改为 PNG。
- **影响**：用户以为只做压缩或尺寸调整，下载后却丢失动画帧与时序。APNG/动画 WebP 还可能保留原扩展名，更难从文件名看出变化。
- **建议修法**：先识别是否多帧；尚未支持逐帧处理的工具应拒绝该输入并说明原因，或在处理前明确提供“只导出首帧”的操作。提示不要仅放在格式转换页。用两帧且颜色不同的 GIF/APNG/WebP 断言输出行为和用户提示。
- **归属**：Claude（压缩）/ B（图像工作台）。**置信度：推断**（由单帧处理路径确定限制，未在浏览器实测动画解码）。

### R11 · 文件推荐把 HEIC 送到没有 HEIC 解码后备的工具

- **位置**：`src/lib/match.ts:19`、`:69`、`:138`；`src/tools/image-compress/worker.ts:49`；`src/lib/pdf/worker.ts:103`、`:158`；`src/lib/match.test.ts:37`。
- **证据**：HEIC、TIFF、JPEG 都归为同一 image 大类，第一项推荐压缩，混合 PDF 时也统一推荐合并；对应压缩/PDF 引擎只用原生 `createImageBitmap`，没有调用 B 批现有的 `src/lib/image/decode.ts` HEIC WASM 后备。当前测试甚至把 `b.heic` 必须进入 PDF 合并组合写成断言，fixture 内容仅为 `'x'`，没有验证工具能读取。
- **影响**：在原生不能解码 HEIC 的浏览器里，首页主打的自动推荐把可在本站转换的照片带进失败路径；多张混合合并时还可能只成功添加其他文件。
- **建议修法**：按实际格式能力过滤推荐：HEIC 优先进入已有 WASM 解码的转换/缩放工具；PDF 组合排除不支持的格式并说明先转换，或给 PDF/压缩接入同一本地解码后备。TIFF 也应单独处理支持范围。测试加入真实 HEIC 和原生解码不可用条件，不能只验证工具 ready。
- **归属**：Claude（推荐、压缩）/ B（PDF 接收能力）。**置信度：推断**（依赖浏览器原生解码能力；代码能力不匹配确定）。

## P2

### R12 · 多文件 ZIP 在主线程同步复制并打包全部输出

- **位置**：`src/lib/files.ts:19`、`:27`、`:29`。
- **证据**：依次把每个 Blob 完整 `arrayBuffer()` 到 `files`，随后在调用页面的主线程执行 `zipSync(files)`，最后再构造整份 ZIP Blob。没有流式输出、取消或大小上限。PDF 拆页、图片批处理等共同调用它；async 函数不会让 `zipSync` 自动离开主线程。
- **影响**：大批扫描 PDF/图片的原始 Blob、全部字节数组和 ZIP 输出同时驻留，打包阶段阻塞界面；低内存设备可能在已经处理完成后导出失败。具体设备的峰值与耗时未实测。
- **建议修法**：把打包移入 Worker，使用 fflate 的流式 Zip/ZipPassThrough，逐个读取并转交块，限制同时保留的数据；大输出优先写入可用的文件流。保留下载回退时给明确大小约束与失败恢复，避免重复点击启动多个打包。
- **归属**：Claude（公共 files）；A/B 为调用方。**置信度：确定**（同步执行与整块读取确定，设备故障程度为推断）。

### R13 · LGPL 说明留在仓库，没有随网站提供完整可访问材料

- **位置**：`docs/licenses.md:5`、`:11`、`:15`；`src/site.ts:3`；`vite.config.ts:51`；`src/lib/image/decode.ts:3`；`src/lib/av/convert.ts:38`。
- **证据**：独立加载符合记录：HEIC WASM 与 npm 原文件字节相同，MP3 扩展为独立动态分包，保留上游内嵌 Worker/WASM。缺口在交付：`docs/licenses.md` 不进入构建，`repoUrl` 为空，无许可证页面入口；产物中找到的独立 LICENSE 文件来自 PDF.js 资源，没有 HEIC/LAME 的完整许可证与精确版本源码/重建材料。压缩 JS 中保留部分 MPL 声明，音频页提到 LAME，不能替代完整材料。
- **影响**：只使用部署网站的接收者无法从交付物取得这些库的完整许可及对应源码说明；“未修改、独立加载”本身没有完成文档交付。LGPLv3 对随附许可和库使用声明有明确要求，见 [官方许可第 4 节](https://www.gnu.org/licences/lgpl.html)。
- **建议修法**：增加随构建发布的第三方许可入口，提供对应 LGPL/GPL 文本、LAME 许可、版权声明、精确发行版本源码与构建/替换说明；从 HEIC/MP3 工具或页脚可访问。常规 MIT/Apache 等继续保留上游声明。构建检查应验证这些文件实际进入产物，不能只检查 docs 存在。
- **归属**：B（组件材料）/ Claude（构建与入口）。**置信度：确定**（报告的是交付缺口，不扩大为对所有链接方式的法律结论）。

### R14 · 自绘 Select 展开后无名称，滚动/缩放关闭会丢失焦点

- **位置**：`src/components/Select.tsx:112`、`:128`、`:130`、`:203`。
- **证据**：焦点被移动到 portal 的 `role="listbox"`，该元素没有 `aria-label` 或 `aria-labelledby`；触发按钮的 label 不会自动成为 portal 的名称。实际 React/jsdom 探针：打开后焦点在 listbox，触发 `window.resize` 后调用 `close(false)`，菜单卸载，`document.activeElement` 变为 BODY。页面滚动的分支相同。
- **影响**：读屏用户进入列表时缺少字段上下文；键盘用户缩放、窗口改变或页面滚动后失去原操作位置。
- **建议修法**：为按钮和字段名提供稳定 ID，把名称关系传给 listbox；由 viewport 变化主动关闭时使用 `button.focus({preventScroll:true})`。点击外部时根据新焦点目的地决定是否归还，避免抢走用户所点控件的焦点。增加展开、Escape、Tab、resize、外部点击的真实组件测试。
- **归属**：Claude。**置信度：确定**（DOM 与焦点路径已实测，未做读屏软件实测）。

### R15 · 文件推荐模态层没有进入、限制与归还焦点

- **位置**：`src/components/DropAnywhere.tsx:8`、`:29`。
- **证据**：effect 只注册 Escape 和锁滚动；虽然标了 `role="dialog" aria-modal="true"`，没有 focus、Tab 处理或背景 inert。React/jsdom 探针先聚焦外部按钮，再挂载真实 DropAnywhere，焦点仍留在外部按钮。
- **影响**：手机“打开任意文件”和全站拖入后的推荐层对键盘/读屏用户不完整，Tab 可以继续访问遮罩后的页面，关闭后也没有可靠返回点。
- **建议修法**：打开时记住触发元素并聚焦标题或第一个动作，将 Tab/Shift+Tab 限制在模态层内，背景设为不可交互，关闭后归还焦点。复用时注意 ⌘K 与推荐层重叠的锁滚动清理顺序。测试从打开文件按钮进入、循环 Tab、Escape 返回。
- **归属**：Claude。**置信度：确定**。

### R16 · 灰字对比度只在部分背景达标，旧修复不完整

- **位置**：`src/styles.css:8`、`:77`；`src/components/kit/DataKit.css:60`、`:70`。
- **证据**：实际按 WCAG 相对亮度计算：浅色 `#76736E` 对白色为 4.72:1，但对 `--bg-warm: #F5F4F1` 为 **4.29:1**，对 `--surface-2: #F4F3F0` 为 **4.25:1**；深色 `#8F8C86` 对 `--surface-2: #2E2D2B` 为 **4.10:1**。直接存在的失败组合是 `.data-import` 暖灰背景上的 12px `.data-import p`，其颜色为 `--ink-3`。
- **影响**：上一轮 #15 的白底修复不能代表全部表面通过，数据导入提示等小字仍低于普通文字 AA 4.5:1。
- **建议修法**：按真实使用背景调深/调亮文字变量，或在这些面板改用已经通过的正文辅助色；不要改照片、色板和遮罩的颜色来凑比值。把实际前景/背景组合加入颜色计算回归，并由人工检查玻璃背景上的可读性。
- **归属**：Claude（全局色值）/ A（DataKit 使用）。**置信度：确定**。

## P3

### R17 · README 的工具注册和部署说明已经过时

- **位置**：`README.md:5`、`:9`、`:62`、`:79`、`:80`；`src/tools.ts`；`src/pages/Home.tsx:292`。
- **证据**：README 仍写 40 个工具，要求手动修改 `App.tsx` 的 PAGES 和 tools.ts 的 READY；当前实际有 54 个 Page，注册已由目录扫描完成。README 与首页都称 dist 可直接放到“任何静态托管”，没有说明 `_headers` 需要托管平台支持或自行配置等价响应头；HTML 脚本预览的隔离依赖这些头。
- **影响**：后续开发者容易照旧流程重复维护映射；迁移托管时可能遗漏本项目依赖的安全策略。
- **建议修法**：把注册步骤同步为 AGENTS 的 Page/meta.ts/ORDER/match 流程，工具数量从清单生成或删除固定数字；部署说明写清 Cloudflare 以外必须配置主页面和隔离页两套响应头，并给响应头校验步骤。
- **归属**：Claude。**置信度：确定**。

## 上一轮“已修复”逐项复核

| 原编号 | 本轮结论 | 复核证据与范围 |
| --- | --- | --- |
| 1 | 修法正确 | 所有码率用途改成 `new Quality({ bitrate })`，核对已安装 mediabunny 的参数定义；未再发现数字被当码率直接传给 Quality。没有在本环境重新实测浏览器转码体积。 |
| 2 | 修法正确 | compress 传入 1–60 的 frameRate；高帧率会降为 60。 |
| 3 | 修法正确 | 转码和 CanvasSink 同时指定宽高时均有 `fit: 'fill'`，尺寸由比例逻辑计算。 |
| 4 | 修法正确 | 同源页面批量 copyPages/embedPages；额外探针验证重复同一页的复制对象独立，分别旋转后仍保留各自角度。 |
| 5 | 不完整 | CropBox 超出 MediaBox 的真实 PDF 仍错误，见 R09。 |
| 6 | 修法正确 | 生产 handoff 调用带目标路径，接收端检查路径；全仓目标页交接回归通过。测试夹具里省略目标路径不等于生产问题。 |
| 7 | 修法正确 | useHandOff 挂载微任务有取消标记，StrictMode 回归通过；部分 B 批接收端仍有多余微任务和旧注释，但未发现因此丢文件。 |
| 8 | 修法正确 | Pool.cancel 在释放任务后继续 pump；回归验证排队任务启动。 |
| 9 | 原值类型问题修好，键仍有缺口 | 实际探针确认 !!set、!!omap、!!binary 的常见值可输出；不同类型键碰撞见 R04。 |
| 10 | 修法正确 | uniqueKeys 处理同名列及后缀二次冲突，toJson 使用唯一键；R05 属于另一条导入路径。 |
| 11 | 修法正确 | 缩放/裁剪/水印默认 keep，编码按来源选格式；不再把一般 JPEG 无条件转 PNG。 |
| 12 | 不完整 | 完成后设置变化会清理输出 URL；运行中恢复默认仍可接回旧结果，见 R07。未把正常完成后切格式重复报错。 |
| 13 | 修法正确 | useTheme 快照包含偏好和解析后主题；系统模式变更回归通过。 |
| 14 | 原哈希问题修好 | index.html、theme.js、favicon 和 manifest 内容进入版本摘要；R06 是接管/清理时序问题。 |
| 15 | 不完整 | 白底对比度通过，暖灰与部分深色表面仍不足，见 R16。 |
| 16 | 修法正确 | PDF 默认输出从首个来源文件名派生并追加模式/序号，用户自定义文件名优先。 |
| 17 | 修法正确 | 文字 250ms 后自动计算，文件 0ms 排队启动；选中算法通过 useMemo 保持引用稳定，避免无意义循环。 |
| 18 | 外观整合已落地 | 全仓生产 TSX 下拉已替换为 Select；按钮/原生 range/checkbox 有统一规则。没有浏览器，不能把代码检查写成 375px 视觉通过；新 Select 的可访问性缺口见 R14。 |

旧记录中“一行 TSX/kit CSS”的主要例子已经格式化，音频剪辑默认输出已为 MP3，简繁工具也已有地区用词解释，未将这些已处理项重复计入问题。

## 重点专项与测试边界

- **HTML 隔离**：safe 的空 sandbox 禁止脚本；scripts 模式没有 allow-same-origin、allow-popups、allow-forms、allow-top-navigation。父子 postMessage 都检查 `source`，向 opaque-origin iframe 使用 `'*'` 有必要，不能仅凭星号判成漏洞。正式响应头能禁止脚本 fetch/XHR、外部子资源和表单；自身导航的缺口独立列为 R02。iframe 导航缓存按路径保存，没有直接把正常隔离页当作首页 shell；SW 更新仍有 R06。
- **XSS/远程资源**：Markdown 经 DOMPurify；图表标题和标签在 SVG 导出中转义；文件名通过 React 文本节点渲染。HTML 下载保留用户自己的 HTML，不能把这种显式导出本身算成本站 XSS。没发现业务代码中可达的 eval/new Function；SVGO 的同名解析器方法与 oxipng 不启用的多线程分支没有重复误报。PDF 字体/CMap、HEIC WASM、SQL WASM 均有本地资源路径，未发现业务对 blob/data URL 使用 fetch 导致主 CSP 阻断的路径。
- **Glass 与手机布局**：`:where(.lg)` 的默认 relative 优先级为零，不会覆盖组件的 fixed/sticky；isolation 使负 z-index 高光留在自身层内，伪元素不接收指针。Select、⌘K、文件推荐层把滚动放到内部容器，未发现本轮镜面层明显改变定位或吞点击的代码证据。手机栏、触控尺寸、折叠布局和 reduced-motion 规则已检查；375px 实际溢出、合成层表现与读屏语音仍需人工浏览器验收，不作通过声明。媒体黑底、裁剪白线、用户色板等属于内容颜色，没有把它们笼统当作深色模式错误。
- **测试强弱**：已有真实 PDF 结构/图片蒙版、MP3 编码、媒体流复制、旋转、Parquet、GBK 小文件、Markdown 净化和 StrictMode 交接测试，有实际价值。新 Select 与 DropAnywhere 缺少焦点生命周期测试；现有 settings 测试只验证设置存取，不验证工具结果随之失效；match 测试只验证分类和 ready，R11 的 HEIC 假设反而被测试固定。GBK 延迟出现、YAML 键冲突、特殊 JSON 列名、JPEG EXIF 转 PDF、越界 CropBox 都未被现有测试保护，具体补测输入已写在各条目中。
- **资源与许可**：主要引擎在 Worker 中运行，多数 URL 与 Worker 清理路径成对；ZIP 的集中主线程问题见 R12。PDF.js 返回 `none` 的自定义 FilterFactory 并不直接等于丢透明蒙版：已核对本版本 PDF.js 的 transfer map 与 luminosity CPU fallback，未据此报错。lockfile 与许可记录中的 HEIC/MPL/LAME 主要版本一致，没有发现新引入的 GPL/AGPL 顶层浏览器依赖；部署材料缺口见 R13。许可证记录还未列出 argparse 的 Python-2.0、tslib 的 0BSD 等条目，属于记录完整性细节，不另计一次相同交付问题。

## 做得好的地方

- 首页不静态加载工具引擎；PDF、HEIC、媒体与格式化器资源按需加载，单文件体积符合部署限制。
- 文件交接的目标路径隔离、StrictMode 微任务取消和任务池取消后继续调度都有明确修复与回归保护。
- PDF 默认压缩对特殊颜色/蒙版保守跳过并解释，变大时保留原文件；媒体流复制和真实 PDF 引擎测试值得保留。
- Markdown 净化、CSV 公式防护、密码/Crypto 随机数、脚本模式不记忆，以及隔离页独立 CSP 的方向正确。
- 状态提示、文件选择按钮、设置恢复和本地资源加载已有公共实现，后续修复可以集中落在共享入口。

## 处理记录（2026-10-11，Claude）

本轮修了全部 P0 和 P1（11 项）；P2、P3 留到下一轮。处理后：`npm run typecheck`、`npm test`（62 个文件、225 项）、`npm run build` 均通过。

| 编号 | 处理 | 验证 |
| --- | --- | --- |
| R01 | `usePersisted` 加第三个参数“内容字段”：只留在内存、不写本机、不算改动、恢复默认时不动。清洗的查找替换、水印文字、行前后缀、PDF 输出文件名都列进去；SQL 正文改成普通 state。启动时 `forgetLegacyContent()` 清掉旧版本已经存下的这些字段（设置本身保留）。 | `settings.test.tsx` 新增两项：输入 `customer-secret-123` 后本机存储里没有；旧键被清掉、其他设置原样。 |
| R02 | 用户 HTML 不再直接写进隔离页：隔离页里再套一层 srcdoc iframe，里层的任何跳转都要过隔离页的 `frame-src 'none'`。安全预览也走同一条路（顺带挡住 meta refresh 和链接）。隔离页响应头补了 `webrtc 'block'` 和 `X-DNS-Prefetch-Control: off`。 | 在 wrangler（带正式响应头）+ Chromium 里复现：旧隔离页下 `location.replace('/zz-…-secret-review-private-marker')` 确实到达服务器（日志有这条 GET，并且不停重载）；新隔离页下 11 种出口（自身跳转、改 href、iframe、图片、fetch、sendBeacon、meta refresh、改父页 location、window.open、点链接）和安全预览的 3 种都没有任何请求到达服务器。WebKit 里同样没有。正常脚本照常运行，页内锚点可用。 |
| R03 | 自动编码：开头 64 KB 只用来猜起点；按 UTF-8 读时整份严格解码，后面出现非法字节就整份换 GB18030 重读。手动选 UTF-8 遇到非法字节直接报错并提示改编码。 | `dataReader.test.ts`：报告里的 33000 行 + 尾部 GBK“中文”样例，自动模式读出 `中文`。 |
| R04 | YAML 用 `mapAsMap` 保留键类型，转 JSON 前检查撞名，撞了就报错并说明是哪两个键。 | `1: a / "1": b`、`null / "null"` 报错；普通映射和 `!!omap` 照常。 |
| R05 | `fromJson` 只读自身字段（`Object.hasOwn`）。 | 报告样例第二行为三个 null。 |
| R06 | SW 不再 `skipWaiting`：新版本等旧页面都关掉才激活、才清理旧分包。旧标签页取不到已下线的分包时，`vite:preloadError` 给提示，页面级失败的错误页说明“网站刚更新过，刷新一下”，都不自动刷新。 | `sw.test.ts` 在 VM 里跑真实模板：安装不调用 skipWaiting、旧缓存保留；激活后才只剩当前版本。 |
| R07 | 结果和产生它的设置绑定（code-id、格式化、时间戳、密码、清洗），设置变了旧结果就不显示、不能下载。工作台（图片、音视频、PDF）记下开始时的设置签名，中途变了就丢弃回包、停止后续。处理中“恢复默认”禁用（`useSettingsLock`，`CodeStatus`/`Status`/`DataPage`/各工作台已接）。 | `code-id/Page.test.tsx` 用真实组件：ULID 生成后点“恢复默认”，结果清空、不再显示“处理完成”。 |
| R08 | JPEG 读 EXIF 方向：3/6/8 在 PDF 里直接转着画（不重新压缩），镜像的 2/4/5/7 交给浏览器解码转正后再嵌入；页面尺寸按转正后的宽高。 | 单测覆盖方向读取与四角落点；浏览器端到端：方向 6 的 3008×2000 照片按原图尺寸导出为 1500×2256 pt 竖页，渲染结果与转正后的原图一致。 |
| R09 | 新增 `visibleBox`（裁剪框与媒体框的交集，反向坐标先摆正，不相交退回媒体框），A4 嵌入和页码定位共用。 | 报告样例（MediaBox 0–100，CropBox −50–150）嵌入后是 100×100。 |
| R10 | 新增 `isAnimated`（GIF 多帧、APNG、动画 WebP）。图片压缩和图片工作台加入动图时，在列表和画面下方说明“只处理第一帧，导出的是静态图”。 | `animated.test.ts`；浏览器里放入三帧 GIF，两处提示都出现。 |
| R11 | 压缩、图片转 PDF / PDF 合并、二维码识别在浏览器打不开 HEIC/AVIF 时改用 `decode.ts` 的 WebAssembly 解码；压缩“原格式”遇到 HEIC 存 JPEG。PDF 工具的文件选择接受 .heic。TIFF 不再按图片推荐。 | 浏览器端到端（Chromium，原生不支持 HEIC）：23 MB 的 HEIC 压到 1.7 MB；HEIC 和 JPEG 一起做成 PDF 成功。 |

## 处理记录（2026-10-11，第二轮）

P2、P3 全部处理：

- **R12**：打包移到 `src/lib/zipWorker.ts`，用 fflate 的流式 `Zip` + `ZipPassThrough` 按块读入（`src/lib/zipCore.ts`），不再同时持有全部输入的字节数组和整份 ZIP 的拷贝；同一时间只打一个包，重复点击等上一个结束。测试：3 MB 文件分块读、同名去重、空文件。
- **R13**：网站新增 `/licenses` 页（首页和工具页页脚“开源许可”），LGPL-3.0、GNU Library GPL v2（LAME）、MPL-2.0、libheif 许可全文放在 `public/licenses/`，随构建发布；测试确认页面链到的全文都存在。GPL-3.0 全文目前链到 gnu.org，未随站发布。
- **R14**：`Select` 的菜单按字段名命名（`aria-label` 取自外层 label，不含当前取值）；滚动、改窗口大小收起时，焦点原本在菜单里就还给按钮（`preventScroll`），点到别的控件时不抢焦点。测试 4 项。
- **R15**：新增 `src/lib/useModal.ts`：打开时焦点移进弹层，背后的页面设 `inert`，Tab / Shift+Tab 在弹层内循环，Esc 关闭，关闭后焦点回到打开前的元素。`DropAnywhere` 已接入，测试 3 项。
- **R16**：`--ink-2` / `--ink-3` 浅色改为 `#605E59` / `#68655F`，深色改为 `#B0ADA7` / `#A29F99`，在 bg、bg-warm、surface、surface-2、field 上都 ≥ 4.5:1；`src/lib/contrast.test.ts` 从 `styles.css` 读色值验证。
- **R17**：README 重写：注册流程改为“建文件夹自动注册”、去掉写死的工具数；部署一节写清其他托管必须配两套响应头，并给出 `curl -I` 校验方法。首页部署说明同步改了措辞。

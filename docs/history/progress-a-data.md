# A 批 · 数据工具（已完成）

更新：2026-10-11。负责范围：6 个 data 工具；没有添加清单外工具，没有改 Claude 负责的文件，没有新增 docs/requests.md 请求。

## 完成工具

- `/data/csv-viewer`：CSV/TSV 文件拖入、粘贴文件、UTF-8/GBK/GB18030/UTF-16 识别及手动覆盖；Worker 逐块读取；TextDecoder 保留跨块中文，PapaParse 处理引号/多行字段；虚拟表格、全表筛选、排序、列宽滑块、每页 50,000 行分页和直接页码，导出筛选排序结果 CSV/JSON。
- `/data/csv-json`：CSV ⇄ JSON；粘贴文本与文件导入，分隔符、表头、类型推断选项；保留前导零和超过安全整数范围的 CSV 数字文本；结果下载/复制。超长结果仅截断预览，下载/复制完整。
- `/data/excel`：读取 xlsx/xls/ods；工作表选择、虚拟预览、CSV/JSON 导出；旧版 xls 按需载入本地字符编码表。
- `/data/sql`：CSV/JSON/Excel/Parquet 导入为 SQLite 表，支持多个文件、JOIN、聚合和窗口函数；SQL 编辑与 ⌘/Ctrl+Enter；结果虚拟预览、CSV/JSON 导出；停止操作终止 Worker 并释放数据库。
- `/data/chart`：表格文件输入、自动推荐柱状/折线/散点/百分比分布饼图；调整类型、X/Y 列和标题；SVG 与 2 倍尺寸 PNG 导出；颜色随主题变量变化。
- `/data/clean`：整行去重、去空行、去首尾空格、统一大小写、字面查找替换、拆分列、选列合并；结果虚拟预览、CSV/JSON 导出；原始数据与结果分别存储，重复应用规则不会覆盖原数据。

所有数据工具具有空状态、处理/完成/失败反馈，隐私上传灯，使用本地偏好存储；公共文件导入支持首页 handoff，处理时防止交叉导入。移动端可换行布局；表格内部滚动；控件及列宽滑块触控区域不小于 36px。

## 依赖与选择

- papaparse **5.7.0**，MIT，npm time.modified 2026-08-24：成熟 CSV 解析/导出；结合原生流式 TextDecoder，解决直接按字节 Blob 切片造成的 UTF-8/GBK 边界损坏。
- @e965/xlsx **0.20.3**，Apache-2.0，npm time.modified 2024-07-19：SheetJS CE 0.20.3 镜像版本。已核对 [SheetJS 官方安装文档](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)，当前官方 CE 仍为 0.20.3；避免 npm `xlsx` 停在 0.18.5 的旧版本。用于 xlsx/xls/ods 格式覆盖；升级时应再次核对官方源与镜像维护状态。
- sql.js **1.14.2**，MIT，2026-08-19：真实 SQLite WASM，不依赖 SharedArrayBuffer，Worker 可终止，不使用 eval。
- hyparquet **1.31.3**，MIT，2026-10-08；hyparquet-compressors **1.1.2**，MIT，2026-09-18：本地 Parquet 解码，支持 Snappy/GZip/Brotli/LZ4/ZSTD 等；通过 Blob.slice 随机读取，无远端请求。
- 图表 SVG 几何、自适应虚拟表格、清洗转换规则为自写：需求范围明确，直接用浏览器 SVG/Canvas 与 React 可避免额外图表/表格大包；CSV、Excel、Parquet、SQLite 格式逻辑仍由成熟库承担。

依赖安装持有 `.npm-lock`，结束后释放。上述 JS 入口、编码表、Parquet 解码器已检查无 `eval` / `new Function`。所有资源从本站构建产物加载。CSV 导出启用公式注入防护，以 `= + - @ Tab CR` 开头的字符串会加单引号，数字类型保持数值。

## 验证

- 最终 `npm run typecheck`：通过。
- 最终 `npm test`：38 个测试文件、127 个测试通过（含并行代理的测试；数据组 7 文件、24 项）。
- 最终 `npm run build`：通过。当前首页入口 274.24 kB / gzip 88.15 kB；数据依赖独立分包，预缓存入口不含 dataClient、xlsx 或 SQL WASM。
- 数据主要分包：data Worker 26 KiB，SheetJS 355 KiB，旧 xls 编码表 433 KiB，SQLite WASM 643 KiB，均小于 25 MiB。
- 测试包含 CSV Unicode/GBK 跨块、CRLF/引号多行、类型保真、CSV 公式防护、真实 File→RPC→Worker→导出贯通、独立清洗结果、xlsx/xls/ods 真实多表往返、SQLite JOIN/聚合、Apache 真实 Parquet→SQLite、SVG 转义与负值几何。
- 按约定未做视觉自动化验收；页面视觉与 PNG 浏览器导出交互留用户人工检查。最终全站检查由主代理统一执行。

## 限制

- CSV 流式解码降低读取峰值，但筛选/排序和 SQL 数据仍保留在 Worker 内存；Excel/JSON/Parquet 转表也会占用内存，超大文件应分批。
- Excel 使用文件内公式缓存，不重新计算公式；不保留工作簿样式。CSV 编码自动识别为 UTF-8/BOM 优先、失败后 GB18030，可手动覆盖。
- 图表最多前 2,000 个有效点，柱状图最多前 100 点；饼图忽略非正数，超过 12 项聚合为“其他”；散点 X 非数字时使用行序号，页面已明示。
- SQL 多条语句只展示最后一组结果；停止会清空临时数据库。Parquet 整数超出 JS 安全范围时以字符串保留，SQLite 原生数值计算仍受引擎数值范围约束。
- 清洗拆分与合并每次选择一项，可分次导出再导入；合并追加结果列并保留原列。

# A 批第二轮 · 开发工具补充

完成于 2026-10-11。负责 `code-id`、`code-format`、原 `code-hash`/`code-color` 与 `CodeExtraResult` 的公共提示迁移。

## 新增

- `/code/id`：UUID v4、UUID v7、单调 ULID；1–10,000 条批量生成、复制、文本下载、清空；记住格式与数量。uuid 14.0.3 / ulid 3.0.2（MIT）。成熟实现负责时间位和排序规则，浏览器 Crypto 提供安全随机数；首次点击生成时动态加载。类型测试、唯一性、版本、时间与排序、无效数量测试通过。
- `/code/format`：HTML、CSS、JavaScript/JSX、TypeScript/TSX、JSON、SQL；2/4/8 缩进、Tab、建议行宽、SQL/MySQL/PostgreSQL/SQLite 方言；文件选择、拖入、粘贴、首页 handoff（通过 CodeFiles）、复制、下载、清空。Prettier 3.9.10 / sql-formatter 15.9.0（MIT），首次运行在 Worker 内按需加载所选解析器；20 秒超时终止，可手动取消，编辑输入/选项会终止旧任务。语法错误保留库提供的行列信息。上限 500 万字符、文件 10 MB，HTML 内嵌脚本和样式不单独格式化。六语言输出、格式化幂等性、SQL 字符串与方言、缩进、错误及文件类型检测均有测试。

选择理由：ID 和格式化都是常见开发工作，不需要上传。成熟库比手写解析器更能处理复杂语法；新增 meta.ts 注册，无首页工具代码引用。

## 原工具修改

- `code-hash` 移除自写 handoff 监听，调用公共 `useHandOff`；下载提示 toast。
- `CodeExtraResult` 统一复制成功/失败为公共 toast，覆盖 hash、timestamp、color。
- `code-color` 色板复制和下载统一 toast；保留取色操作过程提示。

## 依赖与安全检查

安装前执行 npm view 查询版本、修改时间、许可证：Prettier 2026-10-10，sql-formatter 2026-09-23，uuid 2026-10-10，ulid 2025-12-06；以上均 MIT。安装持有 .npm-lock，退出自动释放。
检查实际引用的 Prettier standalone 与 html/postcss/estree/typescript/babel 插件、sql-formatter ESM、uuid/ulid 浏览器产物，没有 eval/new Function。库由本地 Vite 打包，无外部请求。

## 验证

- code-id 完成后 typecheck 通过，全量 test 49 文件 / 164 项通过。
- code-format 完成后 typecheck 通过，全量 test 54 文件 / 192 项通过（同时有其他代理新增测试）。
- 批次最终 build 由主代理统一执行；没有自行做浏览器视觉验收。
- 本部分无 docs/requests.md 请求。

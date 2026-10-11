# A 第二轮 · 办公文本

完成于 2026-10-11。供主代理合入 docs/progress-a.md。

## 新增工具

- `/office/lines`：文本行处理，trim、去空行、去重（可忽略大小写）、自然升降序、倒序、前后缀。Worker 实时处理；TXT/MD/CSV/LOG 文件、拖入、粘贴、首页 handoff；设置持久化、复制/下载/清空 toast。自写：规则简短明确，使用 Set 和原生 Intl.Collator 即可，无额外依赖。限制 500 万输入字符、1000 万输出字符，文件 20 MB。
- `/office/chinese`：简体、通用繁体、台湾繁体、台湾用词、香港繁体相互转换，可交换方向并接着转换结果。Worker 中动态 import `opencc-js 1.4.2`；输入和结果区、文本文件/拖放/粘贴/handoff，记忆地区、复制/下载/清空 toast。词组词典比单字映射更适合一简多繁及地区用词。限制 200 万字符、8 MB 文件，专有名词与歧义仍需人工核对。

## 现有工具修改

- `/office/word-count`：支持 `.docx`，独立 Worker 使用已有 `fflate 0.8.3` 按块解压，只启动 `word/document.xml` 条目；`saxes 6.0.0` 校验 XML、按命名空间提取正文，保留段落/制表/换行和 XML 实体，包含表格，排除删除修订。不提取页眉、页脚、批注、图片和排版。拒绝 DTD、损坏 XML、缺少正文，限制 50 MiB 输入、20 MiB 解压正文，分小块解压并检查实际大小。
- `OfficeKit.useIncoming` 统一改为调用公共 `useHandOff`，覆盖 word-count、text-diff、case、qrcode、markdown 及两个新增工具。password、units 不接受文件。
- `OfficeKit.OutputActions` 用全站 toast 替代内联复制状态，下载给轻提示，覆盖所有使用它的办公工具；qrcode PNG/SVG 和 markdown HTML 的直接下载也接入 toast。
- 未改动 Claude 或 B 批文件；没有新增 docs/requests.md 请求。

## 选库

执行 npm view version/time.modified/license：opencc-js 1.4.2，2026-09-21 更新，MIT AND Apache-2.0；saxes 6.0.0，2023-07-28 元数据更新，ISC（成熟稳定的严格流式 XML 解析器，项目 jsdom 原已间接使用，提升为直接依赖）。均持 `.npm-lock` 安装。检查发布代码未发现 eval/new Function/fetch；不访问外部服务。OpenCC 词典仅 Worker 需要时动态加载，首页不加载。

## 验证

- 每个新增工具完成后跑 typecheck 和全量 test；DOCX 最初类型检查遇到其他代理 toast tone 错误，已报告对方并在修复后重跑通过。
- 最终 `npm run typecheck` 通过。
- 最终 `npm test`：以 /tmp/a-office-tests.log 最新统计为准（子任务结束时 54 文件、193 测试通过；同时有其他代理增加测试）。
- 新增测试覆盖 XML 实体/中文/emoji/段落/表格、删除修订、外部实体拒绝、损坏/缺失正文、大小防护；行处理选项顺序、自然排序、输出膨胀限制；OpenCC 歧义词组与台湾词汇双向转换。
- 构建和分包由主代理在合并全部并行工作后统一验证；视觉交互依约留用户人工验收。

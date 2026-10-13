import type { ToolGuide } from './types';

export const textGuides: Record<string, ToolGuide> = {
  'office-word-count': {
    summary:
      '统计中英文字数、字符数、段落、句子、阅读时间和 Token 数，支持粘贴文字及读取 TXT、Markdown、DOCX 文件。统计结果可以复制或下载。',
    steps: [
      '粘贴原文，或打开 TXT、Markdown、DOCX 文件。',
      '查看字数、结构和 Token 统计，修改原文后结果会自动更新。',
      '复制统计结果，或下载为文本文件。'
    ],
    tips: [
      'DOCX 只读取正文和表格，不含页眉、页脚与批注。',
      'Token 按 o200k 分词计算；其他分词器的结果会不同。阅读时间按每分钟 400 字或 200 词估算。'
    ],
    related: ['office-lines', 'office-text-diff', 'office-markdown']
  },
  'office-text-diff': {
    summary: '逐行比较两段文字，标出新增、删除及行内词语变化，支持打开两个文本文件并导出差异。',
    steps: [
      '分别填入原文和新文本，或打开两个文本文件。',
      '按需要开启“忽略行首尾空白”或“结果上下排”。',
      '查看差异标记，复制或下载全部差异。'
    ],
    tips: ['界面最多预览前 5000 行差异，复制和下载包含全部差异。', '差异过多导致比较超时时，请分段比较。'],
    related: ['office-lines', 'office-word-count', 'code-format']
  },
  'office-lines': {
    summary: '按行整理文本，支持去首尾空白、去空行、去重、自然排序、倒序，以及批量添加前后缀。适合处理名单、词条和一列数据。',
    steps: [
      '粘贴每行一条的文字，或打开 TXT、Markdown、CSV、LOG 文件。',
      '选择清理规则和排列方式，需要时填写每行的前缀、后缀。',
      '核对处理前后的行数，复制或下载结果。'
    ],
    tips: [
      '去重保留第一条；自然排序会把“第 2”排在“第 10”前面，前后缀最后添加。',
      '文件最多 20 MB，输入最多 500 万字符；过大的内容需要分批处理。'
    ],
    related: ['office-case', 'office-text-diff', 'data-clean']
  },
  'office-case': {
    summary: '将每行文字转换成 camelCase、PascalCase、snake_case、kebab-case、CONSTANT_CASE、Title Case、句首大写或全部大小写。',
    steps: [
      '粘贴文字，每行放一个变量名或一句文本，也可以打开文本文件。',
      '在“转换成”中选择需要的命名方式或大小写形式。',
      '查看逐行转换的结果，再复制或下载。'
    ],
    tips: ['每行独立转换，换行会保留。', '“句首大写”会先把整行转成小写，再处理行首和句末标点后的字母。'],
    related: ['office-lines', 'code-format', 'code-escape']
  },
  'office-chinese': {
    summary: '在简体中文、通用繁体、台湾繁体和香港繁体之间转换，保留标点与换行。“台湾繁体（含用词）”还能转换地区用语。',
    steps: [
      '粘贴中文，或打开 TXT、Markdown 文件。',
      '选择“原文是”和“转换成”的地区字形与用词。',
      '核对转换结果后复制或下载，需要反向转换时点“反过来转”。'
    ],
    tips: ['专有名词和一简多繁的字需要结合上下文核对。', '文件最多 8 MB，文字最多 200 万字符。'],
    related: ['office-word-count', 'office-text-diff', 'office-lines']
  },
  'office-markdown': {
    summary: '实时预览 Markdown，支持表格、任务清单和代码高亮，可复制生成的 HTML 代码或导出 HTML 文件。',
    steps: [
      '输入 Markdown，或打开 MD、Markdown、TXT 文件。',
      '在预览中检查标题、表格、清单和代码的显示效果。',
      '复制 HTML 代码，或点击“导出 HTML”保存文档。'
    ],
    tips: ['远程图片不会加载，内嵌的 data: 图片可以显示。', '“复制”得到的是 HTML 代码；普通单次换行不会自动变成段落换行。'],
    related: ['office-html', 'office-word-count', 'code-format']
  },
  'office-html': {
    summary: '预览和编辑 HTML 页面，提供手机、平板及桌面宽度，不执行脚本，下载时保留完整 HTML 代码。',
    steps: [
      '粘贴 HTML 代码，或打开 HTML、HTM、XHTML、TXT 文件。',
      '选择设备宽度，检查 HTML 和样式的显示效果。',
      '按需要全屏查看预览，或下载当前 HTML。'
    ],
    tips: [
      '预览不执行脚本，不加载外部资源，链接也无法打开。下载的 HTML 保留原代码，请自行确认后运行。',
      '文件最多 5 MB；设备预览宽于当前区域时会整体缩小。'
    ],
    related: ['office-markdown', 'code-format', 'code-escape']
  },
  'office-password': {
    summary: '批量生成随机字符密码或英文口令短语，可选择字符集、排除易混字符，并查看估计随机熵。结果支持复制和下载。',
    steps: [
      '选择“随机字符”或“口令短语”，设置长度或单词数。',
      '设置生成数量；随机字符模式下选择需要的字符种类。',
      '复制或下载结果，需要重新生成时点“换一批”。'
    ],
    tips: [
      '随机字符长度为 4–256，口令短语为 4–20 个词，一次最多生成 100 条。',
      '选中的字符种类不保证每条都出现；口令短语不能当作钱包助记词。'
    ],
    related: ['code-id', 'code-hash', 'data-random']
  },
  'office-qrcode': {
    summary: '将文字、网址或 Wi-Fi 信息生成二维码，支持颜色、纠错等级和 Logo 设置，导出 PNG 或 SVG；也能从图片识别二维码内容。',
    steps: [
      '选择“生成”并填写文本或 Wi-Fi 信息，或切到“识别图片”选择二维码图片。',
      '生成时按需要调整颜色、纠错等级和 Logo；识别时查看读取出的内容。',
      '下载生成的 PNG、SVG，或复制、下载识别结果。'
    ],
    tips: ['添加 Logo 时纠错等级固定为 H；前景和背景应有明显明暗差别。', '识别失败时换用清晰、完整的二维码图片，或先裁掉多余背景。'],
    related: ['code-url', 'image-crop', 'image-resize']
  },
  'office-units': {
    summary: '换算长度、重量、面积、体积、温度、速度、存储和时间单位，支持常见公制、英制、市制以及 KB、KiB。',
    steps: ['选择单位类别。', '输入数值，再选择原单位和目标单位。', '复制换算结果，或用“交换”继续做反向换算。'],
    tips: ['1 KB 为 1000 字节，1 KiB 为 1024 字节；月和年不参与换算。', '显示结果最多保留 13 位有效数字，温度不能低于绝对零度。'],
    related: ['code-radix', 'code-timestamp', 'data-csv-json']
  },
  'code-json': {
    summary: '校验、美化和压缩 JSON，支持 JSON 与 YAML 互转、按键名排序和常见 JSON 语法修复。输入可以是文本或文件。',
    steps: [
      '选择输入格式，再粘贴内容或打开 JSON、YAML 文件。',
      '选择输出格式、缩进和排序方式；出现修复入口时可尝试修复语法。',
      '核对结果，复制或下载对应格式的文件。'
    ],
    tips: ['语法修复后仍需核对内容，原文会保留。', 'JSON 无法表示循环引用、NaN 和 Infinity；YAML 中转成同名 JSON 键的不同键会报错。'],
    related: ['data-csv-json', 'code-format', 'code-escape']
  },
  'code-format': {
    summary: '格式化 HTML、CSS、JavaScript、JSX、TypeScript、TSX、JSON 和 SQL，支持缩进、Tab、建议行宽与 SQL 方言设置。',
    steps: [
      '粘贴代码并选择语言，或打开代码文件让工具按扩展名识别。',
      '设置缩进和建议行宽；SQL 可选择标准、MySQL、PostgreSQL 或 SQLite 方言。',
      '点击“格式化”，核对结果后复制或下载。'
    ],
    tips: ['最多处理 500 万字符、10 MB 的文件，超过 20 秒会停止。', 'HTML 内嵌的脚本和样式保持原样；SQL 关键词会转成大写。'],
    related: ['code-json', 'office-html', 'office-text-diff']
  },
  'code-base64': {
    summary: '将中文、普通文本或文件编码为 Base64，支持 URL-safe 和 data URL；也能把 Base64 还原成文字或二进制文件。',
    steps: [
      '选择“编码”或“解码”，粘贴内容或打开文件。',
      '编码时按用途选择 URL-safe 或“生成 data URL”。',
      '复制、下载文本结果；解码为二进制时下载解码后的文件。'
    ],
    tips: [
      '文本按 UTF-8 编解码，无法按 UTF-8 读取的结果会作为二进制文件提供下载。',
      '生成 data URL 时使用标准 Base64，不能同时开启 URL-safe。'
    ],
    related: ['code-escape', 'code-url', 'code-jwt']
  },
  'code-url': {
    summary: '编码或解码 URL 文字与参数值，并拆解完整网址的协议、域名、端口、路径、查询参数和片段，可编辑参数后复制新网址。',
    steps: [
      '粘贴要转换的文字，选择编码或解码。',
      '按需要切换“编码参数值”；编辑网址时在“完整 URL”中输入带协议的地址。',
      '调整路径、片段或查询参数，复制或下载处理后的结果。'
    ],
    tips: [
      '参数值编码会处理 /、?、&；处理完整网址时要按实际用途选择。',
      '网址拆解需要带协议的完整 URL，解码遇到不完整百分号编码或无效 UTF-8 会报错。'
    ],
    related: ['code-base64', 'office-qrcode', 'code-escape']
  },
  'code-escape': {
    summary: '将文本与 HTML 实体、Unicode 转义、码点转义或 JSON 字符串相互转换，支持打开文本文件并下载完整结果。',
    steps: [
      '选择 HTML 实体、\\uXXXX、\\u{…} 或 JSON 字符串格式。',
      '选择“转义”或“还原”，粘贴内容或打开文本文件。',
      '检查转换结果，复制或下载全文。'
    ],
    tips: [
      '还原 JSON 字符串时必须包含两端双引号，不能输入对象、数组或数字。',
      'Unicode 还原支持 \\uXXXX、\\u{码点}、\\xXX 和常见换行转义，不支持八进制转义。'
    ],
    related: ['code-json', 'code-base64', 'office-html']
  },
  'code-radix': {
    summary: '批量转换 2–36 进制整数，支持大整数、正负号、0b / 0o / 0x 前缀，并可设置输出字母大小写和进制前缀。',
    steps: [
      '设置输入进制和输出进制。',
      '每行输入一个整数，或打开文本文件；需要时开启字母大写和进制前缀。',
      '核对转换数量，复制或下载转换结果。'
    ],
    tips: ['只转换整数，不处理小数和补码；前缀需要与所选输入进制对应。', '每次最多 1 万行，每行最多 1 万位，超过 15 秒会停止处理。'],
    related: ['office-units', 'code-escape', 'code-base64']
  },
  'code-regex': {
    summary: '测试 JavaScript 正则表达式，实时高亮匹配、查看捕获分组和命名分组，并预览、复制或下载替换后的文本。',
    steps: [
      '输入不带两端斜杠的正则表达式，设置标志，也可以选择常用片段。',
      '粘贴测试文本，查看匹配位置与捕获分组。',
      '填写替换内容，支持 $1、$& 和命名分组引用，再复制或下载替换结果。'
    ],
    tips: ['执行超过 1.5 秒会停止；复杂表达式可先缩小文本或减少嵌套量词。', '最多列出 1 万处匹配，分组只预览前 100 处；替换仍作用于全文。'],
    related: ['office-lines', 'office-text-diff', 'code-escape']
  },
  'code-timestamp': {
    summary: '将 Unix 秒、毫秒时间戳与日期互转，支持常用时区和夏令时冲突处理，并输出 ISO 8601、RFC 2822 等时间表示。',
    steps: [
      '选择时区和夏令时冲突处理方式。',
      '输入秒或毫秒时间戳，或填写日期时间；也可点“填入当前时间”。',
      '点击对应转换按钮，复制所需的时间格式。'
    ],
    tips: [
      '不带时区的日期按所选时区解释；带 Z 或 +08:00 等偏移的日期按自身时区解释。',
      '夏令时切换可能让本地时间重复或不存在，可选择提示、取较早或取较晚。'
    ],
    related: ['code-jwt', 'code-id', 'office-units']
  },
  'code-hash': {
    summary: '计算文件或 UTF-8 文本的 MD5、SHA-1、SHA-256、SHA-512、SHA3-256、BLAKE3、CRC32，支持多算法同时计算和已有摘要比对。',
    steps: [
      '输入文字或选择一个文件。',
      '勾选要计算的算法，等待自动计算，也可以点“开始计算”。',
      '复制或下载摘要，需要比对时粘贴已有哈希值。'
    ],
    tips: [
      '文字的空格和换行参与计算；留空后手动计算可得到空文本摘要。',
      'MD5、SHA-1、CRC32 适合核对旧校验值，安全用途应选择 SHA-256 等合适算法。'
    ],
    related: ['code-base64', 'office-text-diff', 'office-password']
  },
  'code-jwt': {
    summary: '解析 JWT 的头部和载荷，显示 iat、nbf、exp 时间字段，并使用 HMAC 密钥或 SPKI PEM、JWK 公钥验证支持算法的签名。',
    steps: [
      '粘贴由三段内容组成的 JWT，查看头部、载荷和 UTC 时间字段。',
      '按签发方设置选择预期算法，填写 HMAC 密钥或公钥。',
      '点击“验证签名”，分别核对签名结果与有效期；载荷可复制或下载为 JSON。'
    ],
    tips: [
      '解析成功不代表签名有效，签名通过也需要单独核对有效期。',
      'HMAC 密钥按 UTF-8 文本使用；带 crit 或 b64=false 扩展的令牌暂不支持验签。'
    ],
    related: ['code-base64', 'code-json', 'code-timestamp']
  },
  'code-id': {
    summary: '批量生成 UUID v4、UUID v7 和 ULID，每行一个标识，可直接复制或下载为文本文件。',
    steps: ['选择 UUID v4、UUID v7 或 ULID。', '填写 1–10000 的整数数量，点击“生成”。', '复制生成结果，或下载文本文件。'],
    tips: ['UUID v7 和 ULID 包含时间信息，可按时间排序。', '这些标识用于标识数据，不应当作密码使用。'],
    related: ['office-password', 'code-timestamp', 'data-random']
  },
  'code-color': {
    summary: '转换 HEX、RGB、HSL、OKLCH 色值，计算文字和背景的 WCAG 对比度，生成同色明暗、相邻色或互补色色板并导出 CSS。',
    steps: [
      '输入颜色或使用取色器；浏览器支持时也能从屏幕取色。',
      '查看各格式色值，并填写背景色检查文字对比度。',
      '选择配色方式，点击色块复制颜色，或下载 CSS 色板。'
    ],
    tips: ['超出 sRGB 色域的颜色转成 HEX、RGB、HSL 时会裁剪，并显示提示。', '对比度按 WCAG 2.x 计算，半透明前景会先与背景合成。'],
    related: ['image-palette', 'office-html', 'image-svg']
  },
  'data-csv-viewer': {
    summary: '打开 CSV、TSV 和分隔文本，以表格浏览、搜索所有列并按列排序，可将当前筛选和排序结果导出为 CSV 或 JSON。',
    steps: [
      '设置分隔符、编码和表头选项，再选择 CSV、TSV 或 TXT 文件。',
      '在“筛选所有列”输入文字，点击列标题排序，需要时调整列宽。',
      '导出当前结果为 CSV 或 JSON。'
    ],
    tips: [
      '更改编码和分隔符只影响下次导入，已有数据需要重新读取。',
      '支持自动识别 UTF-8 / GBK，也可手动选择 GB18030、UTF-16 LE 或 UTF-16 BE。'
    ],
    related: ['data-csv-json', 'data-clean', 'data-chart']
  },
  'data-csv-json': {
    summary: '将 CSV 与 JSON 表格数据双向转换，支持文件和粘贴文本，提供分隔符、编码、表头以及数字和布尔值推断选项。',
    steps: [
      '选择转换方向，设置分隔符、编码、表头和类型推断。',
      '打开 CSV、TSV、TXT、JSON 文件，或粘贴文本后点“开始转换”。',
      '核对预览，再复制完整结果或下载目标格式。'
    ],
    tips: [
      'JSON 顶层需要是数组，数组元素须全部是对象或全部是数组；嵌套值会作为单元格文本。',
      'CSV 导出会在可能被表格软件当作公式的内容前加单引号；转换结果最多预览前 10 万字。'
    ],
    related: ['data-csv-viewer', 'code-json', 'data-excel']
  },
  'data-excel': {
    summary: '读取 XLSX、XLS 和 ODS 表格，切换工作表查看保存的数据，并将当前工作表导出为 CSV 或 JSON。',
    steps: ['选择 XLSX、XLS 或 ODS 文件。', '在“工作表”中选择需要的表，查看数据并按需要调整列宽。', '导出当前工作表为 CSV 或 JSON。'],
    tips: ['读取的是文件中保存的数值，公式使用保存的结果，不会重新计算。', '首行作为列名；导出的是数据，不保留原工作簿的排版样式。'],
    related: ['data-excel-merge', 'data-csv-json', 'data-chart']
  },
  'data-excel-merge': {
    summary: '把多人填写的表格汇总到同一份 Excel 模板，支持按关键列、已有内容匹配或全部追加，保留模板格式并列出数据冲突。',
    steps: [
      '先选择 XLSX、XLSM 或 XLTX 母模板，再添加各人填写的表格。',
      '核对表头、底部行、列对应和匹配方式，选择冲突保留规则。',
      '检查新增行、补充单元格及不一致列表，下载汇总表。'
    ],
    tips: [
      '模板原有内容不会被覆盖；两份数据写入同一空格时，按“同一格不一样”的设置决定保留值。',
      '表格只预览前 300 行、40 列，下载包含全部结果；XLSM 模板导出为 XLSM，其他模板导出为 XLSX。'
    ],
    related: ['data-excel', 'data-clean', 'data-sql']
  },
  'data-clean': {
    summary: '清理 CSV、JSON、Excel、ODS、Parquet 表格，支持去首尾空格、去空行、整行去重、统一大小写、查找替换、拆分列与合并列。',
    steps: [
      '选择表格文件，或粘贴 CSV 后点击“读取文本”。',
      '选中工作表，设置清洗规则及需要拆分或合并的列。',
      '点击“应用规则”，检查结果后导出 CSV 或 JSON。'
    ],
    tips: [
      '查找替换按字面匹配；拆分列与合并列一次只能选择一种操作。',
      '合并列会加到最后，原列保留；修改规则后需重新应用，才能导出新结果。'
    ],
    related: ['data-csv-viewer', 'data-excel-merge', 'data-sql']
  },
  'data-chart': {
    summary: '把 CSV、JSON、Excel、ODS 或 Parquet 表格制作成柱状图、折线图、饼图和散点图，可指定数据列、标题并导出 PNG 或 SVG。',
    steps: [
      '打开表格文件，选择需要绘图的工作表。',
      '选择图表类型、分类或 X 轴列、数值或 Y 轴列，填写图表标题。',
      '查看图表，导出 PNG 图片或 SVG 矢量图。'
    ],
    tips: [
      '最多绘制 2000 个点，柱状图最多 100 个。',
      '饼图只统计正数；超过 12 项时保留前 11 项，其余合为“其他”。非数字的数值单元格不参与绘图。'
    ],
    related: ['data-clean', 'data-sql', 'data-excel']
  },
  'data-sql': {
    summary: '导入 CSV、JSON、Excel、ODS 或 Parquet 后使用 SQLite 查询数据，支持多表 JOIN、GROUP BY 和窗口函数，结果可导出 CSV 或 JSON。',
    steps: [
      '选择一个或多个数据文件，逐个导入为数据表。',
      '查看表名和列名，编写 SQL，点击“运行 SQL”或按 ⌘ / Ctrl + Enter。',
      '检查查询结果，导出 CSV 或 JSON。'
    ],
    tips: ['多条 SQL 只显示最后一条的结果；查询语法使用 SQLite。', '数据保存在内存中，停止查询会清空数据库，需要重新导入文件。'],
    related: ['data-clean', 'data-csv-viewer', 'code-format']
  },
  'data-random': {
    summary: '生成指定范围的随机整数，或对名单抽签、打乱和分组，支持重复抽取、同名合并，以及结果复制与下载。',
    steps: [
      '选择随机整数、抽签、打乱或分组；名单可以粘贴或从 TXT、Markdown 文件读取。',
      '填写整数范围、抽取数量或分组数量，按需要设置重复抽取和同名合并。',
      '点击“开始生成”或“开始抽签”，复制或下载结果。'
    ],
    tips: [
      '每次最多 1 万项，名单最多 1 万行、文件最多 1 MB；整数范围包含上下限，最多容纳 2³² 个整数。',
      '关闭“合并相同名字”后，同名会视为不同的签；分组人数最多相差 1 人。'
    ],
    related: ['office-lines', 'office-password', 'code-id']
  }
};

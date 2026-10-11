export type CatId = 'office' | 'code' | 'image' | 'av' | 'pdf' | 'data';

export interface Category {
  id: CatId;
  name: string;
  led: string;
  blurb: string;
}

export interface Tool {
  id: string;
  cat: CatId;
  name: string;
  mark: string;
  desc: string;
  keywords: string;
  path: string;
  ready: boolean;
}

// 新工具在自己的文件夹里放 meta.ts（默认导出这个结构）即可出现在首页和 ⌘K；清单里已有的工具也可以用它覆盖文案
export interface ToolMeta {
  cat: CatId;
  name: string;
  mark: string;
  desc: string;
  keywords?: string;
}

// 分类的 LED 颜色沿用设计规范；顺序按常用程度
export const CATEGORIES: Category[] = [
  { id: 'office', name: '办公文本', led: '#F5A524', blurb: '日常文字活儿' },
  { id: 'pdf', name: 'PDF', led: '#F0442E', blurb: '合并、拆分、转换' },
  { id: 'image', name: '图像', led: '#22B35E', blurb: '压缩、转换、裁剪' },
  { id: 'av', name: '音视频', led: '#8B5CF6', blurb: '本地剪辑' },
  { id: 'code', name: '开发编码', led: '#3B82F6', blurb: '编解码与格式化' },
  { id: 'data', name: '数据', led: '#14A39A', blurb: '查看、转换、清洗' }
];

// 分类内的顺序，也按常用程度排。没列出的新工具排在最后
const ORDER = [
  'office-qrcode',
  'office-word-count',
  'office-chinese',
  'office-text-diff',
  'office-password',
  'office-units',
  'office-markdown',
  'office-html',
  'office-lines',
  'office-case',
  'pdf-merge',
  'pdf-compress',
  'pdf-split',
  'pdf-to-image',
  'pdf-from-image',
  'pdf-organize',
  'pdf-extract-text',
  'pdf-page-numbers',
  'pdf-extract-images',
  'image-compress',
  'image-convert',
  'image-resize',
  'image-crop',
  'image-cutout',
  'image-stitch',
  'image-watermark',
  'image-exif',
  'image-palette',
  'image-svg',
  'av-compress',
  'av-convert',
  'av-gif',
  'av-trim',
  'av-audio',
  'av-audio-edit',
  'av-frame',
  'code-json',
  'code-timestamp',
  'code-base64',
  'code-url',
  'code-format',
  'code-regex',
  'code-color',
  'code-hash',
  'code-id',
  'code-jwt',
  'code-radix',
  'code-escape',
  'data-csv-viewer',
  'data-excel',
  'data-random',
  'data-chart',
  'data-clean',
  'data-csv-json',
  'data-sql'
];

// 最常用的几个：空闲时预先下载页面代码，⌘K 没有记录时也先列它们
export const POPULAR = [
  'image-compress',
  'pdf-merge',
  'image-convert',
  'pdf-compress',
  'office-qrcode',
  'av-compress',
  'pdf-to-image',
  'code-json'
];

// 工具按文件夹自动注册：src/tools/<分类>-<路径名>/Page.tsx 存在就算已上线，不用改这个文件
const pageFiles = import.meta.glob('./tools/*/Page.tsx');
const metaFiles = import.meta.glob<{ default: ToolMeta }>('./tools/*/meta.ts', { eager: true });
const folderOf = (file: string) => file.split('/')[2];

export const PAGE_LOADERS: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pageFiles).map(([file, load]) => [folderOf(file), load])
);
const READY = new Set(Object.keys(PAGE_LOADERS));
const METAS: Record<string, ToolMeta> = Object.fromEntries(Object.entries(metaFiles).map(([file, mod]) => [folderOf(file), mod.default]));

// [分类, 路径名, 名称, 键帽字, 描述, 搜索关键词]
const RAW: [CatId, string, string, string, string, string][] = [
  ['office', 'word-count', '字数统计', '字', '中英文字数、段落与阅读时长', 'word count 字符 计数 阅读时间'],
  ['office', 'text-diff', '文本对比', '±', '逐行高亮两段文字的差异', 'diff compare 比较 差异'],
  ['office', 'case', '大小写转换', 'Aa', '驼峰、下划线、标题格式互转', 'case camel snake 驼峰 大写 小写'],
  ['office', 'qrcode', '二维码', 'QR', '生成与识别，可嵌入 Logo', 'qr code 扫码 生成'],
  ['office', 'password', '密码生成', '***', '本地随机生成，强度可调', 'password random 随机 口令'],
  ['office', 'markdown', 'Markdown 预览', 'M↓', '实时预览，导出 HTML', 'markdown md html 预览'],
  ['office', 'html', 'HTML 预览', '</>', '安全预览网页代码', 'html htm 网页 预览 渲染 页面 代码 render preview'],
  ['office', 'units', '单位换算', 'cm', '长度、重量、存储、温度', 'unit convert 换算 长度 重量 温度'],
  ['code', 'json', 'JSON 格式化', '{ }', '校验、美化、压缩、转 YAML', 'json yaml format 美化 校验'],
  ['code', 'base64', 'Base64', '64', '文本与文件互转', 'base64 encode decode 编码 解码'],
  ['code', 'url', 'URL 编解码', '%', '编码、解码、拆参数', 'url encode decode query 参数 链接'],
  ['code', 'regex', '正则测试', '.*', '实时匹配与分组高亮', 'regex regexp 正则 匹配'],
  ['code', 'jwt', 'JWT 解析', 'JWT', '查看头部、载荷与过期时间', 'jwt token 令牌 解码'],
  ['code', 'hash', '哈希计算', '#', 'MD5、SHA-1、SHA-256', 'hash md5 sha 校验 摘要'],
  ['code', 'timestamp', '时间戳', 'ts', 'Unix 时间与日期互转', 'timestamp unix time date 日期 时间'],
  ['code', 'color', '颜色转换', 'rgb', 'HEX、RGB、HSL、OKLCH', 'color hex rgb hsl oklch 颜色 色值'],
  ['image', 'compress', '图片压缩', '压', '批量压缩，画质可调', 'compress image photo jpg jpeg png webp avif 照片 缩小 体积 图片'],
  ['image', 'convert', '格式转换', '转', 'HEIC、PNG、WebP、AVIF 互转', 'convert heic png webp avif jpg 格式 图片'],
  ['image', 'resize', '尺寸调整', '尺', '按比例或像素批量缩放', 'resize scale 缩放 分辨率 图片'],
  ['image', 'crop', '裁剪', '裁', '常用比例与社交媒体尺寸', 'crop 剪裁 比例 图片'],
  ['image', 'exif', '去除 EXIF', '净', '抹掉位置与相机信息', 'exif gps metadata 隐私 位置 元数据'],
  ['image', 'watermark', '加水印', '印', '文字或图片水印，可批量', 'watermark 水印 图片'],
  ['image', 'svg', 'SVG 优化', 'svg', '去掉冗余，体积更小', 'svg svgo optimize 矢量 图标'],
  ['av', 'gif', '视频转 GIF', 'gif', '选一段，导出动图', 'gif video 动图 视频'],
  ['av', 'compress', '视频压缩', '缩', '调码率与分辨率', 'video compress mp4 码率 视频'],
  ['av', 'audio', '提取音频', '♪', '从视频里取出声音', 'audio mp3 extract 声音 音频'],
  ['av', 'trim', '截取片段', '剪', '按时间裁出一段', 'trim cut clip 剪辑 片段 视频'],
  ['av', 'frame', '视频截帧', '帧', '导出任意一帧为图片', 'frame screenshot 截图 视频'],
  ['pdf', 'merge', '合并 PDF', '合', '拖动排序，合成一份', 'pdf merge combine 合并'],
  ['pdf', 'split', '拆分 PDF', '拆', '按页码范围拆成多份', 'pdf split 拆分 页码'],
  ['pdf', 'to-image', 'PDF 转图片', '图', '每页导出为图片', 'pdf image png jpg 转图片'],
  ['pdf', 'from-image', '图片转 PDF', '册', '多张图片合成一份', 'pdf image 图片 转 pdf 扫描'],
  ['pdf', 'organize', '页面整理', '页', '旋转、删除、重新排序', 'pdf rotate delete reorder 旋转 排序'],
  ['pdf', 'compress', '压缩 PDF', '小', '减小扫描件体积', 'pdf compress 压缩 体积'],
  ['pdf', 'page-numbers', '添加页码', '12', '位置与样式可选', 'pdf page number 页码'],
  ['data', 'csv-viewer', 'CSV 查看器', '表', '大表格也能开，可排序筛选', 'csv table viewer 表格 筛选'],
  ['data', 'csv-json', 'CSV ⇄ JSON', '⇄', '两种格式互相转换', 'csv json convert 转换'],
  ['data', 'excel', 'Excel 转 CSV', 'xls', '选择工作表导出', 'excel xlsx xls csv 表格'],
  ['data', 'sql', 'SQL 查询', 'sql', '用 SQL 查表格', 'sql query sqlite duckdb 查询'],
  ['data', 'chart', '快速图表', '绘', '拖入表格，自动出图', 'chart graph 图表 可视化'],
  ['data', 'clean', '去重清洗', '洗', '去重、去空行、修正格式', 'dedupe clean 去重 清洗']
];

function build(): Tool[] {
  const planned = RAW.map(([cat, slug, name, mark, desc, keywords]): Tool => {
    const id = `${cat}-${slug}`;
    const meta = METAS[id];
    return {
      id,
      cat,
      name: meta?.name ?? name,
      mark: meta?.mark ?? mark,
      desc: meta?.desc ?? desc,
      keywords: meta?.keywords ?? keywords,
      path: `/${cat}/${slug}`,
      ready: READY.has(id)
    };
  });
  const known = new Set(planned.map((t) => t.id));
  const added = Object.entries(METAS)
    .filter(([id, meta]) => !known.has(id) && id.startsWith(meta.cat + '-'))
    .map(([id, meta]): Tool => ({
      id,
      ...meta,
      keywords: meta.keywords ?? '',
      path: `/${meta.cat}/${id.slice(meta.cat.length + 1)}`,
      ready: READY.has(id)
    }));
  const cats = CATEGORIES.map((c) => c.id);
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return [...planned, ...added].sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat) || rank(a.id) - rank(b.id));
}

export const TOOLS: Tool[] = build();

// 鼠标移上去、获得焦点或手指按下时，提前下载工具页的代码，点进去就不用转圈
const prefetched = new Set<string>();
export function prefetchTool(id: string) {
  if (prefetched.has(id) || !PAGE_LOADERS[id]) return;
  prefetched.add(id);
  PAGE_LOADERS[id]().catch(() => prefetched.delete(id));
}

export function prefetchProps(id: string) {
  const go = () => prefetchTool(id);
  return { onPointerEnter: go, onFocus: go, onTouchStart: go };
}

export function categoryOf(id: CatId): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

export function toolByPath(path: string): Tool | undefined {
  const p = path.replace(/\/+$/, '');
  return TOOLS.find((t) => t.path === p);
}

export function toolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

// 每个关键词都要命中；名字开头命中排最前；已经能用的工具优先
export function searchTools(query: string): Tool[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return TOOLS;
  const scored: { t: Tool; s: number }[] = [];
  for (const t of TOOLS) {
    const name = t.name.toLowerCase();
    const rest = `${t.desc} ${t.keywords} ${categoryOf(t.cat).name}`.toLowerCase();
    let s = 0;
    for (const w of words) {
      if (name.startsWith(w)) s += 3;
      else if (name.includes(w)) s += 2;
      else if (rest.includes(w)) s += 1;
      else {
        s = -1;
        break;
      }
    }
    if (s > 0) scored.push({ t, s: s + (t.ready ? 2 : 0) });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.t);
}

import { useId, type ReactNode } from 'react';
import type { CatId } from '../tools';
import type { Kind } from '../lib/match';

// 键帽上的工具图标、分类图标和文件类型图标：24 格，线宽 1.8，圆头圆角，颜色跟着文字（currentColor）。
// 图形表达“做什么”，分类交给旁边的 LED；同一个动作在不同分类里用同一个母题（压缩 = 箭头压向横线，转换 = 一圈箭头）。
// 新工具没画图标时，Glyph 会照常显示 meta 里的键帽字；画好后在 TOOL 里按工具 id 加一项，再到 docs/icon-preview.html 看一眼。
// cut 是从主体上挖掉的形状，给叠在最上面的小图形（top）留一圈空隙
interface Shape {
  base: ReactNode;
  cut?: ReactNode;
  top?: ReactNode;
}

// 带折角的一页纸
const PAGE = (
  <path d="M13.5 3H8a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 8 21h8a2.5 2.5 0 0 0 2.5-2.5V8zM13.5 3v3.5A1.5 1.5 0 0 0 15 8h3.5" />
);
// 一圈箭头：转换
const SYNC = <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3M17.3 2.9v3.8h-3.8M19.5 12a7.5 7.5 0 0 1-12.8 5.3M6.7 21.1v-3.8h3.8" />;
const dot = (cx: number, cy: number, r = 1.35) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const TOOL: Record<string, Shape> = {
  // ———— 办公文本 ————
  'office-qrcode': {
    base: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
        <path d="M7 7h.01M17 7h.01M7 17h.01" strokeWidth="2.8" />
        <path d="M14.5 14.5h2.5M20 14.5v.01M17 17.5v.01M20 17.5v3M14.5 20.5h.01" />
      </>
    )
  },
  // 计数的“正”字划记
  'office-word-count': { base: <path d="M6 5v14M10 5v14M14 5v14M18 5v14M3.5 15.5l17-7" /> },
  'office-chinese': {
    base: <path d="M12 2.8v2.4M4 7h16M15.6 7c-1.7 5.6-5.4 10-11.1 13.2M8.4 7c1.7 5.6 5.4 10 11.1 13.2" />
  },
  'office-text-diff': {
    base: (
      <>
        {PAGE}
        <path d="M12 9.5V14M9.75 11.75h4.5M9.75 17h4.5" />
      </>
    )
  },
  'office-password': {
    base: (
      <>
        <rect x="2.5" y="6.5" width="19" height="11" rx="3.5" />
        <path d="M18 9.5v5" />
      </>
    ),
    top: (
      <>
        {dot(6.8, 12)}
        {dot(10.3, 12)}
        {dot(13.8, 12)}
      </>
    )
  },
  'office-units': {
    base: (
      <>
        <rect x="2.5" y="7" width="19" height="10" rx="2.5" />
        <path d="M6.5 7v4M10 7v2.5M13.5 7v4M17 7v2.5" />
      </>
    )
  },
  'office-markdown': {
    base: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3.5" />
        <path d="M5.5 15V9l3 3.5 3-3.5v6M16.5 9v6M14 12.5l2.5 2.5 2.5-2.5" />
      </>
    )
  },
  'office-html': {
    base: (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="3.5" />
        <path d="M2.5 8.5h19M10 12.5l-2 2 2 2M14 12.5l2 2-2 2" />
        <path d="M5.6 6.25h.01M8.1 6.25h.01" strokeWidth="2" />
      </>
    )
  },
  'office-lines': { base: <path d="M4 6h9M4 12h6.5M4 18h4M18 5v13.5M15 15.5l3 3 3-3" /> },
  'office-case': {
    base: (
      <>
        <path d="M3 18.5L7.5 5.5l4.5 13M4.7 14h5.6" />
        <circle cx="17" cy="15" r="3.5" />
        <path d="M20.5 11.5v7" />
      </>
    )
  },

  // ———— PDF ————
  'pdf-merge': { base: <path d="M7 3.5v2.8c0 3 5 3.9 5 7.7M17 3.5v2.8c0 3-5 3.9-5 7.7v6.5M8.5 17l3.5 3.5 3.5-3.5" /> },
  'pdf-compress': { base: <path d="M12 2.8v4.5M9.2 4.7l2.8 2.6 2.8-2.6M12 21.2v-4.5M9.2 19.3l2.8-2.6 2.8 2.6M5.5 10.6h13M5.5 13.4h13" /> },
  // 一页纸沿虚线切开
  'pdf-split': {
    base: (
      <path d="M5.5 9.5v-4A2.5 2.5 0 0 1 8 3h5.5l5 5v1.5M13.5 3v3.5A1.5 1.5 0 0 0 15 8h3.5M5.5 14.5v4A2.5 2.5 0 0 0 8 21h8a2.5 2.5 0 0 0 2.5-2.5v-4M2.5 12h2M7.5 12h3M13.5 12h3M19.5 12h2" />
    )
  },
  'pdf-to-image': {
    base: (
      <>
        {PAGE}
        <path d="M5.6 18.2l4-4a1.2 1.2 0 0 1 1.7 0l4.4 4.4" />
        <circle cx="13.6" cy="12.2" r="1.4" />
      </>
    )
  },
  'pdf-from-image': {
    base: (
      <>
        <rect x="3" y="8" width="14" height="12.5" rx="3" />
        <path d="M3.4 17.6l3.6-3.6a1.2 1.2 0 0 1 1.7 0l4.6 4.6" />
        <path d="M7 4.5h11a3 3 0 0 1 3 3v9" />
      </>
    )
  },
  'pdf-organize': {
    base: (
      <>
        <rect x="4" y="3.5" width="6.5" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="6.5" height="7" rx="1.6" transform="rotate(14 16.75 7)" />
        <rect x="4" y="13.5" width="6.5" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="6.5" height="7" rx="1.6" />
      </>
    )
  },
  'pdf-extract-text': {
    base: (
      <>
        {PAGE}
        <path d="M9 11.5h6M12 11.5v6.5" />
      </>
    )
  },
  'pdf-page-numbers': {
    base: (
      <>
        {PAGE}
        <path d="M10.3 11.6l2.2-1.8v7.7" />
      </>
    )
  },
  'pdf-extract-images': {
    base: <path d="M11.5 2.5h-5A2.5 2.5 0 0 0 4 5v10a2.5 2.5 0 0 0 2.5 2.5h6A2.5 2.5 0 0 0 15 15V6zM11.5 2.5V5a1 1 0 0 0 1 1H15" />,
    cut: <rect x="8.6" y="9.6" width="14" height="12.6" rx="4" stroke="none" />,
    top: (
      <>
        <rect x="10" y="11" width="11" height="9.5" rx="2.5" />
        <path d="M10.4 18.6l2.6-2.6a1.1 1.1 0 0 1 1.6 0l3.4 3.4" />
      </>
    )
  },

  // ———— 图像 ————
  'image-compress': { base: <path d="M12 3v5M9.2 5.4l2.8 2.6 2.8-2.6M12 21v-5M9.2 18.6l2.8-2.6 2.8 2.6M4.5 12h15" /> },
  'image-convert': {
    base: (
      <>
        {SYNC}
        <path d="M8.4 15.3l2.8-3.9 1.7 2.2 1.1-1.3 1.9 3z" />
      </>
    )
  },
  'image-resize': {
    base: (
      <>
        <rect x="3" y="12" width="9" height="9" rx="2.5" />
        <path d="M3 8.5V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-2.5M12.5 11.5l4.5-4.5M12.5 7H17v4.5" />
      </>
    )
  },
  // 抠图：虚线框是去掉的背景，中间留下一个人
  'image-cutout': {
    base: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3.5" strokeDasharray="2.6 2.9" />
        <circle cx="12" cy="10" r="2.8" />
        <path d="M7 18.5c.7-2.6 2.6-4 5-4s4.3 1.4 5 4" />
      </>
    )
  },
  'image-crop': { base: <path d="M6.5 3v12.5A2.5 2.5 0 0 0 9 18h12M17.5 21V8.5A2.5 2.5 0 0 0 15 6H3" /> },
  'image-stitch': {
    base: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M12 5v14M3 16.5l3.8-3.8a1.2 1.2 0 0 1 1.7 0l5 5M13.5 15.5l2.3-2.3a1.2 1.2 0 0 1 1.7 0l3.4 3.4" />
      </>
    )
  },
  'image-watermark': {
    base: (
      <>
        <rect x="2.5" y="3.5" width="17" height="14" rx="3" />
        <circle cx="7.5" cy="8.5" r="1.5" />
        <path d="M3 15l3.8-3.8a1.2 1.2 0 0 1 1.7 0L13 15.7" />
      </>
    ),
    cut: <path d="M17.5 11c-2 2.5-3.4 4.4-3.4 6.1a3.4 3.4 0 0 0 6.8 0c0-1.7-1.4-3.6-3.4-6.1z" strokeWidth="5" />,
    top: <path d="M17.5 11c-2 2.5-3.4 4.4-3.4 6.1a3.4 3.4 0 0 0 6.8 0c0-1.7-1.4-3.6-3.4-6.1z" />
  },
  'image-exif': {
    base: (
      <>
        <path d="M12 21s-6.5-5.5-6.5-11a6.5 6.5 0 1 1 13 0c0 5.5-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
    cut: <path d="M4 4l16 16" strokeWidth="5.2" />,
    top: <path d="M4 4l16 16" />
  },
  // 吸管
  'image-palette': {
    base: <path d="M13.2 6.6l4.2 4.2M15.3 8.7l2.4-2.4a2.1 2.1 0 0 0-3-3l-2.4 2.4M14.6 9.4l-7.9 7.9-3 .9.9-3 7.9-7.9" />
  },
  // 贝塞尔曲线和锚点
  'image-svg': {
    base: (
      <>
        <path d="M5 19C7 11.5 11 7 19 5M17 5h-6" />
        <rect x="3" y="17" width="4" height="4" rx="1" />
        <rect x="17" y="3" width="4" height="4" rx="1" />
        <circle cx="9.5" cy="5" r="1.5" />
      </>
    )
  },

  // ———— 音视频 ————
  // 和图片压缩同一个母题，横过来
  'av-compress': { base: <path d="M3 12h5M5.4 9.2L8 12l-2.6 2.8M21 12h-5M18.6 9.2L16 12l2.6 2.8M12 4.5v15" /> },
  'av-convert': {
    base: (
      <>
        {SYNC}
        <path d="M10.3 9.3v5.4l4.4-2.7z" />
      </>
    )
  },
  'av-gif': {
    base: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
        <path d="M12 12c-.9-1.4-1.9-2.5-3-2.5a2.5 2.5 0 0 0 0 5c1.1 0 2.1-1.1 3-2.5s1.9-2.5 3-2.5a2.5 2.5 0 0 1 0 5c-1.1 0-2.1-1.1-3-2.5z" />
      </>
    )
  },
  'av-trim': {
    base: (
      <>
        <circle cx="6" cy="6" r="2.8" />
        <circle cx="6" cy="18" r="2.8" />
        <path d="M8.1 16.1L20 5M8.1 7.9L20 19" />
      </>
    )
  },
  'av-audio': { base: <path d="M4 10.5v3M8 7v10M12 4v16M16 8v8M20 10v4" /> },
  'av-audio-edit': { base: <path d="M6.5 5h-2v14h2M17.5 5h2v14h-2M9 10v4M12 7v10M15 9.5v5" /> },
  'av-frame': {
    base: <path d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2M10 8.8v6.4l5-3.2z" />
  },

  // ———— 开发编码 ————
  'code-json': {
    base: (
      <>
        <path d="M9 4h-.5A2.5 2.5 0 0 0 6 6.5v2.6c0 1.3-.9 2.4-2.2 2.9 1.3.5 2.2 1.6 2.2 2.9v2.6A2.5 2.5 0 0 0 8.5 20H9" />
        <path d="M15 4h.5A2.5 2.5 0 0 1 18 6.5v2.6c0 1.3.9 2.4 2.2 2.9-1.3.5-2.2 1.6-2.2 2.9v2.6a2.5 2.5 0 0 1-2.5 2.5H15" />
        <path d="M12 12h.01" strokeWidth="2.4" />
      </>
    )
  },
  'code-timestamp': {
    base: (
      <path d="M5.5 5h10A2.5 2.5 0 0 1 18 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5zM7.5 3v3.5M13.5 3v3.5M3 9.5h15" />
    ),
    cut: <circle cx="17" cy="17" r="6.6" stroke="none" />,
    top: (
      <>
        <circle cx="17" cy="17" r="4.5" />
        <path d="M17 14.8V17l1.5 1" />
      </>
    )
  },
  'code-base64': {
    base: (
      <>
        <path d="M10.2 5.5C6.8 6 4.6 9.3 4.6 15.3" />
        <circle cx="7.9" cy="15.3" r="3.3" />
        <path d="M17.5 18.6V5.5l-5 9h8" />
      </>
    )
  },
  'code-url': { base: <path d="M9 7H7.5a5 5 0 0 0 0 10H9M15 7h1.5a5 5 0 0 1 0 10H15M8.5 12h7" /> },
  // 增加缩进
  'code-format': { base: <path d="M4 5h16M4 19h16M10.5 9.7H20M10.5 14.3h6M4 9.5l2.5 2.5L4 14.5" /> },
  'code-regex': {
    base: <path d="M15.5 4v9M11.6 6.25l7.8 4.5M19.4 6.25l-7.8 4.5" />,
    top: dot(6.5, 17.5, 1.7)
  },
  'code-color': {
    base: (
      <>
        <circle cx="12" cy="9.2" r="5" />
        <circle cx="9" cy="14.4" r="5" />
        <circle cx="15" cy="14.4" r="5" />
      </>
    )
  },
  'code-hash': { base: <path d="M9.5 4l-2 16M16.5 4l-2 16M4.5 9h15.5M4 15h15.5" /> },
  'code-id': { base: <path d="M5.5 6v12M10 6v12h3a6 6 0 0 0 0-12z" /> },
  // 令牌 = 钥匙
  'code-jwt': {
    base: (
      <>
        <circle cx="8" cy="16" r="4.2" />
        <path d="M11 13l9-9M17.5 6.5L20 9M15 9l1.8 1.8" />
      </>
    )
  },
  'code-radix': {
    base: (
      <>
        <ellipse cx="8" cy="12" rx="3.5" ry="6" />
        <path d="M14 11l5.5 7M19.5 11L14 18" />
      </>
    )
  },
  'code-escape': { base: <path d="M4.5 5l5.8 13M14 9.5V15a3 3 0 0 0 6 0M20 9.5V18" /> },

  // ———— 数据 ————
  'data-csv-viewer': {
    base: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9.5h18M3 14.75h18M9.5 4v16" />
      </>
    )
  },
  // 几份表合进一张：表格右上角一个加号
  'data-excel-merge': {
    base: (
      <>
        <rect x="3" y="6" width="15" height="15" rx="2.5" />
        <path d="M3 11h15M3 16h15M8.5 6v15" />
      </>
    ),
    cut: <path d="M18.5 2v8M14.5 6h8" strokeWidth="5.2" />,
    top: <path d="M18.5 2v8M14.5 6h8" />
  },
  // 表格导出成文件
  'data-excel': {
    base: (
      <>
        <rect x="3" y="3" width="15" height="15" rx="2.5" />
        <path d="M3 8h15M3 13h15M8.5 3v15" />
      </>
    ),
    cut: <path d="M18 12.5v8M15 17.5l3 3 3-3" strokeWidth="5.2" />,
    top: <path d="M18 12.5v8M15 17.5l3 3 3-3" />
  },
  'data-random': {
    base: <rect x="4" y="4" width="16" height="16" rx="4" />,
    top: (
      <>
        {dot(8.6, 8.6)}
        {dot(12, 12)}
        {dot(15.4, 15.4)}
      </>
    )
  },
  'data-chart': { base: <path d="M4 4v13a3 3 0 0 0 3 3h13M7.5 14.5l3.5-4 3 2.5 5-6" /> },
  // 扫帚
  'data-clean': {
    base: (
      <g transform="rotate(40 12 12)">
        <path d="M12 2.5v7M9 9.5h6l2 10H7zM10.6 14.5l-.4 5M13.4 14.5l.4 5" />
      </g>
    )
  },
  'data-csv-json': { base: <path d="M4.5 8.5h14M15.5 5l3.5 3.5-3.5 3.5M19.5 15.5h-14M8.5 12L5 15.5 8.5 19" /> },
  'data-sql': {
    base: (
      <>
        <ellipse cx="10.5" cy="6" rx="6.5" ry="2.5" />
        <path d="M4 6v12c0 1.4 2.9 2.5 6.5 2.5S17 19.4 17 18V6M4 12c0 1.4 2.9 2.5 6.5 2.5S17 13.4 17 12" />
      </>
    ),
    cut: (
      <>
        <circle cx="16.5" cy="16.5" r="5.3" stroke="none" />
        <path d="M19 19l2.5 2.5" strokeWidth="5.2" />
      </>
    ),
    top: (
      <>
        <circle cx="16.5" cy="16.5" r="3.2" />
        <path d="M18.9 18.9l2.4 2.4" />
      </>
    )
  }
};

// 分类图标（手机首页的分类方块、混合列表）沿用设计稿的意思，按这套线条重画
const CAT: Record<CatId, Shape> = {
  office: { base: <path d="M5 6h14M5 10h14M5 14h9M5 18h11" /> },
  pdf: {
    base: (
      <>
        {PAGE}
        <path d="M9 12.5h6M9 16h4" />
      </>
    )
  },
  image: {
    base: (
      <>
        <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M3.5 17l4.3-4.3a1.2 1.2 0 0 1 1.7 0l6.5 6.5M14 15.5l1.8-1.8a1.2 1.2 0 0 1 1.7 0l3 3" />
      </>
    )
  },
  av: {
    base: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
        <path d="M10 9.3v5.4l4.4-2.7z" />
      </>
    )
  },
  code: { base: <path d="M9 7.5L4.5 12 9 16.5M15 7.5l4.5 4.5-4.5 4.5" /> },
  data: { base: <path d="M3.5 20h17M6 20v-7M10.5 20V6M15 20v-9M19.5 20V9" /> }
};

// 文件类型 → 图标：每种文件一个，和对应工具的图标同一个意思；颜色由调用方按分类给
const KIND: Record<Kind, Shape> = {
  image: CAT.image,
  svg: TOOL['image-svg'],
  pdf: CAT.pdf,
  video: CAT.av,
  audio: TOOL['av-audio'],
  // Excel：满格；CSV：表头 + 首列
  sheet: {
    base: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9.33h18M3 14.67h18M9 4v16M15 4v16" />
      </>
    )
  },
  table: TOOL['data-csv-viewer'],
  json: TOOL['code-json'],
  html: TOOL['office-html'],
  markdown: TOOL['office-markdown'],
  code: CAT.code,
  // Word：一页排好的文档；纯文本：几行字
  doc: {
    base: (
      <>
        {PAGE}
        <path d="M9 11.5h6M9 14.5h6M9 17.5h3.5" />
      </>
    )
  },
  text: CAT.office,
  other: { base: PAGE }
};

function Icon({ shape, size }: { shape: Shape; size: number | string }) {
  const uid = useId();
  const mask = shape.cut ? 'cut-' + uid.replace(/[^\w-]/g, '') : '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mask && (
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" stroke="none" />
            <g fill="#000" stroke="#000">
              {shape.cut}
            </g>
          </mask>
        </defs>
      )}
      <g mask={mask ? `url(#${mask})` : undefined}>{shape.base}</g>
      {shape.top}
    </svg>
  );
}

export const TOOL_ICON_IDS = Object.keys(TOOL);
export const hasToolIcon = (id: string) => id in TOOL;

// 默认 1.3em：跟着键帽的字号走（首页 17px → 22px，⌘K 15px → 20px，列表 14px → 18px）
export function ToolIcon({ id, size = '1.3em' }: { id: string; size?: number | string }) {
  const shape = TOOL[id];
  return shape ? <Icon shape={shape} size={size} /> : null;
}

export function CatIcon({ id, size = 18 }: { id: CatId; size?: number | string }) {
  return <Icon shape={CAT[id]} size={size} />;
}

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: number | string }) {
  return <Icon shape={KIND[kind]} size={size} />;
}

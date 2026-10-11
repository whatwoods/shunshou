import { toolById, type Tool } from '../tools';

// 认出文件是什么，再推荐能直接接手的工具。首页拖入、主页大卡片、手机“打开文件”、处理完的“接着用”都用这一份
export type Kind =
  'image' | 'svg' | 'pdf' | 'video' | 'audio' | 'sheet' | 'table' | 'json' | 'html' | 'markdown' | 'code' | 'doc' | 'text' | 'other';

interface KindInfo {
  noun: (n: number) => string;
  led: string;
  // 按常用程度排；只列能接收交接文件的工具
  tools: string[];
}

export const KINDS: Record<Kind, KindInfo> = {
  image: {
    noun: (n) => `${n} 张图片`,
    led: '#22B35E',
    tools: [
      'image-compress',
      'image-convert',
      'image-resize',
      'image-crop',
      'image-cutout',
      'pdf-from-image',
      'image-stitch',
      'image-watermark',
      'image-exif',
      'image-palette',
      'office-qrcode'
    ]
  },
  svg: { noun: (n) => `${n} 个 SVG`, led: '#22B35E', tools: ['image-svg'] },
  pdf: {
    noun: (n) => `${n} 份 PDF`,
    led: '#F0442E',
    tools: [
      'pdf-merge',
      'pdf-compress',
      'pdf-split',
      'pdf-to-image',
      'pdf-organize',
      'pdf-extract-text',
      'pdf-page-numbers',
      'pdf-extract-images'
    ]
  },
  video: { noun: (n) => `${n} 段视频`, led: '#8B5CF6', tools: ['av-compress', 'av-convert', 'av-gif', 'av-trim', 'av-audio', 'av-frame'] },
  audio: { noun: (n) => `${n} 段音频`, led: '#8B5CF6', tools: ['av-audio-edit', 'av-audio'] },
  sheet: { noun: (n) => `${n} 个 Excel 表格`, led: '#14A39A', tools: ['data-excel', 'data-sql', 'data-chart', 'data-clean'] },
  table: {
    noun: (n) => `${n} 个表格`,
    led: '#14A39A',
    tools: ['data-csv-viewer', 'data-csv-json', 'data-chart', 'data-sql', 'data-clean']
  },
  json: { noun: (n) => `${n} 个 JSON`, led: '#3B82F6', tools: ['code-json', 'data-csv-json', 'code-format'] },
  html: { noun: (n) => `${n} 个网页文件`, led: '#F5A524', tools: ['office-html', 'code-format', 'code-escape'] },
  markdown: { noun: (n) => `${n} 个 Markdown`, led: '#F5A524', tools: ['office-markdown', 'office-word-count', 'office-chinese'] },
  code: { noun: (n) => `${n} 个代码文件`, led: '#3B82F6', tools: ['code-format', 'code-hash'] },
  doc: { noun: (n) => `${n} 个 Word 文档`, led: '#F5A524', tools: ['office-word-count'] },
  text: {
    noun: (n) => `${n} 个文本文件`,
    led: '#F5A524',
    tools: ['office-word-count', 'office-text-diff', 'office-chinese', 'office-lines', 'office-case']
  },
  other: { noun: (n) => `${n} 个文件`, led: '#C6C4BF', tools: ['code-hash', 'code-base64'] }
};

const EXT: [Kind, string[]][] = [
  ['svg', ['svg']],
  // TIFF 只有 Safari 自己能打开，其他浏览器里图片工具都读不了，不按图片推荐
  ['other', ['tif', 'tiff']],
  ['image', ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'gif', 'bmp']],
  ['pdf', ['pdf']],
  ['video', ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi']],
  ['audio', ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'aac', 'opus']],
  ['sheet', ['xlsx', 'xls', 'ods']],
  ['table', ['csv', 'tsv', 'parquet']],
  ['json', ['json', 'jsonc', 'geojson']],
  ['html', ['html', 'htm']],
  ['markdown', ['md', 'markdown']],
  ['code', ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'sql', 'xml', 'yaml', 'yml']],
  ['doc', ['docx']],
  ['text', ['txt', 'log', 'text']]
];

export function kindOf(f: File): Kind {
  const ext = f.name.split('.').pop()?.toLowerCase() || '';
  for (const [kind, exts] of EXT) if (exts.includes(ext)) return kind;
  // 没有扩展名时再看 MIME
  if (f.type === 'image/svg+xml') return 'svg';
  if (f.type === 'image/tiff') return 'other';
  if (f.type.startsWith('image/')) return 'image';
  if (f.type === 'application/pdf') return 'pdf';
  if (f.type.startsWith('video/')) return 'video';
  if (f.type.startsWith('audio/')) return 'audio';
  if (f.type === 'application/json') return 'json';
  if (f.type === 'text/html') return 'html';
  if (f.type.startsWith('text/')) return 'text';
  return 'other';
}

export interface MatchGroup {
  kind: Kind;
  files: File[];
  title: string;
  led: string;
  tools: Tool[];
}

export interface Combo {
  tool: Tool;
  files: File[];
  title: string;
  desc: string;
  button: string;
}

const ready = (ids: string[], except?: string) => ids.map((id) => toolById(id)).filter((t): t is Tool => !!t && t.ready && t.id !== except);

// 按类型分组；except 是当前所在的工具，“接着用”里不再推荐它自己
export function matchFiles(files: File[], except?: string): { groups: MatchGroup[]; combo: Combo | null } {
  const byKind = new Map<Kind, File[]>();
  for (const f of files) {
    const k = kindOf(f);
    byKind.set(k, [...(byKind.get(k) || []), f]);
  }
  const groups = [...byKind.entries()]
    .map(([kind, list]) => ({
      kind,
      files: list,
      title: `${KINDS[kind].noun(list.length)}可以`,
      led: KINDS[kind].led,
      tools: ready(KINDS[kind].tools, except)
    }))
    .filter((g) => g.tools.length > 0);

  // 几种文件一起来时，最可能是想把它们合在一起
  const pdfs = byKind.get('pdf') || [];
  const images = byKind.get('image') || [];
  let combo: Combo | null = null;
  const merge = ready(['pdf-merge'], except)[0];
  const fromImage = ready(['pdf-from-image'], except)[0];
  if (merge && pdfs.length && (images.length || pdfs.length > 1)) {
    const both = pdfs.length && images.length;
    combo = {
      tool: merge,
      files: files.filter((f) => ['pdf', 'image'].includes(kindOf(f))),
      title: both ? '把照片和 PDF 合成一份' : `把 ${pdfs.length} 份 PDF 合成一份`,
      desc: both ? '照片自动变成 PDF 页，可拖动排序' : '按拖入顺序排好，可再调整',
      button: '开始合并'
    };
  } else if (fromImage && images.length > 1 && !pdfs.length) {
    combo = {
      tool: fromImage,
      files: images,
      title: `把 ${images.length} 张图片做成一份 PDF`,
      desc: '一张图一页，纸张和边距可调',
      button: '做成 PDF'
    };
  }
  return { groups, combo };
}

// 处理结果（Blob）变成带名字的 File，才能交给下一个工具
export function asFile(blob: Blob, name: string): File {
  return blob instanceof File && blob.name === name ? blob : new File([blob], name, { type: blob.type, lastModified: Date.now() });
}

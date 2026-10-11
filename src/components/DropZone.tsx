import type { ReactNode } from 'react';
import { pickFiles } from '../lib/files';
import { useMedia, TOUCH } from '../lib/useMedia';
import { Glass } from './Glass';
import { KindIcon } from './ToolIcon';
import { KINDS, type Kind } from '../lib/match';

const FileIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 12v6" />
    <path d="M9 15l3-3 3 3" />
  </svg>
);

// 按 accept 认出要哪类文件，拖放区就画那一类的图标、用那一类的颜色；认不出用通用的上传图标
function acceptKind(accept: string): Kind | null {
  const a = accept.toLowerCase();
  if (a.includes('pdf')) return 'pdf';
  if (a.includes('video')) return 'video';
  if (a.includes('audio')) return 'audio';
  if (a.includes('image')) return 'image';
  return null;
}

// 手机上没法拖文件：“把图片拖到这里”换成“从手机里选图片”
export function touchTitle(title: string) {
  return title.replace(/^把(.+?)拖到这里$/, '从手机里选$1');
}

// 工具页的空状态：一张卡片，拖进来或点按钮选文件
export function DropZone({
  accept,
  multiple = true,
  title,
  hint,
  button = '选择文件',
  icon,
  className = '',
  onFiles,
  children
}: {
  accept: string;
  multiple?: boolean;
  title: string;
  hint?: ReactNode;
  button?: string;
  icon?: ReactNode;
  // 'in-layout'：放在工作台左栏，占满预览区，不再限宽居中
  className?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}) {
  const touch = useMedia(TOUCH);
  const kind = acceptKind(accept);
  return (
    <div className={'dropzone ' + className}>
      <span className="dropzone-icon" style={!icon && kind ? { color: KINDS[kind].led } : undefined}>
        {icon ?? (kind ? <KindIcon kind={kind} size={32} /> : <FileIcon />)}
      </span>
      <p className="dropzone-title">{touch ? touchTitle(title) : title}</p>
      {hint && <p className="dropzone-hint">{hint}</p>}
      <button
        type="button"
        className="btn btn-lg"
        style={{ marginTop: 16 }}
        onClick={() => pickFiles(accept, multiple).then((f) => f.length && onFiles(f))}
      >
        {button}
      </button>
      {children}
    </div>
  );
}

// 拖着文件经过窗口时的提示层
export function DropOverlay({ show, title, hint }: { show: boolean; title: string; hint?: string }) {
  if (!show) return null;
  return (
    <div className="drop-overlay" aria-hidden="true">
      <Glass kind="sheet" className="drop-sheet">
        <FileIcon />
        <p className="big">{title}</p>
        <p className="small">{hint ?? '文件只在这台设备上处理'}</p>
      </Glass>
    </div>
  );
}

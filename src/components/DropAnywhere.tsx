import { useEffect, useRef } from 'react';
import { useModal } from '../lib/useModal';
import { Glass } from './Glass';
import { FileChips, FileMatch } from './FileMatch';
import { CloseIcon, Led } from './ui';

// 首页往页面别处拖入文件、或者手机上点“打开文件”之后弹出：按文件类型推荐工具，点一下就带着文件过去
export function DropAnywhere({ files, onClose }: { files: File[]; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  useModal(sheet, onClose);
  useEffect(() => {
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="anywhere"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Glass
        ref={sheet}
        as="section"
        kind="sheet"
        className="anywhere-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anywhere-title"
        tabIndex={-1}
      >
        <div className="anywhere-body">
          <div className="anywhere-head">
            <div>
              <h2 id="anywhere-title">收到 {files.length} 个文件</h2>
              <p>点一下工具，文件会一起带过去。</p>
            </div>
            <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <FileChips files={files} />
          <FileMatch files={files} />
          <div className="anywhere-foot">
            <span>
              <Led status="done" />
              只在浏览器内存里，没有上传
            </span>
            <button type="button" className="link-btn" onClick={onClose}>
              算了
            </button>
          </div>
        </div>
      </Glass>
    </div>
  );
}

import { forwardRef, type CSSProperties, type DragEvent } from 'react';
import { pickFiles } from '../lib/files';
import { FileChips, FileMatch } from './FileMatch';
import { Kbd, Led } from './ui';
import { MOD } from '../lib/useShortcuts';
import { KINDS, type Kind } from '../lib/match';
import { KindIcon } from './ToolIcon';

// 首页的主角：拖进或选任意文件，认出类型，推荐能用的工具
// 键帽上画文件类型图标（和拖入后文件列表里的同一套），小灯是分类色
const KEYS: Kind[] = ['pdf', 'image', 'video', 'sheet', 'json', 'text'];

export const HeroDrop = forwardRef<
  HTMLDivElement,
  {
    files: File[] | null;
    over: boolean;
    touch: boolean;
    onFiles: (files: File[]) => void;
    onClear: () => void;
    onOver: (over: boolean) => void;
  }
>(function HeroDrop({ files, over, touch, onFiles, onClear, onOver }, ref) {
  const pick = () => pickFiles('*/*', true).then((f) => f.length && onFiles(f));
  // 松手由页面统一接（useFileDrop），这里只负责“悬停在卡片上”的样子

  return (
    <div
      ref={ref}
      className={'hero-drop' + (over ? ' is-over' : '') + (files ? ' has-files' : '')}
      // 没有文件时整张卡片都能点（按钮仍是键盘用户的入口）
      onClick={(e) => {
        if (!files && !(e.target as Element).closest('button')) pick();
      }}
      onDragOver={(e: DragEvent) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) onOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onOver(false);
      }}
    >
      {!files ? (
        <div className="hero-drop-empty">
          <div className="hero-keys" aria-hidden="true">
            {KEYS.map((kind, i) => (
              <span key={kind} className="hero-key" style={{ '--i': i } as CSSProperties}>
                <KindIcon kind={kind} size="1.9em" />
                <span className="led" style={{ background: KINDS[kind].led, color: KINDS[kind].led }} />
              </span>
            ))}
          </div>
          <h2>{over ? '松手，看看能做什么' : touch ? '选个文件，看看能做什么' : '把任意文件拖到这里'}</h2>
          <p>自动认出类型，推荐能用的工具。</p>
          <div className="hero-drop-cta">
            <button type="button" className="btn btn-lg" onClick={pick}>
              选择文件
            </button>
            {!touch && (
              <span className="hero-paste">
                或按 <Kbd small>{MOD}</Kbd>
                <Kbd small>V</Kbd> 粘贴
              </span>
            )}
          </div>
          <p className="hero-drop-note">
            <Led status="done" />0 B 上传 · 只在浏览器里读取
          </p>
        </div>
      ) : (
        <div className="hero-drop-result">
          <div className="hero-drop-head">
            <div>
              <h2>收到 {files.length} 个文件</h2>
              <p>点一下工具，文件会一起带过去。</p>
            </div>
            <span className="hero-drop-actions">
              <button type="button" className="btn-soft btn-sm" onClick={pick}>
                换一批
              </button>
              <button type="button" className="link-btn" onClick={onClear}>
                清空
              </button>
            </span>
          </div>
          <FileChips files={files} />
          <FileMatch files={files} />
          <p className="hero-drop-note">
            <Led status="done" />
            只在浏览器内存里，关掉页面就释放
          </p>
        </div>
      )}
    </div>
  );
});

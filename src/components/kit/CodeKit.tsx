import type { ReactNode } from 'react';
import { ToolPage } from '../ToolPage';
import { CopyIcon, FileIcon, Led } from '../ui';
import { useShortcuts } from '../../lib/useShortcuts';
import { DropOverlay } from '../DropZone';
import { toolById } from '../../tools';
import { copyText, pickFiles, saveBlob } from '../../lib/files';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { useFileDrop } from '../../lib/useFileDrop';
import { useHandOff } from '../../lib/useHandOff';
import { toast } from '../Toast';
import './CodeKit.css';

export function CodeShell({ id, sub, children }: { id: string; sub: string; children: ReactNode }) {
  return (
    <ToolPage
      tool={toolById(id)!}
      sub={
        <>
          {sub}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="code-kit">{children}</div>
    </ToolPage>
  );
}
// 设置自动存到本机；改过以后工具页标题旁会出现“恢复默认”
export function useCodeSettings<T extends object>(key: string, initial: T) {
  const [value, set] = usePersisted(key, initial);
  return [value, set] as const;
}
export function CodeFiles({
  onFiles,
  accept = '.txt',
  label = '打开文件'
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  label?: string;
}) {
  useHandOff(onFiles);
  const dragging = useFileDrop(onFiles);
  return (
    <>
      <button
        type="button"
        className="btn btn-tint"
        onClick={async () => {
          const files = await pickFiles(accept, false);
          if (files.length) onFiles(files);
        }}
      >
        <FileIcon size={16} />
        {label}
      </button>
      <DropOverlay show={dragging} title="松手，打开文件" />
    </>
  );
}
export function CodeOutput({
  text,
  name = 'result.txt',
  mime = 'text/plain',
  ready = !!text,
  blob
}: {
  text: string;
  name?: string;
  mime?: string;
  ready?: boolean;
  blob?: Blob;
}) {
  function download() {
    saveBlob(blob || new Blob([text], { type: mime }), name);
    toast('已开始下载');
  }
  // 页面上有多个结果区时，第一个有结果的接管 ⌘S
  useShortcuts({ save: () => (ready ? download() : false) });
  async function copy() {
    try {
      const ok = await copyText(blob ? await blob.text() : text);
      toast(ok ? '已复制' : '复制失败，请下载或手动复制', ok ? 'done' : 'error');
    } catch {
      toast('内容太大复制不了，请下载', 'error');
    }
  }
  return (
    <div className="code-actions">
      <button className="btn-soft" disabled={!ready} onClick={copy}>
        <CopyIcon size={16} />
        复制结果
      </button>
      <button className="btn" disabled={!ready} onClick={download}>
        下载
      </button>
    </div>
  );
}
export function CodeStatus({ busy, error, ready }: { busy?: boolean; error?: string; ready?: boolean }) {
  // 处理中锁住标题旁的“恢复默认”
  useSettingsLock(!!busy);
  return (
    <p className={error ? 'code-error' : 'code-note'} role={error ? 'alert' : 'status'}>
      <Led status={error ? 'error' : busy ? 'work' : ready ? 'done' : 'idle'} />{' '}
      {error || (busy ? '正在处理…' : ready ? '处理完成' : '输入内容，结果会出现在这里')}
    </p>
  );
}

import { useEffect, useRef, useState } from 'react';

// 整个窗口都能拖入文件、也能粘贴；返回是否正在拖着文件经过，用来显示 <DropOverlay>
export function useFileDrop(onFiles: (files: File[]) => void, opts: { paste?: boolean; enabled?: boolean } = {}) {
  const { paste = true, enabled = true } = opts;
  const [dragging, setDragging] = useState(false);
  const cb = useRef(onFiles);
  cb.current = onFiles;

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer!.files);
      if (files.length) cb.current(files);
    };
    const onPaste = (e: ClipboardEvent) => {
      // 正在输入框里粘贴文字时不拦
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        e.preventDefault();
        cb.current(files);
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    if (paste) window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', onPaste);
    };
  }, [paste, enabled]);

  return dragging;
}

import { useEffect, useRef } from 'react';
import { takeHandOff } from './store';

// 工具页接住从首页（拖入、示例图）或 ⌘K 带过来的文件。挂载时取一次，已经在页面上时靠事件再取。
// 挂载时的那次放到微任务里：StrictMode 会先清理再重放 effect，直接取会把文件交给马上被清理的那次挂载
export function useHandOff(onFiles: (files: File[]) => void) {
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    let alive = true;
    const take = () => {
      if (!alive) return;
      const files = takeHandOff();
      if (files.length) cb.current(files);
    };
    queueMicrotask(take);
    window.addEventListener('shunshou:handoff', take);
    return () => {
      alive = false;
      window.removeEventListener('shunshou:handoff', take);
    };
  }, []);
}

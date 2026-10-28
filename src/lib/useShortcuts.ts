import { useEffect, useRef } from 'react';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

// 工具页通用快捷键：⌘/Ctrl + Enter 开始处理，⌘/Ctrl + S 下载结果，Esc 取消正在进行的处理，
// ⌘/Ctrl + Z 撤回、⇧⌘Z / Ctrl + Y 重做（焦点在输入框里时归输入框自己）。
// 处理函数返回 false 表示这次不处理（比如还没有结果），按键交还给浏览器
type Handler = (() => void | boolean) | undefined;

export function useShortcuts(handlers: { run?: Handler; save?: Handler; cancel?: Handler; undo?: Handler; redo?: Handler }) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      // ⌘K 搜索面板打开时，按键归它
      if (document.querySelector('.palette')) return;
      let fn: Handler;
      if (mod && !e.shiftKey && !e.altKey && e.key === 'Enter') fn = ref.current.run;
      else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') fn = ref.current.save;
      else if (e.key === 'Escape' && !mod) fn = ref.current.cancel;
      else if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || (!isMac && !e.shiftKey && e.key.toLowerCase() === 'y'))) {
        if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
        fn = e.shiftKey || e.key.toLowerCase() === 'y' ? ref.current.redo : ref.current.undo;
      }
      if (!fn) return;
      if (fn() === false) return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

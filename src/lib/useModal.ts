import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 轻提示、读屏播报这类实时区域不能跟着变 inert，否则弹层开着时什么都播不出来
const isLive = (el: Element) =>
  el.matches('[aria-live], [role="status"], [role="alert"]') || !!el.querySelector('[aria-live], [role="status"], [role="alert"]');

// 模态层的焦点：打开时移进来，Tab / Shift+Tab 在里面转圈，背后的页面设为 inert（点不到、读屏也跳过），
// 关闭时还给打开前的元素。移焦点都不滚页面（见 AGENTS.md 无障碍一条）
export function useModal(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  // onClose 每次渲染可能是新函数；只在挂载时接管一次焦点，不因它重来
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const prev = document.activeElement as HTMLElement | null;
    // 从弹层往上一路到 body，把每一层的兄弟节点设为 inert
    const inerted: HTMLElement[] = [];
    for (let n: HTMLElement | null = box; n && n !== document.body; n = n.parentElement)
      for (const sib of Array.from(n.parentElement?.children ?? []))
        if (sib !== n && sib instanceof HTMLElement && !sib.inert && sib.tagName !== 'SCRIPT' && !isLive(sib)) {
          sib.inert = true;
          inerted.push(sib);
        }
    box.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return e.preventDefault();
      const first = items[0],
        last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === box)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      for (const el of inerted) el.inert = false;
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, [ref]);
}

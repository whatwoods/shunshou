import { useSyncExternalStore } from 'react';

// 跟着媒体查询变化重新渲染，比如手机宽度、触屏
// 测试环境等没有 matchMedia 的地方一律当作不匹配
const supported = () => typeof matchMedia === 'function';
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (l) => {
      if (!supported()) return () => {};
      const m = matchMedia(query);
      m.addEventListener('change', l);
      return () => m.removeEventListener('change', l);
    },
    () => supported() && matchMedia(query).matches
  );
}

export const PHONE = '(max-width: 640px)';
// 主要靠手指操作的设备：没有悬停，也就没有拖放和快捷键
export const TOUCH = '(hover: none) and (pointer: coarse)';

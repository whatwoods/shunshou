import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Glass } from './Glass';
import { Led } from './ui';

// 轻提示：toast('已复制')。在页面底部浮起一枚玻璃胶囊，两秒后消失
interface Item {
  id: number;
  text: ReactNode;
  tone: 'done' | 'error' | 'work';
  leaving: boolean;
}

let items: Item[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: ReactNode, tone: Item['tone'] = 'done', ms = 2200) {
  const id = ++seq;
  items = [...items.slice(-2), { id, text, tone, leaving: false }];
  emit();
  setTimeout(() => {
    items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    emit();
    setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 200);
  }, ms);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => items
  );
  // 读屏软件只念最新的一条
  const [said, setSaid] = useState('');
  useEffect(() => {
    const last = list[list.length - 1];
    if (last && typeof last.text === 'string') setSaid(last.text);
  }, [list]);

  return (
    <>
      <div className="toaster">
        {list.map((t) => (
          <Glass key={t.id} kind="sheet" className={'toast' + (t.leaving ? ' is-leaving' : '')}>
            <Led status={t.tone} />
            {t.text}
          </Glass>
        ))}
      </div>
      <div className="sr" role="status" aria-live="polite">
        {said}
      </div>
    </>
  );
}

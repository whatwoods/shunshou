import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { load, save } from './store';

// 工具设置：自动存到本机，下次打开还在。
// 每个设置都登记到这里，工具页标题旁的“恢复默认”按钮据此判断要不要出现、点了重置哪些
interface Entry {
  changed: boolean;
  reset: () => void;
}
const entries = new Map<symbol, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

// 只比较默认值里有的键：旧版本存下的多余字段不算改动；用户内容不算设置
function differs<T extends object>(value: T, defaults: T, skip: readonly PropertyKey[]): boolean {
  return Object.keys(defaults).some(
    (k) => !skip.includes(k) && JSON.stringify(value[k as keyof T]) !== JSON.stringify(defaults[k as keyof T])
  );
}
const NONE: readonly never[] = [];

// content：属于用户内容的字段（查找替换的词、水印文字、行前后缀、输出文件名……）。
// 它们照常放在返回值里，但只留在内存：不写进本机、读的时候忽略旧版本存下的值、不算“改过的设置”，恢复默认时也保持不动
export function usePersisted<T extends object>(key: string, defaults: T, content: readonly (keyof T)[] = NONE) {
  const [value, setValue] = useState<T>(() => {
    const stored = { ...load(key, defaults) };
    for (const k of content) stored[k] = defaults[k];
    return stored;
  });
  // 默认值常常是每次渲染新建的对象，按内容记一份
  const fallback = useRef(defaults);
  fallback.current = defaults;
  const skip = useRef(content);
  skip.current = content;
  useEffect(() => {
    const kept = { ...value };
    for (const k of skip.current) delete kept[k];
    save(key, kept);
  }, [key, value]);

  const reset = useCallback(
    () =>
      setValue((v) => {
        const next = { ...fallback.current };
        for (const k of skip.current) next[k] = v[k];
        return next;
      }),
    []
  );
  const changed = differs(value, defaults, content);
  const id = useRef(Symbol(key));
  useEffect(() => {
    entries.set(id.current, { changed, reset });
    emit();
  }, [changed, reset]);
  useEffect(() => {
    const me = id.current;
    return () => {
      entries.delete(me);
      emit();
    };
  }, []);

  return [value, setValue, reset] as const;
}

// 当前页面有没有改过的设置；有就返回一个全部恢复默认的函数
export function useSettingsReset(): (() => void) | null {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => version
  );
  const changed = [...entries.values()].filter((e) => e.changed);
  return changed.length ? () => changed.forEach((e) => e.reset()) : null;
}

// 正在处理时锁住“恢复默认”：处理中的任务是按旧设置跑的，这时改设置只会让结果和设置对不上
const locks = new Set<symbol>();
export function useSettingsLock(busy: boolean) {
  const id = useRef(Symbol('lock'));
  useEffect(() => {
    const me = id.current;
    if (!busy) return;
    locks.add(me);
    emit();
    return () => {
      locks.delete(me);
      emit();
    };
  }, [busy]);
}
export function useSettingsLocked(): boolean {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => version
  );
  return locks.size > 0;
}

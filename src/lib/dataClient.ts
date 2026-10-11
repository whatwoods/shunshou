import { useEffect, useRef, useState } from 'react';
export function useDataRpc(factory: () => Worker = () => new Worker(new URL('./dataWorker.ts', import.meta.url), { type: 'module' })) {
  const worker = useRef<Worker | null>(null);
  const callbacks = useRef(new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>());
  const nextId = useRef(0);
  const [progress, setProgress] = useState('');
  const factoryRef = useRef(factory);
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    callbacks.current.forEach((cb) => cb.reject(new Error('处理已取消，请重新导入。')));
    callbacks.current.clear();
  }
  function call<T>(message: object): Promise<T> {
    setProgress('');
    if (!worker.current) {
      const w = factoryRef.current();
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (data.progress) {
          setProgress(data.progress);
          return;
        }
        const cb = callbacks.current.get(data.id);
        callbacks.current.delete(data.id);
        if (data.error) cb?.reject(new Error(data.error));
        else cb?.resolve(data.value);
      };
      w.onerror = (e) => {
        callbacks.current.forEach((cb) => cb.reject(new Error(e.message || '处理线程异常，请重新导入文件。')));
        callbacks.current.clear();
        w.terminate();
        worker.current = null;
      };
    }
    const id = ++nextId.current;
    return new Promise<T>((resolve, reject) => {
      callbacks.current.set(id, { resolve: (value) => resolve(value as T), reject });
      worker.current!.postMessage({ ...message, id });
    });
  }
  useEffect(() => () => stop(), []);
  return { call, stop, progress };
}

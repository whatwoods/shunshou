import type { PdfRequest } from './types';

export class PdfClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private seq = 0;
  private error: Error | null = null;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  onProgress?: (text: string) => void;
  constructor() {
    this.worker.onmessage = ({ data }) => {
      if (data.progress) {
        this.onProgress?.(data.progress);
        return;
      }
      const pending = this.pending.get(data.key);
      this.pending.delete(data.key);
      if (data.error) pending?.reject(new Error(data.error));
      else pending?.resolve(data.result);
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.fail(new Error('PDF 处理进程没有启动，请更新浏览器后重试'));
    };
  }
  request<T>(request: PdfRequest): Promise<T> {
    if (this.error) return Promise.reject(this.error);
    const key = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(key, { resolve: (v) => resolve(v as T), reject });
      this.worker.postMessage({ key, request });
    });
  }
  private fail(error: Error) {
    this.error = error;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  dispose() {
    this.worker.terminate();
    this.fail(new Error('处理已取消'));
  }
}

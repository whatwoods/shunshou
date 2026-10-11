import type { AvRequest } from './types';
export class AvClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private next = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; progress?: (value: number) => void }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const task = this.pending.get(data.id);
      if (!task) return;
      if ('progress' in data) {
        task.progress?.(data.progress);
        return;
      }
      this.pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.result);
    };
    this.worker.onerror = () => this.fail('处理意外停止了，请重新选文件再试。');
    this.worker.onmessageerror = () => this.fail('结果读不出来，请重新选文件再试。');
  }
  request<T>(request: AvRequest, progress?: (value: number) => void): Promise<T> {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, progress });
      try {
        this.worker.postMessage({ ...request, id });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  private fail(message: string) {
    for (const task of this.pending.values()) task.reject(new Error(message));
    this.pending.clear();
  }
  dispose() {
    this.worker.terminate();
    this.fail('已取消处理。');
  }
}

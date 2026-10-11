import type { Job, JobResult } from './types';

interface Slot {
  worker: Worker;
  job: Job | null;
}

// 几个 Worker 并行处理队列；设置一变就整组换掉，不等旧任务跑完
export class Pool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));

  constructor(
    private onStart: (job: Job) => void,
    private onResult: (res: JobResult) => void
  ) {}

  submit(jobs: Job[], first?: string) {
    const ids = new Set(jobs.map((j) => j.id));
    this.queue = this.queue.filter((j) => !ids.has(j.id)).concat(jobs);
    if (first) this.prioritize(first);
    this.pump();
  }

  prioritize(id: string) {
    const i = this.queue.findIndex((j) => j.id === id);
    if (i > 0) this.queue.unshift(...this.queue.splice(i, 1));
  }

  cancel(id: string) {
    this.queue = this.queue.filter((j) => j.id !== id);
    const slot = this.slots.find((s) => s.job?.id === id);
    if (slot) {
      this.kill(slot);
      // 腾出的位置要接着派活，不然排队的任务会一直等
      this.pump();
    }
  }

  reset() {
    this.queue = [];
    for (const slot of [...this.slots]) if (slot.job) this.kill(slot);
  }

  dispose() {
    this.queue = [];
    for (const slot of this.slots) slot.worker.terminate();
    this.slots = [];
  }

  private kill(slot: Slot) {
    slot.worker.terminate();
    this.slots = this.slots.filter((s) => s !== slot);
  }

  private spawn(): Slot {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'image-compress' });
    const slot: Slot = { worker, job: null };
    worker.onmessage = (e: MessageEvent<JobResult>) => {
      slot.job = null;
      this.onResult(e.data);
      this.pump();
    };
    worker.onerror = (e) => {
      e.preventDefault();
      const job = slot.job;
      this.kill(slot);
      if (job) this.onResult({ id: job.id, gen: job.gen, ok: false, error: '处理时出错了：' + (e.message || '编码器没能启动') });
      this.pump();
    };
    this.slots.push(slot);
    return slot;
  }

  private pump() {
    while (this.queue.length > 0) {
      let slot = this.slots.find((s) => !s.job);
      if (!slot) {
        if (this.slots.length >= this.size) return;
        slot = this.spawn();
      }
      const job = this.queue.shift()!;
      slot.job = job;
      this.onStart(job);
      slot.worker.postMessage(job);
    }
  }
}

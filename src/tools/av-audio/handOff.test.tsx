// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { handOff } from '../../lib/store';
import AvWorkbench from '../../components/kit/AvWorkbench';
import type { AvRequest } from '../../lib/av/types';
vi.mock('../../components/ToolPage', () => ({ ToolPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/DropZone', () => ({ DropZone: () => <div>选择文件</div>, DropOverlay: () => null }));
class TestWorker {
  static loads: File[] = [];
  static instances: TestWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  terminated = false;
  constructor() {
    TestWorker.instances.push(this);
  }
  postMessage(request: AvRequest & { id: number }) {
    if (request.kind !== 'load') return;
    TestWorker.loads.push(request.file);
    queueMicrotask(() => {
      if (!this.terminated)
        this.onmessage?.({
          data: {
            id: request.id,
            result: { duration: 1, width: 0, height: 0, fps: 0, hasAudio: true, hasVideo: false, audioCodec: 'pcm-s16', videoCodec: '' }
          }
        });
    });
  }
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it('StrictMode 首页交接只加载一次，清理探测后仍显示成功读取的文件', async () => {
  TestWorker.loads = [];
  TestWorker.instances = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Worker', TestWorker);
  // 设置区的分段按钮用 ResizeObserver 摆放滑块，jsdom 没有
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:test';
      }
      static revokeObjectURL() {}
    }
  );
  const file = new File(['audio'], '来自首页.wav', { type: 'audio/wav' });
  handOff([file]);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <AvWorkbench mode="audio" />
      </StrictMode>
    );
  });
  expect(TestWorker.loads).toEqual([file]);
  expect(TestWorker.instances).toHaveLength(1);
  expect(TestWorker.instances[0].terminated).toBe(false);
  expect(container.textContent).toContain('来自首页.wav');
  expect(container.textContent).toContain('音频 pcm-s16');
  expect(container.textContent).toContain('输出设置');
  expect(container.textContent).not.toContain('正在读取');
  await act(async () => root.unmount());
  expect(TestWorker.instances[0].terminated).toBe(true);
});

// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const { handlers } = vi.hoisted(() => ({ handlers: { add: undefined as ((files: File[]) => void) | undefined } }));
vi.mock('../../lib/useHandOff', () => ({
  useHandOff: (add: (files: File[]) => void) => {
    handlers.add = add;
  }
}));
vi.mock('../../lib/image/animated', () => ({ isAnimated: async () => false }));
vi.mock('../../components/ToolPage', () => ({ ToolPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/Glass', () => ({ Glass: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../components/FileMatch', () => ({ NextSteps: () => <div data-testid="next-steps" /> }));
vi.mock('../../tools', () => ({ toolById: () => ({ id: 'image-cutout' }) }));
import Page from './Page';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
});

it('修改抠图导出背景后，旧文件立即失效，等待新背景合成完成', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  let active!: { onmessage?: (event: { data: unknown }) => void };
  let job!: { id: string };
  vi.stubGlobal(
    'Worker',
    class {
      onmessage?: (event: { data: unknown }) => void;
      constructor() {
        active = this;
      }
      postMessage(value: { id: string }) {
        job = value;
      }
      terminate() {}
    }
  );
  URL.createObjectURL = vi.fn(() => 'blob:cutout');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ close() {} }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {},
    drawImage() {}
  } as unknown as CanvasRenderingContext2D);
  let finish: BlobCallback | undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    finish = callback;
  });
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  const button = (text: string) => [...document.querySelectorAll('button')].find((node) => node.textContent?.includes(text));
  await act(async () => root.render(<Page />));
  await act(async () => handlers.add!([new File(['png'], 'photo.png', { type: 'image/png' })]));
  await act(async () => button('开始抠图')!.click());
  await act(async () =>
    active.onmessage!({ data: { id: job.id, ok: true, blob: new Blob(['cut'], { type: 'image/png' }), width: 10, height: 10, box: null } })
  );
  expect(document.querySelector('[data-testid="next-steps"]')).not.toBeNull();
  await act(async () => button('白色')!.click());
  expect(document.querySelector('[data-testid="next-steps"]')).toBeNull();
  expect(button('下载')?.disabled).toBe(true);
  expect(finish).toBeDefined();
  await act(async () => finish!(new Blob(['white'], { type: 'image/png' })));
  expect(document.querySelector('[data-testid="next-steps"]')).not.toBeNull();
  expect(button('下载')?.disabled).toBe(false);
  await act(async () => root.unmount());
});

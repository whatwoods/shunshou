// @vitest-environment jsdom
import { act, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { Job } from '../../lib/image/types';

const { handlers } = vi.hoisted(() => ({ handlers: { add: undefined as ((files: File[]) => void) | undefined } }));
vi.mock('../../lib/useHandOff', () => ({
  useHandOff: (add: (files: File[]) => void) => {
    handlers.add = add;
  }
}));
vi.mock('../../lib/image/animated', () => ({ isAnimated: async () => false }));
vi.mock('../../components/ToolPage', () => ({ ToolPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/Glass', () => ({ Glass: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../components/Select', () => ({ Select: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} /> }));
vi.mock('../../tools', () => ({ toolById: () => ({ id: 'image-crop' }) }));
import { ImageWorkbench } from '../../components/kit/ImageWorkbench';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
});

it('裁剪预览保留完整原图，使框选坐标与导出坐标一致', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  const posted: Job[] = [];
  vi.stubGlobal(
    'Worker',
    class {
      postMessage(job: Job) {
        posted.push(job);
      }
      terminate() {}
    }
  );
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  await act(async () => root.render(<ImageWorkbench mode="crop" />));
  await act(async () => handlers.add!([new File(['png'], 'photo.png', { type: 'image/png' })]));
  expect(posted).toHaveLength(1);
  expect(posted[0].settings).toMatchObject({ x: 0, y: 0, cropWidth: 100, cropHeight: 100, cropPixels: 0 });
  expect(document.querySelector<HTMLInputElement>('input[value="80"]')).not.toBeNull();
  const selects = document.querySelectorAll('select');
  await act(async () => {
    selects[1].value = '1';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
  });
  const image = document.querySelector('.image-kit-preview img')!;
  Object.defineProperties(image, { naturalWidth: { value: 200 }, naturalHeight: { value: 100 } });
  await act(async () => image.dispatchEvent(new Event('load')));
  const numbers = [...document.querySelectorAll<HTMLInputElement>('input[type="number"]')];
  expect(numbers.map((input) => Number(input.value))).toEqual([25, 0, 50, 100]);
  await act(async () => {
    selects[2].value = '1080x1440';
    selects[2].dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(selects[2].value).toBe('1080x1440');
  await act(async () => root.unmount());
});

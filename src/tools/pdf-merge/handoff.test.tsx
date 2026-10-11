// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { handOff } from '../../lib/store';
const { requests } = vi.hoisted(() => ({ requests: vi.fn() }));
vi.mock('../../lib/pdf/client', () => ({
  PdfClient: class {
    onProgress?: (text: string) => void;
    request(data: { op: string; id?: string; file?: File }) {
      requests(data);
      return Promise.resolve({ id: data.id, name: data.file?.name, size: 100, count: 1, image: false });
    }
    dispose() {}
  }
}));
vi.mock('../../components/ToolPage', () => ({ ToolPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/Glass', () => ({ Glass: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../../tools', () => ({ toolById: () => ({ id: 'pdf-merge' }) }));
import { PdfWorkbench } from '../../components/kit/PdfWorkbench';
afterEach(() => {
  vi.unstubAllGlobals();
  requests.mockClear();
  document.body.innerHTML = '';
});
it('receives the handoff once after StrictMode remount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  handOff([new File(['pdf'], 'handed-off.pdf', { type: 'application/pdf' })]);
  await act(async () => {
    root.render(
      <StrictMode>
        <PdfWorkbench mode="merge" />
      </StrictMode>
    );
  });
  expect(requests.mock.calls.filter(([request]) => request.op === 'load')).toHaveLength(1);
  expect(document.body.textContent).toContain('handed-off.pdf');
  await act(async () => root.unmount());
});

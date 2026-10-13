// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSettingsReset } from '../../lib/settings';
import CsvJson from './Page';
import RandomPage from '../data-random/Page';

vi.mock('../../components/ToolPage', () => ({
  ToolPage: ({ children }: { children: ReactNode }) => {
    const reset = useSettingsReset();
    return (
      <main>
        {reset && <button onClick={reset}>恢复默认</button>}
        {children}
      </main>
    );
  }
}));
vi.mock('../../components/kit/DataKit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/kit/DataKit')>();
  return {
    ...actual,
    DataImport: ({ onFile }: { onFile: (file: File) => void }) => (
      <button onClick={() => onFile(new File(['[{"name":"小顺"}]'], 'test.json'))}>导入测试 JSON</button>
    )
  };
});
class TestWorker {
  onmessage?: (event: { data: unknown }) => void;
  postMessage(request: { id: number; action: string }) {
    queueMicrotask(() =>
      this.onmessage?.({
        data: {
          id: request.id,
          value: request.action === 'export' ? { blob: new Blob(['name\r\n小顺']), preview: 'name\r\n小顺', truncated: false } : []
        }
      })
    );
  }
  terminate() {}
}
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.replaceChildren();
});
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
it('JSON 文件转 CSV 后恢复默认，旧 CSV 不会被当成 JSON 下载', async () => {
  await act(async () => root.render(<CsvJson />));
  await click('导入测试 JSON');
  expect(container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!.value).toContain('小顺');
  await click('恢复默认');
  expect(container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!.value).toBe('');
  const download = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('下载 JSON'));
  expect(download?.disabled).toBe(true);
});
it('随机工具恢复默认后撤掉原范围的结果', async () => {
  localStorage.setItem(
    'shunshou:data-random',
    JSON.stringify({ mode: 'integer', min: '500', max: '500', count: '1', groups: '2', replacement: false, deduplicate: true })
  );
  await act(async () => root.render(<RandomPage />));
  await click('开始生成');
  expect(container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!.value).toBe('500');
  await click('恢复默认');
  expect(container.querySelector<HTMLTextAreaElement>('textarea[readonly]')!.value).toBe('');
  expect([...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === '下载结果')?.disabled).toBe(true);
});

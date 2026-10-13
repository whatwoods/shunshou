// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useDataWorkspace } from './dataWorkspace';

const rpc = vi.hoisted(() => {
  const pending: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  return {
    pending,
    call: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    stop: () => pending.splice(0).forEach((task) => task.reject(new Error('处理已取消'))),
    progress: ''
  };
});
vi.mock('./dataClient', () => ({ useDataRpc: () => rpc }));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.replaceChildren();
});
it('取消导出后立即导入，旧任务不能清除新任务的忙碌状态或回填错误', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let workspace!: ReturnType<typeof useDataWorkspace>;
  function Harness() {
    workspace = useDataWorkspace('data-excel');
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Harness />));
  await act(async () => {
    void workspace.exportFile('csv');
    workspace.cancel();
    void workspace.ingest({ text: 'name\n小顺', format: 'csv' });
  });
  expect(workspace.busy).toBe(true);
  expect(workspace.error).toBe('');
  await act(async () => {
    rpc.pending.shift()!.resolve([{ name: '数据', columns: ['name'], count: 1, numeric: [] }]);
  });
  expect(workspace.busy).toBe(false);
  expect(workspace.selected?.count).toBe(1);
  await act(async () => root.unmount());
});

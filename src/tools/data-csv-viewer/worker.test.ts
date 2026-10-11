import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { dataDefaults, importRequest } from '../../lib/dataCore';
import type { TableView } from '../../lib/dataWorker';
const replies: Array<{ id: number; value?: unknown; error?: string }> = [];
const scope = {
  onmessage: undefined as undefined | ((event: MessageEvent) => Promise<void>),
  postMessage: (reply: { id: number; value?: unknown; error?: string }) => replies.push(reply)
};
beforeAll(async () => {
  vi.stubGlobal('self', scope);
  await import('../../lib/dataWorker');
});
afterAll(() => vi.unstubAllGlobals());
let id = 0;
async function request<T>(message: object): Promise<T> {
  const current = ++id;
  await scope.onmessage!(new MessageEvent('message', { data: { ...message, id: current } }));
  const reply = replies.filter((r) => r.id === current).at(-1)!;
  if (reply.error) throw new Error(reply.error);
  return reply.value as T;
}
it('真实 File 经导入协议、Worker 筛选与导出完整贯通', async () => {
  const file = new File(['姓名,数量\n小顺,2\n朋友,1'], 'test.csv');
  await request(importRequest(file, { ...dataDefaults, infer: true }));
  const result = await request<TableView>({
    action: 'view',
    sheet: '数据',
    start: 0,
    limit: 35,
    options: { filter: '小顺', sort: 1, descending: false }
  });
  expect(result.rows).toEqual([['小顺', 2]]);
  const output = await request<{ blob: Blob }>({ action: 'export', sheet: '数据', format: 'json' });
  expect(JSON.parse(await output.blob.text())).toHaveLength(2);
});
it('清洗结果保存在独立区域，重复应用保留原值', async () => {
  await request({ action: 'text', text: 'a\n A \na', format: 'csv', options: dataDefaults });
  const { cleanDefaults } = await import('../../lib/dataCore');
  await request({ action: 'clean', sheet: '数据', options: { ...cleanDefaults, casing: 'lower' } });
  const result = await request<TableView>({
    action: 'view',
    cleaned: true,
    sheet: '数据',
    start: 0,
    limit: 35,
    options: { filter: '', sort: -1, descending: false }
  });
  expect(result.rows).toEqual([['a']]);
  const original = await request<TableView>({
    action: 'view',
    sheet: '数据',
    start: 0,
    limit: 35,
    options: { filter: '', sort: -1, descending: false }
  });
  expect(original.rows).toEqual([[' A '], ['a']]);
});

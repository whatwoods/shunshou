// @vitest-environment jsdom
// 工具设置：自动存本机；改过之后“恢复默认”出现，点了全部还原，按钮随之消失
import { afterEach, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { usePersisted, useSettingsReset } from './settings';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('设置自动保存，“恢复默认”只在改过时出现', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.setItem('shunshou:demo-b', JSON.stringify({ level: 'H', legacy: 1 }));
  const api: {
    a?: ReturnType<typeof usePersisted<{ quality: number }>>;
    b?: ReturnType<typeof usePersisted<{ level: string }>>;
    reset?: (() => void) | null;
  } = {};
  function Page() {
    // 默认值每次渲染都是新对象，不应该被当成改动
    api.a = usePersisted('demo-a', { quality: 80 });
    api.b = usePersisted('demo-b', { level: 'M' });
    api.reset = useSettingsReset();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Page)));
  // 读回上次存的值；旧版本留下的多余字段不算改动，但 level 不是默认值
  expect(api.b![0].level).toBe('H');
  expect(api.reset).toBeTypeOf('function');

  await act(async () => api.reset!());
  expect(api.b![0].level).toBe('M');
  expect(api.reset).toBeNull();

  await act(async () => api.a![1]({ quality: 60 }));
  expect(JSON.parse(localStorage.getItem('shunshou:demo-a')!)).toEqual({ quality: 60 });
  expect(api.reset).toBeTypeOf('function');

  // 单项重置只还原自己
  await act(async () => api.a![2]());
  expect(api.a![0].quality).toBe(80);
  expect(api.reset).toBeNull();

  // 页面卸载后登记一并清掉
  await act(async () => api.a![1]({ quality: 10 }));
  await act(async () => root.unmount());
  const probe: { reset?: (() => void) | null } = {};
  const other = createRoot(document.createElement('div'));
  await act(async () =>
    other.render(
      createElement(() => {
        probe.reset = useSettingsReset();
        return null;
      })
    )
  );
  expect(probe.reset).toBeNull();
  await act(async () => other.unmount());
});

test('用户内容字段只留在内存：不写本机、不算改动、恢复默认时不动', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // 旧版本存下的内容要被忽略
  localStorage.setItem('shunshou:demo-c', JSON.stringify({ find: 'customer-secret-123', quality: 70 }));
  const api: { c?: ReturnType<typeof usePersisted<{ find: string; quality: number }>>; reset?: (() => void) | null } = {};
  function Page() {
    api.c = usePersisted('demo-c', { find: '', quality: 80 }, ['find']);
    api.reset = useSettingsReset();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Page)));
  expect(api.c![0]).toEqual({ find: '', quality: 70 });
  expect(localStorage.getItem('shunshou:demo-c')).not.toContain('customer-secret');

  await act(async () => api.c![1]((v) => ({ ...v, find: 'customer-secret-123' })));
  expect(api.c![0].find).toBe('customer-secret-123');
  expect(localStorage.getItem('shunshou:demo-c')).not.toContain('customer-secret');

  // 只有 quality 算改动；恢复默认还原 quality，内容保持
  await act(async () => api.reset!());
  expect(api.c![0]).toEqual({ find: 'customer-secret-123', quality: 80 });
  expect(api.reset).toBeNull();
  await act(async () => root.unmount());
  expect(localStorage.getItem('shunshou:demo-c')).not.toContain('customer-secret');
});

test('启动时清掉旧版本存下的用户内容', async () => {
  const { forgetLegacyContent } = await import('./store');
  localStorage.setItem('shunshou:data-sql', JSON.stringify({ query: "SELECT 'customer-secret-123';" }));
  localStorage.setItem('shunshou:data-clean-settings', JSON.stringify({ find: 'a', replace: 'b', trim: false }));
  localStorage.setItem('shunshou:pdf-merge', JSON.stringify({ name: '客户合同', a4: true }));
  localStorage.setItem('shunshou:image-compress', JSON.stringify({ quality: 60 }));
  forgetLegacyContent();
  expect(localStorage.getItem('shunshou:data-sql')).toBeNull();
  expect(JSON.parse(localStorage.getItem('shunshou:data-clean-settings')!)).toEqual({ trim: false });
  expect(JSON.parse(localStorage.getItem('shunshou:pdf-merge')!)).toEqual({ a4: true });
  expect(JSON.parse(localStorage.getItem('shunshou:image-compress')!)).toEqual({ quality: 60 });
});

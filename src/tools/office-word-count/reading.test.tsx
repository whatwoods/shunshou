// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OutputActions, useOfficeRead } from '../../components/kit/OfficeKit';
vi.mock('../../components/ToolPage', () => ({ ToolPage: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});
function setup() {
  let api!: ReturnType<typeof useOfficeRead>;
  function Harness() {
    api = useOfficeRead();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(<Harness />));
  return () => api;
}
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it('keeps the newest file when older reading finishes last', async () => {
  const get = setup(),
    first = deferred(),
    second = deferred();
  const values: string[] = [];
  act(() => {
    void get().read(
      () => first.promise,
      (value) => values.push(value)
    );
    void get().read(
      () => second.promise,
      (value) => values.push(value)
    );
  });
  await act(async () => {
    second.resolve('new');
    await second.promise;
  });
  await act(async () => {
    first.resolve('old');
    await first.promise;
  });
  expect(values).toEqual(['new']);
  expect(get().reading).toBe(false);
});
it('preserves typed edits and discards obsolete read failures', async () => {
  const get = setup(),
    file = deferred();
  let committed = false;
  act(() => {
    void get().read(
      () => file.promise,
      () => {
        committed = true;
      }
    );
    get().invalidate();
  });
  await act(async () => {
    file.reject(new Error('old failure'));
    await file.promise.catch(() => {});
  });
  expect(committed).toBe(false);
  expect(get().error).toBe('');
  expect(get().reading).toBe(false);
});
it('allows copying and downloading a valid empty result only when explicitly ready', () => {
  const container = document.createElement('div'),
    root = createRoot(container);
  roots.push(root);
  act(() => root.render(<OutputActions text="" />));
  expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
  act(() => root.render(<OutputActions text="" ready />));
  expect(Array.from(container.querySelectorAll('button')).every((button) => !button.disabled)).toBe(true);
});

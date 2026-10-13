// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useOfficeWorker } from './OfficeKit';

vi.mock('../ToolPage', () => ({ ToolPage: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

it('hides previous results as soon as the input changes and ignores late messages', () => {
  const workers: { onmessage?: (event: { data: { result: string } }) => void; terminate: () => void }[] = [];
  const createWorker = () => {
    const worker = { terminate: vi.fn() };
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const states: ReturnType<typeof useOfficeWorker<string>>[] = [];
  function Harness({ input }: { input: string }) {
    states.push(useOfficeWorker<string>(createWorker, input));
    return null;
  }
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(<Harness input="old" />));
  act(() => workers[0].onmessage?.({ data: { result: 'old result' } }));
  expect(states.at(-1)?.result).toBe('old result');
  states.length = 0;
  act(() => root.render(<Harness input="new" />));
  expect(states.every((state) => state.busy && state.result === undefined)).toBe(true);
  act(() => workers[0].onmessage?.({ data: { result: 'late old result' } }));
  expect(states.at(-1)?.result).toBeUndefined();
  act(() => workers[1].onmessage?.({ data: { result: 'new result' } }));
  expect(states.at(-1)).toMatchObject({ result: 'new result', busy: false, error: '' });
});

it('reports worker startup failure without crashing the page', () => {
  let state!: ReturnType<typeof useOfficeWorker<string>>;
  function Harness() {
    state = useOfficeWorker<string>(() => {
      throw new Error('worker unavailable');
    }, 'text');
    return null;
  }
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(<Harness />));
  expect(state.busy).toBe(false);
  expect(state.result).toBeUndefined();
  expect(state.error).toContain('处理失败');
});

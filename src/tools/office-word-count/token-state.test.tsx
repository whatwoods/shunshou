// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useTokens } from './Page';

vi.mock('../../components/ToolPage', () => ({ ToolPage: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('ends a failed token job and starts a fresh worker for the next input', () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onerror?: () => void;
    onmessage?: (event: { data: { id: number; tokens: number } }) => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
  }
  vi.stubGlobal('Worker', FakeWorker);
  let state!: ReturnType<typeof useTokens>;
  function Harness({ text }: { text: string }) {
    state = useTokens(text);
    return null;
  }
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness text="first" />));
  act(() => vi.advanceTimersByTime(250));
  act(() => workers[0].onerror?.());
  expect(state).toMatchObject({ busy: false, failed: true });
  expect(workers[0].terminate).toHaveBeenCalled();
  act(() => root.render(<Harness text="second" />));
  act(() => vi.advanceTimersByTime(250));
  expect(workers).toHaveLength(2);
  const { id } = workers[1].postMessage.mock.calls[0][0];
  act(() => workers[1].onmessage?.({ data: { id, tokens: 2 } }));
  expect(state).toMatchObject({ tokens: 2, busy: false, failed: false });
});

import { FileChip } from '../../components/FileMatch';
import { toast } from '../../components/Toast';
import { useHandOff } from '../../lib/useHandOff';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { Led } from '../../components/ui';
import { DropOverlay } from '../../components/DropZone';
import { CodeExtraResult } from '../../components/kit/CodeExtraResult';
import { toolById } from '../../tools';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { useFileDrop } from '../../lib/useFileDrop';
import { pickFiles, saveBlob } from '../../lib/files';
import type { Algorithm } from './logic';
import '../../components/kit/CodeExtra.css';
const algorithms: Algorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'SHA3-256', 'BLAKE3', 'CRC32'];
export default function Page() {
  const [saved, setSaved] = usePersisted('code-hash', { algorithms: ['SHA-256'] as Algorithm[] });
  // 自动计算的 effect 依赖它，要保持引用稳定
  const selected = useMemo(() => saved.algorithms.filter((x) => algorithms.includes(x)), [saved.algorithms]);
  const setSelected = (next: Algorithm[]) => setSaved({ algorithms: next });
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const signature = JSON.stringify([text, selected]);
  const [made, setMade] = useState<{ value: Record<string, string>; signature: string; file: File | null } | null>(null);
  const result = made?.signature === signature && made.file === file ? made.value : {};
  const [expected, setExpected] = useState('');
  const [status, setStatus] = useState('输入文字，或拖入任意文件');
  const [busy, setBusy] = useState(false);
  useSettingsLock(busy);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | null>(null);
  function reset() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setMade(null);
    setError(false);
    setStatus('输入已更新');
  }
  function accept(files: File[]) {
    if (files[0]) {
      reset();
      setFile(files[0]);
    }
  }
  const dragging = useFileDrop(accept);
  useHandOff(accept);
  useEffect(() => () => worker.current?.terminate(), []);
  function run() {
    reset();
    if (!selected.length) {
      setError(true);
      setStatus('请至少选择一种算法');
      return;
    }
    setBusy(true);
    setProgress(0);
    setStatus('正在分块计算…');
    const current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = current;
    current.onmessage = ({ data }) => {
      if (worker.current !== current) return;
      if (data.progress !== undefined) setProgress(data.progress);
      if (data.result || data.error) {
        setMade(data.result ? { value: data.result, signature, file } : null);
        setError(!!data.error);
        setStatus(data.error ? `计算失败：${data.error}` : '计算完成');
        setBusy(false);
        current.terminate();
        worker.current = null;
      }
    };
    current.onerror = () => {
      if (worker.current !== current) return;
      setBusy(false);
      setError(true);
      setStatus('计算器启动失败，请刷新页面重试');
      current.terminate();
      worker.current = null;
    };
    current.postMessage({ blob: file || new Blob([text]), algorithms: selected });
  }
  // 文字随打随算，文件选好就开始算（分块进行，随时可以取消）；空文本仍然可以手动点“开始计算”
  useEffect(() => {
    if (worker.current) reset();
    if (!file && !text) return;
    const timer = setTimeout(run, file ? 0 : 250);
    return () => clearTimeout(timer);
  }, [text, file, selected]);
  const matched = Object.keys(result).filter((name) => result[name] === expected.trim().toLowerCase());
  return (
    <ToolPage
      tool={toolById('code-hash')!}
      sub={
        <>
          算文件或文字的哈希值{' '}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="ce-stack">
        <section className="ce-panel ce-stack">
          <div className="ce-row">
            <button className="btn-soft" onClick={async () => accept(await pickFiles('*', false))}>
              选择文件
            </button>
            {file && (
              <>
                <FileChip file={file} />
                <button
                  className="link-btn"
                  onClick={() => {
                    reset();
                    setFile(null);
                  }}
                >
                  改用文本
                </button>
              </>
            )}
          </div>
          {!file && (
            <label className="ce-field">
              待计算文本
              <textarea
                value={text}
                placeholder="粘贴文字（留空就算空文本）"
                onChange={(e) => {
                  reset();
                  setText(e.target.value);
                }}
              />
            </label>
          )}
          <div className="ce-checks" role="group" aria-label="哈希算法">
            {algorithms.map((name) => (
              <label className="ce-check" key={name}>
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={(e) => {
                    reset();
                    setSelected(e.target.checked ? [...selected, name] : selected.filter((x) => x !== name));
                  }}
                />
                {name}
              </label>
            ))}
          </div>
          <p className="ce-note">MD5、SHA-1、CRC32 只适合核对旧校验值，安全用途请选 SHA-256 及以上。文字按 UTF-8 计算。</p>
          <div className="ce-row">
            <button className="btn" disabled={busy} onClick={run}>
              开始计算
            </button>
            {busy && (
              <button
                className="btn-soft"
                onClick={() => {
                  reset();
                  setStatus('已取消');
                }}
              >
                取消
              </button>
            )}
          </div>
          <div role="status" className={error ? 'ce-error' : 'ce-status'}>
            <Led status={error ? 'error' : busy ? 'work' : Object.keys(result).length ? 'done' : 'idle'} />
            {made && !Object.keys(result).length ? '输入已更新' : status}
          </div>
          {busy && <progress value={progress} max={1} aria-label="计算进度" />}
        </section>
        {Object.keys(result).length > 0 && (
          <section className="ce-panel">
            <h2>摘要结果</h2>
            {Object.entries(result).map(([name, value]) => (
              <CodeExtraResult key={name} label={name} value={value} />
            ))}
            <div className="ce-stack">
              <label className="ce-field">
                与已有哈希值比较
                <input value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="粘贴预期哈希值" />
              </label>
              {expected.trim() && <p role="status">{matched.length ? `一致：${matched.join('、')}` : '不一致，看看文件和算法是否相同'}</p>}
              <button
                className="btn-soft"
                onClick={() => {
                  saveBlob(
                    new Blob(
                      [
                        Object.entries(result)
                          .map(([name, value]) => `${name}  ${value}`)
                          .join('\n')
                      ],
                      { type: 'text/plain' }
                    ),
                    `${file?.name || 'text'}.hashes.txt`
                  );
                  toast('已开始下载');
                }}
              >
                下载全部结果
              </button>
            </div>
          </section>
        )}
      </div>
      <DropOverlay show={dragging} title="松手，读取文件" />
    </ToolPage>
  );
}

import { FileChip } from '../../components/FileMatch';
import { useEffect, useState } from 'react';
import { CodeFiles, CodeOutput, CodeShell, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { toast } from '../../components/Toast';
export default function Page() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [options, setOptions] = useCodeSettings('code-radix', { from: 10, to: 16, upper: false, prefix: false });
  const [result, setResult] = useState<{ output?: string; count?: number; blob?: Blob; error?: string; truncated?: boolean }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult({});
    if (!text && !file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => worker.postMessage({ text, file, options }), 180);
    const deadline = setTimeout(() => {
      worker.terminate();
      setResult({ error: '处理超过 15 秒，请减少位数或行数后重试' });
      setBusy(false);
    }, 15000);
    worker.onmessage = (e) => {
      clearTimeout(deadline);
      setResult(e.data);
      setBusy(false);
    };
    worker.onerror = () => {
      clearTimeout(deadline);
      setResult({ error: '转换失败，请减少内容后重试' });
      setBusy(false);
    };
    return () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      worker.terminate();
    };
  }, [text, file, options]);
  return (
    <CodeShell id="code-radix" sub="每行一个整数，2–36 进制互转，大数不丢精度。">
      <div className="code-actions">
        <label>
          输入进制
          <input
            type="number"
            min={2}
            max={36}
            value={options.from}
            onChange={(e) => setOptions({ ...options, from: Number(e.target.value) })}
          />
        </label>
        <label>
          输出进制
          <input
            type="number"
            min={2}
            max={36}
            value={options.to}
            onChange={(e) => setOptions({ ...options, to: Number(e.target.value) })}
          />
        </label>
        <label className="code-check">
          <input type="checkbox" checked={options.upper} onChange={(e) => setOptions({ ...options, upper: e.target.checked })} />
          字母大写
        </label>
        <label className="code-check" title="2、8、16 进制分别加 0b、0o、0x">
          <input type="checkbox" checked={options.prefix} onChange={(e) => setOptions({ ...options, prefix: e.target.checked })} />
          添加进制前缀
        </label>
        <CodeFiles
          onFiles={(files) => {
            setFile(files[0]);
            setText('');
          }}
        />
        <button
          className="btn-soft"
          onClick={() => {
            setText('');
            setFile(undefined);
            toast('已清空');
          }}
        >
          清空
        </button>
      </div>
      <div className="code-grid">
        <section className="code-panel">
          <label>
            输入
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFile(undefined);
              }}
              placeholder={'255\n-42\n9007199254740993'}
              spellCheck={false}
            />
          </label>
          {file && <FileChip file={file} />}
        </section>
        <section className="code-panel">
          <h2>输出{result.count !== undefined && ` · ${result.count} 个整数`}</h2>
          <pre className="code-pre">{result.output || '等待输入'}</pre>
          {result.truncated && <p className="code-note">只预览前 10 万字，下载是全文。</p>}
        </section>
      </div>
      <CodeStatus busy={busy} error={result.error} ready={!!result.blob} />
      <CodeOutput text={result.output || ''} blob={result.blob} ready={!!result.blob} name="converted-integers.txt" />
      <p className="code-note">支持正负号和 0b、0o、0x 前缀，不转小数和补码。每行最多 1 万位，最多 1 万行。</p>
    </CodeShell>
  );
}

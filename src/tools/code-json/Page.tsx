import { FileChip } from '../../components/FileMatch';
import { useEffect, useState } from 'react';
import { CodeShell, CodeFiles, CodeOutput, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { ExampleButton, SegField } from '../../components/ui';
import type { JsonOptions } from './logic';

const EXAMPLE =
  '{"name":"顺手","version":"0.2.0","tools":53,"offline":true,"tags":["图片","PDF","音视频"],"owner":{"email":null,"since":2026}}';
function Highlight({ text }: { text: string }) {
  const preview = text.slice(0, 100000);
  return (
    <pre className="code-pre">
      {preview
        .split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)
        .map((part, i) => (
          <span
            key={i}
            className={
              /^".*:\s*$/.test(part)
                ? 'code-key'
                : part.startsWith('"')
                  ? 'code-str'
                  : /^(true|false|null)$/.test(part)
                    ? 'code-lit'
                    : /^-?\d/.test(part)
                      ? 'code-num'
                      : 'code-pun'
            }
          >
            {part}
          </span>
        ))}
      {text.length > preview.length && '\n…只预览前 10 万字，复制和下载是全文'}
    </pre>
  );
}
export default function Page() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [repair, setRepair] = useState(false);
  const [options, setOptions] = useCodeSettings<JsonOptions>('code-json', {
    source: 'json',
    target: 'json',
    indent: '2',
    sort: false,
    compact: false
  });
  const [result, setResult] = useState<{ output?: string; error?: string; fixable?: boolean }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult({});
    if (!text.trim() && !file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => worker.postMessage({ text, file, options, repair }), 200);
    const deadline = setTimeout(() => {
      worker.terminate();
      setBusy(false);
      setResult({ error: '处理超过 30 秒，请拆分文件后再试' });
    }, 30000);
    worker.onmessage = (e) => {
      setResult(e.data);
      setBusy(false);
      clearTimeout(deadline);
    };
    worker.onerror = () => {
      setResult({ error: '处理失败，请检查文件内容后重试' });
      setBusy(false);
      clearTimeout(deadline);
    };
    return () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      worker.terminate();
    };
  }, [text, file, options, repair]);
  return (
    <CodeShell id="code-json" sub="粘贴即校验、美化，JSON 和 YAML 都行。">
      <div className="code-actions">
        <SegField
          label="输入格式"
          value={options.source}
          onChange={(source) => setOptions({ ...options, source })}
          options={[
            { value: 'json', label: 'JSON' },
            { value: 'yaml', label: 'YAML' }
          ]}
        />
        <SegField
          label="输出格式"
          value={options.target}
          onChange={(target) => setOptions({ ...options, target })}
          options={[
            { value: 'json', label: 'JSON' },
            { value: 'yaml', label: 'YAML' }
          ]}
        />
        <SegField
          label="缩进"
          value={options.indent}
          onChange={(indent) => setOptions({ ...options, indent })}
          options={[
            { value: '2', label: '2' },
            { value: '4', label: '4' },
            { value: 'tab', label: 'Tab' }
          ]}
        />
        <label className="code-check">
          <input type="checkbox" checked={options.compact} onChange={(e) => setOptions({ ...options, compact: e.target.checked })} />
          压缩 JSON
        </label>
        <label className="code-check">
          <input type="checkbox" checked={options.sort} onChange={(e) => setOptions({ ...options, sort: e.target.checked })} />
          按键名排序
        </label>
        <CodeFiles
          accept=".json,.yaml,.yml,.txt"
          onFiles={(f) => {
            setFile(f[0]);
            setText('');
            setRepair(false);
          }}
        />
      </div>
      <div className="code-grid">
        <section className="code-panel">
          <label>
            输入
            <textarea
              value={text}
              placeholder="粘贴 JSON / YAML，或拖入文件"
              onChange={(e) => {
                setText(e.target.value);
                setFile(undefined);
                setRepair(false);
              }}
              spellCheck={false}
            />
          </label>
          {file && (
            <p className="code-note code-file">
              <FileChip file={file} />
              <button className="link-btn" onClick={() => setFile(undefined)}>
                移除
              </button>
            </p>
          )}
          {!text && !file && (
            <ExampleButton
              onClick={() => {
                setOptions({ ...options, source: 'json' });
                setText(EXAMPLE);
              }}
            />
          )}
          {result.fixable && (
            <button className="btn-soft" onClick={() => setRepair(true)}>
              一键修复并查看结果
            </button>
          )}
        </section>
        <section className="code-panel">
          <h2>输出</h2>
          {result.output ? (
            <Highlight text={result.output} />
          ) : (
            <p className="code-note">{result.error ? '修好左边的内容，结果会出现在这里' : '等待输入'}</p>
          )}
        </section>
      </div>
      <CodeStatus busy={busy} error={result.error} ready={!!result.output} />
      {repair && result.output && <p className="code-note">已修复语法，请核对后再用。原文还在左边。</p>}
      <CodeOutput text={result.output || ''} name={`formatted.${options.target}`} />
    </CodeShell>
  );
}

import { FileChip } from '../../components/FileMatch';
import { useEffect, useState } from 'react';
import { CodeFiles, CodeOutput, CodeShell, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { ExampleButton, SegField } from '../../components/ui';
import { toast } from '../../components/Toast';
import type { EscapeFormat } from './logic';
export default function Page() {
  const [options, setOptions] = useCodeSettings('code-escape', { format: 'html' as EscapeFormat, decode: false });
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ output?: string; blob?: Blob; length?: number; truncated?: boolean; error?: string }>({});
  useEffect(() => {
    setResult({});
    if (!text && !file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => w.postMessage({ text, file, ...options }), 180);
    const deadline = setTimeout(() => {
      w.terminate();
      setBusy(false);
      setResult({ error: '处理超过 15 秒，请减少内容后重试' });
    }, 15000);
    w.onmessage = (e) => {
      clearTimeout(deadline);
      setBusy(false);
      setResult(e.data);
    };
    w.onerror = () => {
      clearTimeout(deadline);
      setBusy(false);
      setResult({ error: '转换失败，请检查文件或减少内容后重试' });
    };
    return () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      w.terminate();
    };
  }, [text, file, options]);
  return (
    <CodeShell id="code-escape" sub="文字与 HTML 实体、转义序列互转。">
      <div className="code-actions">
        <SegField
          label="格式"
          value={options.format}
          onChange={(format) => setOptions({ ...options, format })}
          options={[
            { value: 'html', label: 'HTML 实体' },
            { value: 'unicode', label: '\\uXXXX' },
            { value: 'codepoint', label: '\\u{…}' },
            { value: 'json', label: 'JSON 字符串' }
          ]}
        />
        <SegField
          label="操作"
          value={options.decode ? 'decode' : 'encode'}
          onChange={(v) => setOptions({ ...options, decode: v === 'decode' })}
          options={[
            { value: 'encode', label: '转义' },
            { value: 'decode', label: '还原' }
          ]}
        />
        <CodeFiles
          accept=".txt,.html,.json,.js,.css,.md"
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
              placeholder="输入文字、&amp; 或 \u4f60\u597d"
              spellCheck={false}
            />
          </label>
          {file && <FileChip file={file} />}
          {!text && !file && (
            <ExampleButton
              onClick={() => {
                setOptions({ ...options, decode: false });
                setText('<a href="/?q=顺手&lang=zh">点这里 →</a>');
              }}
            />
          )}
        </section>
        <section className="code-panel">
          <h2>输出{result.length !== undefined && ` · ${result.length.toLocaleString()} 个 UTF-16 单元`}</h2>
          <pre className="code-pre">{result.output ?? '等待输入'}</pre>
          {result.truncated && <p className="code-note">只预览前 10 万字，复制和下载是全文。</p>}
        </section>
      </div>
      <CodeStatus busy={busy} error={result.error} ready={!!result.blob} />
      <CodeOutput text={result.output || ''} blob={result.blob} ready={!!result.blob} name="escaped.txt" />
      <p className="code-note">
        Unicode 还原支持 \uXXXX、\u{'{码点}'}、\xXX 和常见换行转义。HTML 按浏览器规则解码；结果只当文字显示，不执行脚本。
      </p>
    </CodeShell>
  );
}

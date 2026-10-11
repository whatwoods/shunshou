import { FileChip } from '../../components/FileMatch';
import { useEffect, useState } from 'react';
import { CodeFiles, CodeOutput, CodeShell, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { ExampleButton, SegField } from '../../components/ui';
import { toast } from '../../components/Toast';
import { saveBlob } from '../../lib/files';
export default function Page() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [options, setOptions] = useCodeSettings('code-base64', { mode: 'encode', urlSafe: false, dataUrl: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text?: string; error?: string; binary?: boolean; blob?: Blob }>({});
  const [preview, setPreview] = useState('');
  useEffect(() => {
    setResult({});
    if (!text && !file) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const t = setTimeout(() => w.postMessage({ text, file, ...options }), 200);
    w.onmessage = (e) => {
      setResult(e.data);
      setBusy(false);
    };
    w.onerror = () => {
      setResult({ error: '转换失败，请缩小文件后重试' });
      setBusy(false);
    };
    return () => {
      clearTimeout(t);
      w.terminate();
    };
  }, [text, file, options]);
  useEffect(() => {
    const blob = result.blob;
    if (!blob || !/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(blob.type)) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [result.blob]);
  return (
    <CodeShell id="code-base64" sub="文字、文件互转，中文和 URL-safe 都行。">
      <div className="code-actions">
        <SegField
          label="操作"
          value={options.mode}
          onChange={(mode) => {
            setOptions({ ...options, mode });
            setFile(undefined);
          }}
          options={[
            { value: 'encode', label: '编码' },
            { value: 'decode', label: '解码' }
          ]}
        />
        <label className="code-check">
          <input
            type="checkbox"
            checked={options.urlSafe}
            disabled={options.dataUrl}
            onChange={(e) => setOptions({ ...options, urlSafe: e.target.checked })}
          />
          URL-safe
        </label>
        <label className="code-check">
          <input
            type="checkbox"
            checked={options.dataUrl}
            onChange={(e) => setOptions({ ...options, dataUrl: e.target.checked, urlSafe: false })}
          />
          生成 data URL
        </label>
        <CodeFiles
          accept="*/*"
          onFiles={(f) => {
            setFile(f[0]);
            setText('');
          }}
        />
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
              placeholder={options.mode === 'encode' ? '输入文字，或拖入文件' : '粘贴 Base64 或图片 data URL'}
              spellCheck={false}
            />
          </label>
          {file && <FileChip file={file} />}
          {!text && !file && (
            <ExampleButton
              onClick={() =>
                setText(
                  options.mode === 'encode'
                    ? '顺手的小工具，全在浏览器里。✨'
                    : '6aG65omL55qE5bCP5bel5YW377yM5YWo5Zyo5rWP6KeI5Zmo6YeM44CC4pyo'
                )
              }
            />
          )}
        </section>
        <section className="code-panel">
          <h2>结果</h2>
          <pre className="code-pre">{result.text?.slice(0, 100000) || (result.binary ? '已解码为二进制文件，请下载查看' : '等待输入')}</pre>
          {(result.text?.length || 0) > 100000 && <p className="code-note">只预览前 10 万字，下载是全文。</p>}
          {preview && <img src={preview} alt="解码图片预览" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />}
        </section>
      </div>
      <CodeStatus busy={busy} error={result.error} ready={result.text !== undefined} />
      <CodeOutput
        ready={result.text !== undefined}
        text={result.text || ''}
        name={options.mode === 'encode' ? 'encoded.txt' : 'decoded.txt'}
      />
      {result.blob && (
        <button
          className="btn-soft"
          onClick={() => {
            saveBlob(
              result.blob!,
              'decoded.' +
                ({
                  'image/png': 'png',
                  'image/jpeg': 'jpg',
                  'image/webp': 'webp',
                  'image/gif': 'gif',
                  'image/avif': 'avif',
                  'image/bmp': 'bmp'
                }[result.blob!.type] || 'bin')
            );
            toast('已开始下载');
          }}
        >
          下载解码后的文件
        </button>
      )}
    </CodeShell>
  );
}

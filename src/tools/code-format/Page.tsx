import { useEffect, useRef, useState } from 'react';
import { ExampleButton, SegField } from '../../components/ui';
import { CodeShell, CodeFiles, CodeOutput, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { toast } from '../../components/Toast';
import { useShortcuts } from '../../lib/useShortcuts';
import { detectLanguage, type FormatOptions, type Language, type Dialect } from './logic';
import { Select } from '../../components/Select';
const languages: [Language, string, string][] = [
  ['html', 'HTML', 'html'],
  ['css', 'CSS', 'css'],
  ['javascript', 'JavaScript / JSX', 'js'],
  ['typescript', 'TypeScript / TSX', 'ts'],
  ['json', 'JSON', 'json'],
  ['sql', 'SQL', 'sql']
];
const EXAMPLE =
  "const cart=[{name:'咖啡豆',price:68,qty:2},{name:'滤纸',price:15,qty:1}];function total(items,coupon=0){return items.reduce((sum,{price,qty})=>sum+price*qty,0)-coupon}console.log(`合计 ${total(cart,10)} 元`);";
export default function Page() {
  const [options, setOptions] = useCodeSettings<FormatOptions>('code-format', {
    language: 'javascript',
    indent: 2,
    tabs: false,
    width: 80,
    dialect: 'sql'
  });
  const [text, setText] = useState('');
  // 结果记着是按哪套选项排的：选项一变（包括“恢复默认”）旧结果就不再显示，下载的扩展名也不会和内容对不上
  const sig = JSON.stringify(options);
  const [made, setMade] = useState({ text: '', sig: '' });
  const output = made.sig === sig ? made.text : '';
  const setOutput = (text: string) => setMade({ text, sig: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    []
  );
  function reset() {
    stop();
    setOutput('');
    setError('');
  }
  function run(file?: File, input = text, preset?: FormatOptions) {
    reset();
    setBusy(true);
    const base = preset || options;
    const currentOptions = file ? { ...base, language: detectLanguage(file.name) || base.language } : base;
    if (file || preset) setOptions(currentOptions);
    const current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = current;
    timer.current = setTimeout(() => {
      if (worker.current === current) {
        stop();
        setError('格式化超过 20 秒，请缩小文件或检查语言后重试');
      }
    }, 20000);
    current.onmessage = ({ data }) => {
      if (worker.current !== current) return;
      stop();
      setMade({ text: data.text || '', sig: JSON.stringify(currentOptions) });
      setError(data.error || '');
      if (data.input !== undefined) setText(data.input);
    };
    current.onerror = () => {
      if (worker.current !== current) return;
      stop();
      setError('格式化器启动失败，请刷新页面后重试');
    };
    current.postMessage({ text: input, file, options: currentOptions });
  }
  useShortcuts({
    run: () => (busy || !text.trim() ? false : run()),
    cancel: () => (busy ? stop() : false)
  });
  function change(next: FormatOptions) {
    reset();
    setOptions(next);
  }
  return (
    <CodeShell id="code-format" sub="粘贴或拖入代码，一键整理缩进。">
      <section className="code-panel">
        <div className="code-actions">
          <CodeFiles
            accept=".html,.htm,.css,.js,.jsx,.mjs,.cjs,.ts,.tsx,.json,.sql,.txt"
            onFiles={(files) => {
              if (files[0]) run(files[0]);
            }}
          />
          <label>
            语言
            <Select value={options.language} onChange={(e) => change({ ...options, language: e.target.value as Language })}>
              {languages.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <SegField
            label="缩进空格"
            value={String(options.indent)}
            onChange={(v) => change({ ...options, indent: Number(v) })}
            options={[2, 4, 8].map((n) => ({ value: String(n), label: String(n) }))}
          />
          {options.language !== 'sql' && (
            <SegField
              label="建议行宽"
              value={String(options.width)}
              onChange={(v) => change({ ...options, width: Number(v) })}
              options={[80, 100, 120].map((n) => ({ value: String(n), label: String(n) }))}
            />
          )}
          <label className="code-check">
            <input type="checkbox" checked={options.tabs} onChange={(e) => change({ ...options, tabs: e.target.checked })} />
            使用 Tab 缩进
          </label>
          {options.language === 'sql' && (
            <SegField
              label="SQL 方言"
              value={options.dialect}
              onChange={(dialect) => change({ ...options, dialect })}
              options={(
                [
                  ['sql', '标准'],
                  ['mysql', 'MySQL'],
                  ['postgresql', 'PostgreSQL'],
                  ['sqlite', 'SQLite']
                ] as [Dialect, string][]
              ).map(([value, label]) => ({ value, label }))}
            />
          )}
        </div>
        <p className="code-note">不执行代码。最多 500 万字、10 MB；HTML 里的脚本和样式不动，SQL 关键词转大写。</p>
      </section>
      <div className="code-grid">
        <section className="code-panel">
          <label>
            原始代码
            <textarea
              value={text}
              spellCheck={false}
              placeholder="粘贴代码，或拖入文件"
              onChange={(e) => {
                reset();
                setText(e.target.value);
              }}
            />
          </label>
          {!text && !busy && (
            <ExampleButton
              onClick={() => {
                setText(EXAMPLE);
                run(undefined, EXAMPLE, { ...options, language: 'javascript' });
              }}
            >
              试试一段压缩过的 JS
            </ExampleButton>
          )}
          <div className="code-actions">
            <button className="btn" disabled={busy || !text.trim()} onClick={() => run()}>
              格式化
            </button>
            {busy && (
              <button
                className="btn-soft"
                onClick={() => {
                  stop();
                  setError('已取消');
                }}
              >
                取消
              </button>
            )}
            <button
              className="btn-soft"
              disabled={!text && !output && !busy}
              onClick={() => {
                reset();
                setText('');
                toast('已清空');
              }}
            >
              清空
            </button>
          </div>
        </section>
        <section className="code-panel">
          <label>
            格式化结果
            <textarea readOnly value={output} placeholder="格式化后的代码会出现在这里" />
          </label>
          <CodeOutput text={output} name={`formatted.${languages.find(([value]) => value === options.language)?.[2] || 'txt'}`} />
        </section>
      </div>
      <CodeStatus busy={busy} error={error} ready={!!output} />
    </CodeShell>
  );
}

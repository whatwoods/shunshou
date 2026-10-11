import { useEffect, useState, type ReactNode } from 'react';
import { ExampleButton } from '../../components/ui';
import { CodeShell, CodeOutput, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import type { Match } from './logic';
import { Select } from '../../components/Select';
const snippets = [
  ['电子邮箱', '[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}'],
  ['中国手机号', '1[3-9]\\d{9}'],
  ['日期 YYYY-MM-DD', '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})'],
  ['网址', 'https?://[^\\s<>]+'],
  ['中文', '[\\p{Script=Han}]+']
];
function Matches({ text, matches }: { text: string; matches: Match[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [i, m] of matches.entries()) {
    if (m.index > 100000) break;
    parts.push(text.slice(cursor, m.index));
    parts.push(
      <mark className="code-match" key={i} title={`匹配 ${i + 1}，位置 ${m.index}`}>
        {text.slice(m.index, Math.min(m.index + m.length, 100000)) || '▏'}
      </mark>
    );
    cursor = m.index + m.length;
  }
  parts.push(text.slice(cursor, 100000));
  return (
    <pre className="code-pre">
      {parts}
      {text.length > 100000 ? '\n…只预览前 10 万字' : ''}
    </pre>
  );
}
export default function Page() {
  const [pattern, setPattern] = useState('');
  const [text, setText] = useState('');
  const [replacement, setReplacement] = useState('');
  const [settings, setSettings] = useCodeSettings('code-regex', { flags: 'gu' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    matches?: Match[];
    output?: string;
    outputBlob?: Blob;
    truncated?: boolean;
    groupsTruncated?: boolean;
    error?: string;
  }>({});
  useEffect(() => {
    setResult({});
    if (!pattern) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let deadline: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      deadline = setTimeout(() => {
        w.terminate();
        setBusy(false);
        setResult({ error: '超过 1.5 秒，已停止。缩小文本，或避免 (a+)+ 这类嵌套量词。' });
      }, 1500);
      w.postMessage({ pattern, text, replacement, flags: settings.flags });
    }, 200);
    w.onmessage = (e) => {
      clearTimeout(deadline);
      setBusy(false);
      setResult(e.data);
    };
    w.onerror = () => {
      clearTimeout(deadline);
      setBusy(false);
      setResult({ error: '正则执行失败，请检查表达式' });
    };
    return () => {
      clearTimeout(t);
      clearTimeout(deadline);
      w.terminate();
    };
  }, [pattern, text, replacement, settings.flags]);
  return (
    <CodeShell id="code-regex" sub="实时看匹配、分组和替换，太慢会自动停。">
      <div className="code-actions">
        <label style={{ flex: '1 1 240px' }}>
          正则表达式（不用写两端 /）
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="(?<word>\\w+)" spellCheck={false} />
        </label>
        <label>
          标志
          <input value={settings.flags} onChange={(e) => setSettings({ flags: e.target.value })} placeholder="gimuys" />
        </label>
        <label>
          常用片段
          <Select value="" onChange={(e) => setPattern(e.target.value)}>
            <option value="">选择片段</option>
            {snippets.map(([name, p]) => (
              <option key={name} value={p}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="code-grid">
        <section className="code-panel">
          <label>
            测试文本
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴要匹配的文本" />
          </label>
          {!text && !pattern && (
            <ExampleButton
              onClick={() => {
                setPattern('(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})');
                setText('会议改到 2026-10-14 上午，材料 2026-10-20 前交，复盘定在 2026-11-01。');
                setReplacement('$<month> 月 $<day> 日');
              }}
            />
          )}
        </section>
        <section className="code-panel">
          <h2>匹配高亮 · {result.matches?.length || 0} 处</h2>
          <Matches text={text} matches={result.matches || []} />
        </section>
      </div>
      <CodeStatus busy={busy} error={result.error} ready={!!result.matches} />
      {result.truncated && <p className="code-note">最多列出 1 万处匹配，替换作用于全文。</p>}
      {!!result.matches?.length && (
        <details className="code-panel">
          <summary>捕获分组（前 100 处）</summary>
          {result.matches.slice(0, 100).map((m, i) => (
            <div key={i}>
              <p className="code-note">
                #{i + 1} · 位置 {m.index}
              </p>
              {m.groups.map((g, j) => (
                <p className="code-token" key={j}>
                  <span className={j % 2 ? 'code-str' : 'code-key'}>
                    ${j + 1} [{m.spans[j]?.join('–') || '未匹配'}] {g === undefined ? '未匹配' : g.slice(0, 10000) || '空字符串'}
                  </span>
                </p>
              ))}
              {m.named && <pre className="code-pre">{JSON.stringify(m.named, null, 2)}</pre>}
            </div>
          ))}
        </details>
      )}
      {result.groupsTruncated && <p className="code-note">分组预览已截断（每项 1000 字、共 10 万字），替换结果是完整的。</p>}
      <label>
        替换为（支持 $1、$&amp;、$&lt;分组名&gt;）
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} />
      </label>
      <section className="code-panel">
        <h2>替换预览（前 10 万字）</h2>
        <pre className="code-pre">{result.output?.slice(0, 100000)}</pre>
      </section>
      <CodeOutput ready={!!result.outputBlob} blob={result.outputBlob} text={result.output || ''} name="replaced.txt" />
    </CodeShell>
  );
}

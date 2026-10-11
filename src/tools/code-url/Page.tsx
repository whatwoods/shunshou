import { useMemo, useState } from 'react';
import { CodeOutput, CodeShell, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { ExampleButton, SegField } from '../../components/ui';
import { parseUrl, updateUrl, transformUrl } from './logic';
export default function Page() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [options, setOptions] = useCodeSettings('code-url', { mode: 'encode', component: true });
  const result = useMemo(() => {
    try {
      return { text: transformUrl(text, options.mode, options.component), error: '' };
    } catch {
      return { text: '', error: '百分号编码不完整或 UTF-8 无效，请检查 % 后的两位十六进制字符' };
    }
  }, [text, options]);
  const parsed = useMemo(() => {
    try {
      return { value: parseUrl(url), error: '' };
    } catch {
      return { value: undefined, error: url ? '请输入带协议的完整 URL，例如 https://example.com/path?a=1' : '' };
    }
  }, [url]);
  const edit = (index: number, part: 0 | 1, value: string) => {
    if (!parsed.value) return;
    const params = parsed.value.params.map((p, i) => (i === index ? (p.map((v, j) => (j === part ? value : v)) as [string, string]) : p));
    setUrl(updateUrl(url, params, parsed.value.path, parsed.value.hash));
  };
  return (
    <CodeShell id="code-url" sub="编码文字，拆开网址改参数。">
      <div className="code-actions">
        <SegField
          label="操作"
          value={options.mode}
          onChange={(mode) => setOptions({ ...options, mode })}
          options={[
            { value: 'encode', label: '编码' },
            { value: 'decode', label: '解码' }
          ]}
        />
        <label className="code-check">
          <input type="checkbox" checked={options.component} onChange={(e) => setOptions({ ...options, component: e.target.checked })} />
          编码参数值（包含 / ? &amp;）
        </label>
      </div>
      <div className="code-grid">
        <section className="code-panel">
          <label>
            输入
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴要编码或解码的文字" />
          </label>
          {!text && (
            <ExampleButton
              onClick={() =>
                setText(
                  options.mode === 'encode'
                    ? '顺手 工具/搜索?q=合并 PDF&lang=zh'
                    : '%E9%A1%BA%E6%89%8B%20%E5%B7%A5%E5%85%B7%2F%E6%90%9C%E7%B4%A2'
                )
              }
            />
          )}
        </section>
        <section className="code-panel">
          <h2>输出</h2>
          <pre className="code-pre">{result.text || '等待输入'}</pre>
        </section>
      </div>
      <CodeStatus error={result.error} ready={!!text} />
      <CodeOutput text={result.text} />
      <section className="code-panel">
        <h2>拆解与编辑 URL</h2>
        <label>
          完整 URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/path?name=顺手" spellCheck={false} />
        </label>
        {parsed.error && (
          <p className="code-error" role="alert">
            {parsed.error}
          </p>
        )}
        {parsed.value && (
          <>
            <p className="code-note">
              协议 {parsed.value.protocol} · 域名 {parsed.value.hostname} · 端口 {parsed.value.port || '默认'}
            </p>
            <div className="code-grid">
              <label>
                路径
                <input
                  value={parsed.value.path}
                  onChange={(e) => setUrl(updateUrl(url, parsed.value!.params, e.target.value, parsed.value!.hash))}
                />
              </label>
              <label>
                片段（#）
                <input
                  value={parsed.value.hash}
                  onChange={(e) => setUrl(updateUrl(url, parsed.value!.params, parsed.value!.path, e.target.value))}
                />
              </label>
            </div>
            <div className="code-scroll">
              <table>
                <thead>
                  <tr>
                    <th>参数名</th>
                    <th>值</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.value.params.map(([key, value], i) => (
                    <tr key={i}>
                      <td>
                        <input aria-label={`参数 ${i + 1} 名称`} value={key} onChange={(e) => edit(i, 0, e.target.value)} />
                      </td>
                      <td>
                        <input aria-label={`参数 ${i + 1} 值`} value={value} onChange={(e) => edit(i, 1, e.target.value)} />
                      </td>
                      <td>
                        <button
                          className="link-btn"
                          onClick={() =>
                            setUrl(
                              updateUrl(
                                url,
                                parsed.value!.params.filter((_, j) => i !== j),
                                parsed.value!.path,
                                parsed.value!.hash
                              )
                            )
                          }
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn-soft"
              onClick={() => setUrl(updateUrl(url, [...parsed.value!.params, ['key', '']], parsed.value!.path, parsed.value!.hash))}
            >
              添加参数
            </button>
            <CodeOutput text={url} name="url.txt" />
          </>
        )}
      </section>
    </CodeShell>
  );
}

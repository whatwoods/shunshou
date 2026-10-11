import { useState } from 'react';
import { SegField } from '../../components/ui';
import { CodeShell, CodeOutput, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { toast } from '../../components/Toast';
import type { IdKind } from './logic';
export default function Page() {
  const [settings, setSettings] = useCodeSettings('code-id', { kind: 'uuid4' as IdKind, count: 10 });
  // 结果记着是按哪套设置生成的：设置一变（包括标题旁的“恢复默认”），旧结果就不再显示，下载名也不会和内容对不上
  const sig = `${settings.kind}:${settings.count}`;
  const [made, setMade] = useState({ text: '', sig: '' });
  const result = made.sig === sig ? made.text : '';
  const setResult = (text: string) => setMade({ text, sig });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate() {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const { generateIds } = await import('./logic');
      setMade({ text: generateIds(settings.kind, settings.count).join('\n'), sig });
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请检查数量后重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <CodeShell id="code-id" sub="安全随机，每行一个，复制就能用。">
      <form
        className="code-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <div className="code-actions">
          <SegField
            label="标识类型"
            value={settings.kind}
            onChange={(kind) => {
              if (busy) return;
              setResult('');
              setError('');
              setSettings({ ...settings, kind });
            }}
            options={[
              { value: 'uuid4', label: 'UUID v4' },
              { value: 'uuid7', label: 'UUID v7' },
              { value: 'ulid', label: 'ULID' }
            ]}
          />
          <label>
            生成数量
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              required
              disabled={busy}
              value={settings.count}
              onChange={(e) => {
                setResult('');
                setError('');
                setSettings({ ...settings, count: e.target.valueAsNumber });
              }}
            />
          </label>
          <button className="btn" disabled={busy}>
            生成
          </button>
        </div>
        <p className="code-note">UUID v7 和 ULID 带时间，可排序。随机数来自浏览器 Crypto，别拿它当密码。</p>
        <CodeStatus busy={busy} error={error} ready={!!result} />
      </form>
      <section className="code-panel">
        <label>
          生成结果
          <textarea readOnly value={result} placeholder="点“生成”，结果会出现在这里" />
        </label>
        <div className="code-actions">
          <CodeOutput text={result} name={`${settings.kind}.txt`} />
          <button
            className="btn-soft"
            disabled={!result || busy}
            onClick={() => {
              setResult('');
              setError('');
              toast('已清空');
            }}
          >
            清空
          </button>
        </div>
      </section>
    </CodeShell>
  );
}

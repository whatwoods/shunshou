import { useEffect, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { Led, SegField } from '../../components/ui';
import { CodeExtraResult } from '../../components/kit/CodeExtraResult';
import { toolById } from '../../tools';
import { usePersisted } from '../../lib/settings';
import type { Disambiguation, formatTime } from './logic';
import '../../components/kit/CodeExtra.css';
import { Select } from '../../components/Select';
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zones = [
  ...new Set([
    'UTC',
    localZone,
    'Asia/Shanghai',
    'Asia/Taipei',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Kolkata',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Australia/Sydney'
  ])
];
export default function Page() {
  const [settings, setSettings] = usePersisted('code-timestamp', {
    zone: localZone,
    unit: 's' as 's' | 'ms',
    disambiguation: 'reject' as Disambiguation
  });
  const [now, setNow] = useState(Date.now);
  const [timestamp, setTimestamp] = useState('');
  const [date, setDate] = useState('');
  // 结果记着是按哪套时区和单位换算的：设置一变（包括“恢复默认”）旧结果就不再显示
  const sig = JSON.stringify(settings);
  const [made, setMade] = useState<{ value: ReturnType<typeof formatTime>; sig: string } | null>(null);
  const value = made?.sig === sig ? made.value : null;
  const setValue = (v: ReturnType<typeof formatTime> | null, at = sig) => setMade(v && { value: v, sig: at });
  const [error, setError] = useState('');
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const result = value;
  const [busy, setBusy] = useState(false);
  async function convert(mode: 'timestamp' | 'date') {
    const at = sig;
    setBusy(true);
    setError('');
    try {
      const { parseTimestamp, parseDate, formatTime } = await import('./logic');
      const ms = mode === 'timestamp' ? parseTimestamp(timestamp, settings.unit) : parseDate(date, settings.zone, settings.disambiguation);
      setValue(formatTime(ms, settings.zone), at);
    } catch (e) {
      setValue(null);
      setError(e instanceof Error ? e.message : '无法转换，请检查输入');
    } finally {
      setBusy(false);
    }
  }
  async function useNow() {
    const at = sig;
    setBusy(true);
    setError('');
    try {
      const { formatTime } = await import('./logic');
      const ms = Date.now();
      const formatted = formatTime(ms, settings.zone);
      setTimestamp(settings.unit === 's' ? String(ms / 1000) : String(ms));
      setDate(formatted.local);
      setValue(formatted, at);
    } catch {
      setError('无法转换，请检查时区后重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ToolPage
      tool={toolById('code-timestamp')!}
      sub={
        <>
          秒、毫秒和时区，清清楚楚{' '}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="ce-stack">
        <section className="ce-panel">
          <div className="ce-row">
            <div className="ce-field">
              <span className="ce-note">当前 Unix 时间 · 秒</span>
              <span className="ce-large">{Math.floor(now / 1000)}</span>
              <span className="ce-note">{new Date(now).toISOString()}</span>
            </div>
            <button className="btn-soft" disabled={busy} onClick={useNow}>
              填入当前时间
            </button>
          </div>
        </section>
        <section className="ce-panel ce-stack">
          <div className="ce-row">
            <label className="ce-field">
              时区
              <Select
                disabled={busy}
                value={settings.zone}
                onChange={(e) => {
                  setSettings({ ...settings, zone: e.target.value });
                  setValue(null);
                  setError('');
                }}
              >
                {zones.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </Select>
            </label>
            <SegField
              label="夏令时冲突时"
              value={settings.disambiguation}
              onChange={(disambiguation) => setSettings({ ...settings, disambiguation })}
              options={[
                { value: 'reject', label: '提示我' },
                { value: 'earlier', label: '取较早' },
                { value: 'later', label: '取较晚' }
              ]}
            />
          </div>
          <div className="ce-grid">
            <form
              className="ce-stack"
              onSubmit={(e) => {
                e.preventDefault();
                convert('timestamp');
              }}
            >
              <label className="ce-field">
                Unix 时间戳
                <input
                  disabled={busy}
                  value={timestamp}
                  onChange={(e) => {
                    setTimestamp(e.target.value);
                    setValue(null);
                  }}
                  placeholder="例如 1704067200"
                  inputMode="decimal"
                />
              </label>
              <SegField
                label="单位"
                value={settings.unit}
                onChange={(unit) => {
                  setSettings({ ...settings, unit });
                  setValue(null);
                }}
                options={[
                  { value: 's', label: '秒' },
                  { value: 'ms', label: '毫秒' }
                ]}
              />
              <button disabled={busy} className="btn" type="submit">
                时间戳 → 日期
              </button>
            </form>
            <form
              className="ce-stack"
              onSubmit={(e) => {
                e.preventDefault();
                convert('date');
              }}
            >
              <label className="ce-field">
                日期和时间
                <input
                  disabled={busy}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setValue(null);
                  }}
                  placeholder="2024-01-01T08:00:00"
                />
              </label>
              <p className="ce-note">没写时区的日期按所选时区算；带 Z 或 +08:00 的按它自己的。</p>
              <button disabled={busy} className="btn" type="submit">
                日期 → 时间戳
              </button>
            </form>
          </div>
          <div role="status" className={error ? 'ce-error' : 'ce-status'}>
            <Led status={error ? 'error' : busy ? 'work' : result ? 'done' : 'idle'} />
            {error || (busy ? '正在转换…' : result ? '转换完成' : '输入时间后按 Enter 转换')}
          </div>
        </section>
        {result && (
          <section className="ce-panel">
            <h2>转换结果</h2>
            <CodeExtraResult label="Unix 秒" value={result.seconds} />
            <CodeExtraResult label="Unix 毫秒" value={result.milliseconds} />
            <CodeExtraResult label={`所选时区 · ${settings.zone}`} value={result.zoned} />
            <CodeExtraResult label="ISO 8601 · UTC" value={result.iso} />
            <CodeExtraResult label="RFC 2822 · GMT" value={result.rfc} />
          </section>
        )}
      </div>
    </ToolPage>
  );
}

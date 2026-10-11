import { useEffect, useMemo, useRef, useState } from 'react';
import { ExampleButton } from '../../components/ui';
import { CodeShell, CodeOutput, CodeStatus, useCodeSettings } from '../../components/kit/CodeKit';
import { algorithms, parseJwt, timeClaims, verifyJwt } from './logic';
import { Select } from '../../components/Select';
export default function Page() {
  const [token, setToken] = useState('');
  const [key, setKey] = useState('');
  const [settings, setSettings] = useCodeSettings('code-jwt', { algorithm: 'HS256' });
  const [verified, setVerified] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    generation.current++;
    setVerified('');
    setError('');
    setBusy(false);
  }, [token, key, settings.algorithm]);
  const parsed = useMemo(() => {
    try {
      return token.trim() ? { value: parseJwt(token), error: '' } : { value: undefined, error: '' };
    } catch (e) {
      return { value: undefined, error: e instanceof Error ? e.message : '无法解析 JWT，请检查三段内容' };
    }
  }, [token]);
  const verify = async () => {
    const gen = ++generation.current;
    setBusy(true);
    setError('');
    setVerified('');
    try {
      const ok = await verifyJwt(token, key, settings.algorithm);
      if (gen === generation.current) setVerified(ok ? '签名验证通过' : '签名不匹配，请检查密钥和令牌');
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : '验签失败，请检查公钥格式和浏览器支持');
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  };
  return (
    <CodeShell id="code-jwt" sub="拆开令牌看内容和有效期，密钥只在本机验签。">
      <section className="code-panel">
        <label>
          JWT
          <textarea value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJ… . eyJ… . 签名" spellCheck={false} />
        </label>
        {!token && (
          <ExampleButton
            onClick={() => {
              setToken(
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMDI2IiwibmFtZSI6IumhuuaJiyIsInJvbGUiOiJkZW1vIiwiaWF0IjoxNzYwMTQwODAwLCJleHAiOjE3OTE2NzY4MDB9.Av8qxwXY9AF7lIep_1oSK8XGRQHCst8OISbNi2LshOM'
              );
              setSettings({ algorithm: 'HS256' });
              setKey('shunshou-demo');
            }}
          >
            试试示例（密钥 shunshou-demo）
          </ExampleButton>
        )}
      </section>
      <CodeStatus error={parsed.error} ready={!!parsed.value} />
      {parsed.value && (
        <>
          <section className="code-panel">
            <h2>头部 · 载荷 · 签名</h2>
            <p className="code-token">
              {parsed.value.parts.map((part, i) => (
                <span key={i} className={['code-key', 'code-str', 'code-lit'][i]}>
                  {i > 0 ? '.' : ''}
                  {part}
                </span>
              ))}
            </p>
            <p className="code-note">能解析不代表可信，签名和有效期要分开看。</p>
          </section>
          <div className="code-grid">
            <section className="code-panel">
              <h2>头部</h2>
              <pre className="code-pre">{JSON.stringify(parsed.value.header, null, 2)}</pre>
            </section>
            <section className="code-panel">
              <h2>载荷</h2>
              <pre className="code-pre">{JSON.stringify(parsed.value.payload, null, 2)}</pre>
            </section>
          </div>
          <section className="code-panel">
            <h2>时间字段（UTC）</h2>
            {timeClaims(parsed.value.payload, now).map((t) => (
              <p key={t.key} className={['expired', 'future', 'invalid'].includes(t.status) ? 'code-error' : 'code-note'}>
                {t.key} · {t.text} ·{' '}
                {{ expired: '已过期', future: '尚未生效', valid: '有效', issued: '签发时间', invalid: '格式无效' }[t.status]}
              </p>
            ))}
            {!timeClaims(parsed.value.payload, now).length && <p className="code-note">载荷没有 iat、nbf 或 exp 时间字段。</p>}
          </section>
          <CodeOutput text={JSON.stringify(parsed.value.payload, null, 2)} name="payload.json" />
        </>
      )}
      <section className="code-panel">
        <h2>本地验证签名</h2>
        <label>
          预期算法（照签发方的设置选）
          <Select value={settings.algorithm} onChange={(e) => setSettings({ algorithm: e.target.value })}>
            {algorithms.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </label>
        <label>
          {settings.algorithm.startsWith('HS') ? 'HMAC 密钥（按 UTF-8 文字使用）' : '公钥（SPKI PEM 或 JWK）'}
          <textarea value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} autoComplete="off" />
        </label>
        <button className="btn" disabled={!parsed.value || !key || busy} onClick={verify}>
          验证签名
        </button>
        <CodeStatus busy={busy} error={error} />
        {verified && <p role="status">{verified}</p>}
      </section>
    </CodeShell>
  );
}

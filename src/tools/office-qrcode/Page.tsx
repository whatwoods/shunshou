import { toast } from '../../components/Toast';
import { useEffect, useRef, useState } from 'react';
import { OfficePage, Panel, SideGroup, TextBox, TextLayout, Status, useIncoming, usePreference } from '../../components/kit/OfficeKit';
import { pickFiles, saveBlob } from '../../lib/files';
import { wifi } from './logic';
import { DownloadIcon, Field, ImageIcon, Segmented, SwitchRow } from '../../components/ui';
export default function Page() {
  const [p, setP] = usePreference('office-qrcode', {
    kind: 'text',
    level: 'M',
    dark: '#000000',
    light: '#ffffff',
    security: 'WPA',
    hidden: false
  });
  const [text, setText] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [logo, setLogo] = useState<File>();
  const [scan, setScan] = useState<File>();
  const [mode, setMode] = useState('generate');
  const [decoded, setDecoded] = useState('');
  const [result, setResult] = useState<{ svg: string; png: Blob; url: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resultUrl = useRef('');
  useEffect(
    () => () => {
      URL.revokeObjectURL(resultUrl.current);
    },
    []
  );
  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let timer: ReturnType<typeof setTimeout>;
    setError('');
    setDecoded('');
    setResult(undefined);
    URL.revokeObjectURL(resultUrl.current);
    if (mode === 'decode' && !scan) {
      setBusy(false);
      return () => worker.terminate();
    }
    if (mode === 'generate' && !(p.kind === 'wifi' ? ssid : text)) {
      setBusy(false);
      return () => worker.terminate();
    }
    setBusy(true);
    try {
      const payload =
        mode === 'decode'
          ? { action: 'decode', file: scan }
          : { action: 'generate', text: p.kind === 'wifi' ? wifi(ssid, password, p.security, p.hidden) : text, ...p, logo };
      timer = setTimeout(() => worker.postMessage(payload), 220);
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
    worker.onmessage = (e) => {
      setBusy(false);
      if (e.data.error) setError(e.data.error);
      else if (mode === 'decode') setDecoded(e.data.text);
      else {
        const url = URL.createObjectURL(e.data.png);
        resultUrl.current = url;
        setResult({ ...e.data, url });
      }
    };
    worker.onerror = () => {
      setBusy(false);
      setError('处理失败，换小一点的图片或缩短内容再试');
    };
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [text, ssid, password, p, logo, scan, mode]);
  function files(fs: File[]) {
    setScan(fs[0]);
    setMode('decode');
  }
  useIncoming(files);
  const [scanUrl, setScanUrl] = useState('');
  useEffect(() => {
    if (!scan) return setScanUrl('');
    const url = URL.createObjectURL(scan);
    setScanUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [scan]);
  const kindSwitch = (
    <Segmented
      className="seg-sm"
      label="内容类型"
      value={p.kind}
      onChange={(kind) => setP({ ...p, kind })}
      options={[
        { value: 'text', label: '文本' },
        { value: 'wifi', label: 'Wi-Fi' }
      ]}
    />
  );
  const pickScan = async () => {
    const fs = await pickFiles('image/*', false);
    if (fs.length) files(fs);
  };
  const save = (blob: Blob, name: string) => {
    saveBlob(blob, name);
    toast('已开始下载');
  };
  return (
    <OfficePage id="office-qrcode" sub="生成二维码，或拖入、粘贴图片识别">
      <TextLayout
        side={
          mode === 'generate' && (
            <>
              <SideGroup title="样式" note="颜色要深浅分明，发出去前先用“识别图片”检查一下。">
                <Field div block label="纠错等级" hint={logo ? '加 Logo 时固定用 H' : '越高越耐污损，图案也越密'}>
                  <Segmented
                    label="纠错等级"
                    value={logo ? 'H' : p.level}
                    disabled={!!logo}
                    onChange={(level) => setP({ ...p, level })}
                    options={['L', 'M', 'Q', 'H'].map((x) => ({ value: x, label: x }))}
                  />
                </Field>
                <Field label="前景">
                  <input type="color" value={p.dark} onChange={(e) => setP({ ...p, dark: e.target.value })} />
                </Field>
                <Field label="背景">
                  <input type="color" value={p.light} onChange={(e) => setP({ ...p, light: e.target.value })} />
                </Field>
              </SideGroup>
              <SideGroup title="中间放个 Logo" note="PNG、JPEG 或 WebP，可以不放。">
                <Field div label={logo ? <span className="qr-logo-name">{logo.name}</span> : '没有'}>
                  <span className="qr-logo-actions">
                    {logo && (
                      <button type="button" className="link-btn" onClick={() => setLogo(undefined)}>
                        移除
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-soft btn-sm"
                      onClick={async () => {
                        const [file] = await pickFiles('image/png,image/jpeg,image/webp', false);
                        if (file) setLogo(file);
                      }}
                    >
                      <ImageIcon size={15} />
                      {logo ? '换一张' : '选择图片'}
                    </button>
                  </span>
                </Field>
              </SideGroup>
            </>
          )
        }
      >
        <Segmented
          className="tw-mode"
          label="模式"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'generate', label: '生成' },
            { value: 'decode', label: '识别图片' }
          ]}
        />
        {mode === 'generate' ? (
          <div className="tw-pair">
            {p.kind === 'wifi' ? (
              <Panel title="Wi-Fi" actions={kindSwitch}>
                <div className="group">
                  <Field label="名称">
                    <input value={ssid} placeholder="必填" onChange={(e) => setSsid(e.target.value)} />
                  </Field>
                  <Field label="密码">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <Field div block label="加密方式">
                    <Segmented
                      label="加密方式"
                      value={p.security}
                      onChange={(security) => setP({ ...p, security })}
                      options={[
                        { value: 'WPA', label: 'WPA' },
                        { value: 'WEP', label: 'WEP' },
                        { value: 'nopass', label: '无密码' }
                      ]}
                    />
                  </Field>
                  <SwitchRow checked={p.hidden} onChange={(hidden) => setP({ ...p, hidden })}>
                    隐藏网络
                  </SwitchRow>
                </div>
              </Panel>
            ) : (
              <TextBox label="文字或网址" value={text} onChange={setText} example="https://shunshou.app" actions={kindSwitch} />
            )}
            <Panel
              title="二维码"
              actions={
                <>
                  <button
                    type="button"
                    className="btn-soft btn-sm"
                    disabled={!result}
                    onClick={() => result && save(new Blob([result.svg], { type: 'image/svg+xml' }), 'qrcode.svg')}
                  >
                    SVG
                  </button>
                  <button type="button" className="btn btn-sm" disabled={!result} onClick={() => result && save(result.png, 'qrcode.png')}>
                    <DownloadIcon size={15} />
                    下载 PNG
                  </button>
                </>
              }
            >
              <div className="qr-stage">
                {result ? (
                  <img className="office-qr" src={result.url} alt="生成的二维码" />
                ) : (
                  <p className="office-note">填好内容，二维码会出现在这里</p>
                )}
              </div>
            </Panel>
          </div>
        ) : (
          <div className="tw-pair">
            <Panel
              title="图片"
              actions={
                <button type="button" className="btn-soft btn-sm" onClick={pickScan}>
                  <ImageIcon size={15} />
                  {scan ? '换一张' : '选择图片'}
                </button>
              }
              foot={scan?.name}
            >
              <div className="qr-stage">
                {scanUrl ? (
                  <img className="qr-scan" src={scanUrl} alt="要识别的图片" />
                ) : (
                  <p className="office-note">选一张带二维码的图片，也可以拖进来或粘贴</p>
                )}
              </div>
            </Panel>
            <TextBox label="识别结果" value={decoded} readOnly output={{ ready: !!decoded }} placeholder="识别出的内容会出现在这里" />
          </div>
        )}
        <Status busy={busy} error={error} ready={!!result || !!decoded} />
      </TextLayout>
    </OfficePage>
  );
}

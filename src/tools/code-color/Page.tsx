import { toast } from '../../components/Toast';
import { useMemo, useState, type CSSProperties } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { Led, SegField } from '../../components/ui';
import { CodeExtraResult } from '../../components/kit/CodeExtraResult';
import { toolById } from '../../tools';
import { usePersisted } from '../../lib/settings';
import { copyText, saveBlob } from '../../lib/files';
import { colorInfo, contrastInfo, makePalette } from './logic';
import '../../components/kit/CodeExtra.css';
export default function Page() {
  const [settings, setSettings] = usePersisted('code-color', {
    color: '#1f4fd1',
    background: '#ffffff',
    palette: 'shades' as 'shades' | 'analogous' | 'complementary'
  });
  const [status, setStatus] = useState('');
  const [picking, setPicking] = useState(false);
  const analysis = useMemo(() => {
    try {
      return { info: colorInfo(settings.color), palette: makePalette(settings.color, settings.palette), error: '' };
    } catch (e) {
      return { info: null, palette: [], error: e instanceof Error ? e.message : '颜色无效' };
    }
  }, [settings.color, settings.palette]);
  const contrast = useMemo(() => {
    try {
      return { result: contrastInfo(settings.color, settings.background), error: '' };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : '无法计算对比度' };
    }
  }, [settings.color, settings.background]);
  async function pickScreen() {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropper) return;
    setPicking(true);
    setStatus('点击屏幕上的颜色，按 Esc 取消');
    try {
      const result = await new EyeDropper().open();
      setSettings((s) => ({ ...s, color: result.sRGBHex }));
      setStatus('已取色');
    } catch {
      setStatus('已取消取色');
    } finally {
      setPicking(false);
    }
  }
  const info = analysis.info;
  return (
    <ToolPage
      tool={toolById('code-color')!}
      sub={
        <>
          转换色值，检查文字是否清晰{' '}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="ce-stack">
        <section className="ce-panel ce-stack">
          <div className="ce-row">
            <label className="ce-field">
              输入颜色
              <input
                value={settings.color}
                onChange={(e) => setSettings({ ...settings, color: e.target.value })}
                placeholder="#1f4fd1 / rgb(31 79 209) / oklch(50% .2 265)"
                spellCheck={false}
              />
            </label>
            <label className="ce-field">
              取色器
              <input type="color" value={info?.picker || '#000000'} onChange={(e) => setSettings({ ...settings, color: e.target.value })} />
            </label>
            {'EyeDropper' in window && (
              <button className="btn-soft" disabled={picking} onClick={pickScreen}>
                从屏幕取色
              </button>
            )}
          </div>
          {status && (
            <p role="status" className="ce-note">
              {status}
            </p>
          )}
          {analysis.error ? (
            <p role="alert" className="ce-error">
              {analysis.error}
            </p>
          ) : (
            info && (
              <>
                <div className="ce-swatch" aria-label={`颜色预览 ${info.hex}`} style={{ '--sample-color': info.rgb } as CSSProperties} />
                <div className="ce-status">
                  <Led status="done" />
                  色值已转换{info.clipped ? ' · 超出 sRGB 色域，HEX / RGB / HSL 已裁剪' : ''}
                </div>
                <CodeExtraResult label="HEX" value={info.hex} />
                <CodeExtraResult label="RGB" value={info.rgb} />
                <CodeExtraResult label="HSL" value={info.hsl} />
                <CodeExtraResult label="OKLCH" value={info.oklch} />
              </>
            )
          )}
        </section>
        <section className="ce-panel ce-stack">
          <h2>文字对比度</h2>
          <label className="ce-field">
            背景色
            <input
              value={settings.background}
              onChange={(e) => setSettings({ ...settings, background: e.target.value })}
              placeholder="#ffffff"
            />
          </label>
          {contrast.result ? (
            <>
              <div
                className="ce-contrast"
                style={{ '--sample-fg': contrast.result.foreground, '--sample-bg': contrast.result.background } as CSSProperties}
              >
                <strong>顺手，让文字清晰一点</strong>
                <p>这是一段普通大小的示例文字。Aa 123</p>
              </div>
              <p className="ce-large">{contrast.result.ratio.toFixed(2)} : 1</p>
              <div className="ce-row">
                <span>普通文字 AA：{contrast.result.aa ? '通过' : '未通过'}</span>
                <span>普通文字 AAA：{contrast.result.aaa ? '通过' : '未通过'}</span>
                <span>大字 AA：{contrast.result.large ? '通过' : '未通过'}</span>
              </div>
              <p className="ce-note">
                按 WCAG 2.x：正文 AA ≥ 4.5:1、AAA ≥ 7:1；大字（24px，或粗体 18.7px）AA ≥ 3:1。半透明的前景先和背景合成再算。
              </p>
            </>
          ) : (
            <p role="status" className="ce-error">
              {contrast.error}
            </p>
          )}
        </section>
        {info && (
          <section className="ce-panel ce-stack">
            <h2>生成色板</h2>
            <SegField
              label="配色方式"
              value={settings.palette}
              onChange={(palette) => setSettings({ ...settings, palette })}
              options={[
                { value: 'shades', label: '同色明暗' },
                { value: 'analogous', label: '相邻色' },
                { value: 'complementary', label: '互补色' }
              ]}
            />
            <div className="ce-palette">
              {analysis.palette.map((color, i) => (
                <button
                  key={i}
                  aria-label={`复制颜色 ${color}`}
                  onClick={async () => {
                    const ok = await copyText(color);
                    toast(ok ? `已复制 ${color}` : '复制失败，请手动复制色值', ok ? 'done' : 'error');
                  }}
                >
                  <span style={{ '--sample-color': color } as CSSProperties} />
                  <small>{color}</small>
                </button>
              ))}
            </div>
            <button
              className="btn-soft"
              onClick={() => {
                saveBlob(
                  new Blob([`:root {\n${analysis.palette.map((color, i) => `  --palette-${i + 1}: ${color};`).join('\n')}\n}\n`], {
                    type: 'text/css'
                  }),
                  'palette.css'
                );
                toast('已开始下载');
              }}
            >
              下载 CSS 色板
            </button>
          </section>
        )}
      </div>
    </ToolPage>
  );
}

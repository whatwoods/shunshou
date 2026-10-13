import { useEffect, useRef, useState } from 'react';
import { toast } from '../../components/Toast';
import { DownloadIcon, ExampleButton, Field, Segmented } from '../../components/ui';
import {
  OfficePage,
  Panel,
  SideGroup,
  TextBox,
  TextLayout,
  useIncoming,
  useOfficeRead,
  usePreference,
  Status
} from '../../components/kit/OfficeKit';
import { saveBlob } from '../../lib/files';
import { useShortcuts } from '../../lib/useShortcuts';
import './html-preview.css';
import { useMedia, TOUCH } from '../../lib/useMedia';

// 线上静态托管会去掉 .html 后缀；隔离页让所有用户内容保持无脚本沙盒。
const FRAME = import.meta.env.DEV ? '/html-preview-frame.html' : '/html-preview-frame';
const READY = 'shunshou-html-preview-ready';

const DEVICES = {
  phone: { label: '手机', width: 390, height: 760 },
  tablet: { label: '平板', width: 820, height: 1060 },
  desktop: { label: '桌面', width: 0, height: 680 }
};
type Device = keyof typeof DEVICES;

const EXAMPLE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>活动报名</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f1ea; color: #1d1d1f; font: 16px/1.6 system-ui, sans-serif; }
    .card { width: min(360px, 88vw); padding: 28px; border-radius: 22px; background: #fff; box-shadow: 0 20px 50px -24px rgba(0, 0, 0, 0.35); }
    h1 { margin: 0 0 4px; font-size: 24px; }
    p { margin: 0 0 18px; color: #6e6e73; }
    button { width: 100%; height: 44px; border: 0; border-radius: 12px; background: #2f5bea; color: #fff; font-size: 16px; cursor: pointer; }
    .count { margin-top: 12px; text-align: center; font-size: 14px; color: #6e6e73; }
    @media (max-width: 480px) { .card { padding: 22px; } h1 { font-size: 21px; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>周六手冲咖啡课</h1>
    <p>10 月 18 日 14:00 · 三楼茶水间 · 限 12 人</p>
    <button id="join">我要报名</button>
    <div class="count">已有 <b id="n">7</b> 人报名</div>
  </div>
  <script>
    // 预览不执行脚本；下载的 HTML 保留完整代码
    let n = 7;
    document.getElementById('join').onclick = () => {
      document.getElementById('n').textContent = ++n;
    };
  </script>
</body>
</html>
`;

export default function Page() {
  const [html, setHtml] = useState('');
  const [name, setName] = useState('page.html');
  const [p, setP] = usePreference('office-html', { device: 'desktop' as Device });
  const touch = useMedia(TOUCH);
  const { reading, error, read, invalidate } = useOfficeRead();

  // 输入停顿一下再刷新预览，打字时不会一直闪
  const [shown, setShown] = useState({ html: '', n: 0 });
  useEffect(() => {
    const t = setTimeout(() => setShown((s) => ({ html, n: s.n + 1 })), html ? 320 : 0);
    return () => clearTimeout(t);
  }, [html]);

  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ html: shown.html });
  latest.current = { html: shown.html };
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win || e.data !== READY) return;
      // 隔离页是独立来源，只能用 '*'；收件方就是刚刚创建的这个 iframe
      win.postMessage(latest.current, '*');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 设备宽度比预览区宽时整体等比缩小
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const device = DEVICES[p.device] || DEVICES.desktop;
  // 手机、平板外面有一圈 6 px 的边框
  const avail = room - (device.width ? 12 : 0);
  const scale = device.width && avail > 0 && device.width > avail ? avail / device.width : 1;

  function files(fs: File[]) {
    void read(
      async () => {
        const file = fs[0];
        if (!/\.(html?|xhtml|txt)$/i.test(file.name) && file.type !== 'text/html') throw new Error('请选择 HTML 文件');
        if (file.size > 5_000_000) throw new Error('文件超过 5 MB，预览会很卡，请换个小一点的页面');
        return { text: await file.text(), name: file.name.replace(/\.(xhtml|txt)$/i, '.html') };
      },
      (v) => {
        setHtml(v.text);
        setName(v.name);
      }
    );
  }
  useIncoming(files);

  function download() {
    saveBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
    toast('已开始下载');
  }
  useShortcuts({ save: () => (html ? download() : false) });

  return (
    <OfficePage id="office-html" sub="在隔离的沙盒里预览网页代码。">
      <TextLayout
        side={
          <>
            <p className="group-note">仅预览 HTML 和样式，不执行脚本；下载时保留完整代码。</p>
            <SideGroup title="设备" note="内嵌的 data: 图片照常显示；链接在预览里打不开。">
              <Field div block label="宽度">
                <Segmented
                  label="设备"
                  value={p.device}
                  onChange={(d) => setP({ device: d })}
                  options={(Object.keys(DEVICES) as Device[]).map((d) => ({ value: d, label: DEVICES[d].label }))}
                />
              </Field>
            </SideGroup>
          </>
        }
      >
        <div className="html-split">
          <TextBox
            label="HTML 代码"
            value={html}
            textareaClass="html-code"
            placeholder={touch ? '在这里粘贴 HTML' : '在这里粘贴 HTML，或把 .html 文件拖进来'}
            onFiles={files}
            accept=".html,.htm,.xhtml,.txt"
            onChange={(v) => {
              invalidate();
              setHtml(v);
            }}
            actions={
              !html && (
                <ExampleButton
                  onClick={() => {
                    invalidate();
                    setHtml(EXAMPLE);
                    setName('活动报名.html');
                  }}
                />
              )
            }
          />
          <Panel
            title="预览"
            className="html-panel"
            actions={
              <>
                <span className="html-stage-meta">
                  {device.width ? `${device.width} px` : '自适应宽度'}
                  {scale < 1 && ` · 缩放 ${Math.round(scale * 100)}%`}
                </span>
                <button type="button" className="btn-soft btn-sm" disabled={!html} onClick={download}>
                  <DownloadIcon size={15} />
                  下载
                </button>
                <button
                  type="button"
                  className="btn-soft btn-sm"
                  disabled={!shown.html}
                  onClick={() => stage.current?.requestFullscreen?.().catch(() => toast('浏览器不允许全屏', 'error'))}
                >
                  全屏
                </button>
              </>
            }
          >
            <div ref={stage} className={'html-stage is-' + p.device}>
              {shown.html ? (
                <div className="html-device" style={{ width: device.width ? device.width * scale : '100%', height: device.height * scale }}>
                  {/* 隔离页限制内层 srcdoc 的跳转；用户脚本始终禁用。 */}
                  <iframe
                    key={shown.n}
                    ref={frame}
                    title="HTML 预览"
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    src={FRAME}
                    style={frameStyle(device.width, device.height, scale)}
                  />
                </div>
              ) : (
                <div className="html-empty">
                  <p>预览会出现在这里</p>
                </div>
              )}
            </div>
          </Panel>
        </div>
        <Status busy={reading} error={error} ready={!!html} />
      </TextLayout>
    </OfficePage>
  );
}

function frameStyle(width: number, height: number, scale: number) {
  return {
    width: width || '100%',
    height,
    transform: scale < 1 ? `scale(${scale})` : undefined,
    transformOrigin: '0 0'
  };
}

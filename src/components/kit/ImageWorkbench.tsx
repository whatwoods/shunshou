import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ToolPage } from '../ToolPage';
import { CloseIcon, DownloadIcon, Field, Led, PlusIcon, Segmented, Slider, SwitchRow } from '../ui';
import { DropOverlay, DropZone } from '../DropZone';
import { ActionBar, KeyHint } from '../ActionBar';
import { NextSteps } from '../FileMatch';
import { toolById } from '../../tools';
import { useFileDrop } from '../../lib/useFileDrop';
import { pickFiles, saveBlob, saveZip, fmtSize, baseName } from '../../lib/files';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { isAnimated } from '../../lib/image/animated';
import { useShortcuts } from '../../lib/useShortcuts';
import { defaults, type Mode, type Settings, type Result } from '../../lib/image/types';
import { useHandOff } from '../../lib/useHandOff';
import { toast } from '../Toast';
import './ImageWorkbench.css';
import { dragCrop, type CropDrag, type CropRect } from '../../lib/image/crop';
import { Select } from '../Select';

interface Item {
  id: string;
  file: File;
  url: string;
  status: 'idle' | 'work' | 'done' | 'error';
  result?: Result;
  output?: string;
  error?: string;
  animated?: boolean;
}

const SUB: Record<Mode, string> = {
  convert: '格式互转，iPhone 的 HEIC 也行。',
  resize: '按长边、宽高或比例批量缩放。',
  crop: '常用比例和社交平台尺寸。',
  exif: '发出去前，抹掉地点和相机信息。',
  watermark: '文字或图片水印，可批量。',
  svg: '去掉冗余，图标更小。'
};
const RUN: Record<Mode, string> = {
  convert: '开始转换',
  resize: '开始缩放',
  crop: '裁剪这张',
  exif: '清除元数据',
  watermark: '加水印',
  svg: '开始优化'
};
// 只有这些格式有“画质”可调
const LOSSY = ['jpeg', 'webp', 'avif'];
const lossySource = (f: File) => /jpe?g|webp|avif|heic|heif/i.test(f.type + ' ' + f.name);

// 水印文字是用户内容，不存本机
const CONTENT = ['text'] as const;

export function ImageWorkbench({ mode }: { mode: Mode }) {
  const key = `image-${mode}`;
  const tool = toolById(key)!;
  const initial = useMemo(() => (mode === 'convert' ? defaults : { ...defaults, format: 'keep' }), [mode]);
  const [settings, setSettings] = usePersisted<Settings>(key, initial, CONTENT);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [logo, setLogo] = useState<File>();
  const [ratio, setRatio] = useState(0);
  const [cropPreview, setCropPreview] = useState('');
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const worker = useRef<Worker | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const alive = useRef(true);
  const accept = mode === 'svg' ? '.svg' : 'image/*,.heic,.heif';

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  // 设置一改（包括“恢复默认”），已经做好的结果就不对应了：退回待处理，旧结果的地址一并回收
  const signature = JSON.stringify(settings) + (logo?.name ?? '');
  const live = useRef(signature);
  live.current = signature;
  useSettingsLock(busy);
  useEffect(() => {
    setItems((list) => {
      const stale = list.filter((i) => i.status === 'done' || i.status === 'error');
      if (!stale.length) return list;
      stale.forEach((i) => {
        if (i.output) URL.revokeObjectURL(i.output);
      });
      return list.map((i) => (stale.includes(i) ? { ...i, status: 'idle', result: undefined, output: undefined, error: undefined } : i));
    });
  }, [signature]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      worker.current?.terminate();
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.url);
        if (i.output) URL.revokeObjectURL(i.output);
      });
    };
  }, []);
  const add = useCallback(
    (files: File[]) => {
      const accepted = files.filter((f) =>
        mode === 'svg'
          ? /\.svg$/i.test(f.name) || f.type === 'image/svg+xml'
          : f.type.startsWith('image/') || /\.(heic|heif|avif|bmp)$/i.test(f.name)
      );
      if (!accepted.length && files.length) setMessage(mode === 'svg' ? '请选择 SVG 文件' : '请选择图片文件');
      const fresh = accepted.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'idle' as const }));
      setItems((old) => [...old, ...fresh]);
      setSelected((old) => old || fresh[0]?.id || '');
      // 动图（GIF、APNG、动画 WebP）只能处理第一帧：认出来以后在列表和提示里说清楚，不能悄悄变成静态图
      if (mode !== 'svg')
        for (const f of fresh)
          void isAnimated(f.file)
            .then((yes) => yes && setItems((list) => list.map((i) => (i.id === f.id ? { ...i, animated: true } : i))))
            .catch(() => {});
    },
    [mode]
  );
  useHandOff(add);
  const dragging = useFileDrop(add);
  const pick = () => pickFiles(accept).then(add);
  const item = items.find((i) => i.id === selected) ?? items[0];
  const done = items.filter((i) => i.result && i.status === 'done');
  const moving = items.filter((i) => i.animated);
  // 裁剪一次只处理当前这张，其他模式处理整批
  const batch = mode === 'crop' ? (item ? [item] : []) : items;
  const finished = batch.length > 0 && batch.every((i) => i.status === 'done');
  const outputs = (mode === 'crop' ? done.filter((i) => i.id === item?.id) : done).map((i) => ({ blob: i.result!.blob, name: name(i) }));

  useEffect(() => {
    if (mode !== 'crop' || !item) return;
    setCropPreview('');
    const w = new Worker(new URL('../../lib/image/worker.ts', import.meta.url), { type: 'module' });
    let url = '';
    w.onmessage = (e) => {
      if (e.data.ok) {
        url = URL.createObjectURL(e.data.result.blob);
        setCropPreview(url);
      } else setMessage(e.data.error);
      w.terminate();
    };
    w.onerror = () => {
      setMessage('预览打不开，换一张试试');
      w.terminate();
    };
    w.postMessage({
      mode: 'crop',
      file: item.file,
      settings: { ...defaults, format: 'png', rotation: settings.rotation, flip: settings.flip }
    });
    return () => {
      w.terminate();
      if (url) URL.revokeObjectURL(url);
    };
  }, [mode, item?.id, settings.rotation, settings.flip]);

  const process = async (inspect = false) => {
    if (busy) return;
    // 这一轮按开始时的设置处理；中途设置变了，后面的不再处理，刚做完的也不算数
    const at = signature;
    setBusy(true);
    setMessage('');
    for (const current of batch) {
      if (!alive.current || live.current !== at) break;
      setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: 'work', error: undefined } : i)));
      try {
        const w = new Worker(new URL('../../lib/image/worker.ts', import.meta.url), { type: 'module' });
        worker.current = w;
        const result = await new Promise<Result>((resolve, reject) => {
          w.onmessage = (e) => (e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)));
          w.onerror = () => reject(new Error('处理模块没能启动，请刷新重试'));
          w.postMessage({ mode, file: current.file, settings, watermark: logo, inspect });
        });
        w.terminate();
        if (!alive.current) break;
        if (live.current !== at) {
          setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: 'idle' } : i)));
          break;
        }
        const output = inspect ? undefined : URL.createObjectURL(result.blob);
        if (current.output) URL.revokeObjectURL(current.output);
        setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: inspect ? 'idle' : 'done', result, output } : i)));
      } catch (e) {
        worker.current?.terminate();
        if (alive.current)
          setItems((list) =>
            list.map((i) => (i.id === current.id ? { ...i, status: 'error', error: e instanceof Error ? e.message : String(e) } : i))
          );
      }
    }
    if (alive.current) setBusy(false);
  };
  const remove = (id: string) => {
    const old = items.find((i) => i.id === id);
    if (old) {
      URL.revokeObjectURL(old.url);
      if (old.output) URL.revokeObjectURL(old.output);
    }
    setItems((list) => list.filter((i) => i.id !== id));
  };
  const clearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.url);
      if (i.output) URL.revokeObjectURL(i.output);
    });
    setItems([]);
    setSelected('');
    setMessage('');
  };
  function name(i: Item) {
    return `${baseName(i.file.name)}-${mode}.${i.result!.extension}`;
  }
  const download = () => {
    if (!outputs.length) {
      toast('还没有处理好的图片');
      return;
    }
    if (outputs.length === 1) {
      saveBlob(outputs[0].blob, outputs[0].name);
      toast(`已下载 ${outputs[0].name}`);
      return;
    }
    saveZip(outputs, `顺手-${tool.name}.zip`)
      .then(() => toast(`已打包 ${outputs.length} 张图片`))
      .catch(() => setMessage('打包失败，请逐张下载'));
  };
  useShortcuts({
    run: () => {
      if (!batch.length || busy) return false;
      void process();
    },
    save: download
  });

  const number = (label: string, k: keyof Settings, min = 1, max = 32767) => (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(Number(settings[k]) * 100) / 100}
        onChange={(e) => {
          const value = Math.max(min, Math.min(max, Number(e.target.value)));
          if (mode === 'crop' && ratio && (k === 'cropWidth' || k === 'cropHeight')) {
            const maxWidth = Math.min(100, (100 * ratio * natural.height) / natural.width);
            const width = Math.min(maxWidth, k === 'cropWidth' ? value : ((value * natural.height) / natural.width) * ratio);
            update({ cropWidth: width, cropHeight: (width * natural.width) / natural.height / ratio, x: 0, y: 0 });
          } else if (mode === 'crop' && k === 'x') update({ x: Math.min(value, 100 - settings.cropWidth) });
          else if (mode === 'crop' && k === 'y') update({ y: Math.min(value, 100 - settings.cropHeight) });
          else if (mode === 'crop' && k === 'cropWidth') update({ cropWidth: Math.min(value, 100 - settings.x) });
          else if (mode === 'crop' && k === 'cropHeight') update({ cropHeight: Math.min(value, 100 - settings.y) });
          else update({ [k]: value });
        }}
      />
    </Field>
  );
  const slider = (label: string, k: 'quality' | 'opacity' | 'size', min: number, max: number, unit = '') => (
    <Field
      div
      block
      label={
        <span className="field-split">
          {label}
          <span className="field-value">
            {settings[k]}
            {unit}
          </span>
        </span>
      }
    >
      <Slider label={label} min={min} max={max} value={settings[k]} onChange={(v) => update({ [k]: v })} />
    </Field>
  );
  const selectRatio = (r: number) => {
    setRatio(r);
    if (!r) return;
    const w = natural.width,
      h = natural.height;
    const cw = Math.min(100, (100 * r * h) / w),
      ch = (cw * w) / h / r;
    update({ x: (100 - cw) / 2, y: (100 - ch) / 2, cropWidth: cw, cropHeight: ch });
  };
  // 裁剪框：框里拖是移动，拖角和边是改大小（选了比例时锁定），框外拖是重新画一个
  const drag = useRef<{ kind: CropDrag; start: CropRect; px: number; py: number; id: number } | null>(null);
  const [cropping, setCropping] = useState(false);
  const toPercent = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { px: ((e.clientX - rect.left) / rect.width) * 100, py: ((e.clientY - rect.top) / rect.height) * 100 };
  };
  const cropDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !natural.width) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 指针已经抬起时拿不到捕获，照样能拖 */
    }
    const kind = ((e.target as HTMLElement).closest<HTMLElement>('[data-crop]')?.dataset.crop || 'draw') as CropDrag;
    const { px, py } = toPercent(e);
    drag.current = {
      kind,
      start: { x: settings.x, y: settings.y, w: settings.cropWidth, h: settings.cropHeight },
      px,
      py,
      id: e.pointerId
    };
    setCropping(true);
  };
  const cropMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const { px, py } = toPercent(e);
    // 拖新框时轻轻一点不算，免得点一下就把框缩成一个小方块
    if (d.kind === 'draw' && Math.hypot(px - d.px, py - d.py) < 1.5) return;
    const aspect = ratio && natural.width ? (ratio * natural.height) / natural.width : 0;
    const r = dragCrop(d.start, d.kind, d.px, d.py, px - d.px, py - d.py, aspect);
    update({ x: r.x, y: r.y, cropWidth: r.w, cropHeight: r.h });
  };
  const cropUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setCropping(false);
  };

  // 画质只对有损格式有意义：PNG、GIF、BMP 时藏起来；“原格式”要看图片本身
  const showQuality = LOSSY.includes(settings.format) || (settings.format === 'keep' && items.some((i) => lossySource(i.file)));
  const formatRow = !['exif', 'svg'].includes(mode) && (
    <>
      <Field label="输出格式">
        <Select value={settings.format} onChange={(e) => update({ format: e.target.value })}>
          {mode !== 'convert' && <option value="keep">原格式</option>}
          {['png', 'jpeg', 'webp', 'avif', 'gif', 'bmp'].map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </Select>
      </Field>
      {showQuality && slider('画质', 'quality', 10, 100)}
    </>
  );

  const before = done.reduce((n, i) => n + i.file.size, 0);
  const after = done.reduce((n, i) => n + i.result!.blob.size, 0);
  const working = items.filter((i) => i.status === 'work' || i.status === 'done').length;

  return (
    <ToolPage
      tool={tool}
      sub={
        <>
          {SUB[mode]}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      {/* 没有图片时版式不变：拖放区占预览的位置，右边的设置可以先选好 */}
      <div className="image-kit">
        {!item ? (
          <DropZone
            className="in-layout"
            accept={accept}
            title={mode === 'svg' ? '把 SVG 拖到这里' : '把图片拖到这里'}
            hint={mode === 'svg' ? '可以多选，也能粘贴' : '可以多选，HEIC 也行，也能粘贴'}
            button={mode === 'svg' ? '选择 SVG' : '选择图片'}
            onFiles={add}
          />
        ) : (
          <section className="image-kit-stage">
            <div
              className={'image-kit-preview' + (mode === 'crop' ? ' is-crop' : '') + (cropping ? ' is-dragging' : '')}
              onPointerDown={mode === 'crop' ? cropDown : undefined}
              onPointerMove={mode === 'crop' ? cropMove : undefined}
              onPointerUp={mode === 'crop' ? cropUp : undefined}
              onPointerCancel={mode === 'crop' ? cropUp : undefined}
            >
              <img
                src={mode === 'crop' ? cropPreview || undefined : (item.output ?? item.url)}
                alt={item.file.name}
                // 只写了 viewBox 的 SVG 没有固有宽度，放在 fit-content 的框里会缩成 0，给它一个显示宽度
                className={item.file.type === 'image/svg+xml' || /\.svg$/i.test(item.file.name) ? 'is-vector' : undefined}
                onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              />
              {mode === 'crop' && cropPreview && (
                <div
                  className="image-kit-crop"
                  data-crop="move"
                  style={{
                    left: `${settings.x}%`,
                    top: `${settings.y}%`,
                    width: `${settings.cropWidth}%`,
                    height: `${settings.cropHeight}%`
                  }}
                >
                  {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
                    <span key={h} className={'image-kit-handle is-' + h} data-crop={h} aria-hidden="true" />
                  ))}
                </div>
              )}
            </div>
            {item.status === 'done' && item.result && (
              <p className="image-kit-caption">
                {mode === 'svg' ? '优化后预览 · ' : '处理后 · '}
                {fmtSize(item.file.size)} → {fmtSize(item.result.blob.size)}
                {item.result.width ? ` · ${item.result.width} × ${item.result.height}` : ''}
              </p>
            )}
            {mode === 'svg' && item.output && (
              <div className="image-kit-original">
                <p>优化前</p>
                <img src={item.url} alt="优化前 SVG" />
              </div>
            )}
            {mode === 'crop' && item.output && (
              <div className="image-kit-original">
                <p>导出预览</p>
                <img src={item.output} alt="裁剪后的结果" />
              </div>
            )}
            {item.result?.metadata && (
              <div className="image-kit-meta">
                {item.result.gps && (
                  <p className="image-kit-error" role="alert">
                    含 GPS 地点，分享前建议清除。
                  </p>
                )}
                <h3>原图元数据</h3>
                <pre>{Object.keys(item.result.metadata).length ? JSON.stringify(item.result.metadata, null, 2) : '没有拍摄信息。'}</pre>
              </div>
            )}
            {message && (
              <p className="image-kit-error" role="alert">
                {message}
              </p>
            )}
            {moving.length > 0 && (
              <p className="image-kit-warn" role="status">
                {moving.length === 1 ? `「${moving[0].file.name}」是动图` : `有 ${moving.length} 张是动图`}：{tool.name}
                只处理第一帧，导出静态图。想保留动画，就别处理它。
              </p>
            )}
            {outputs.length > 0 && !busy && <NextSteps outputs={outputs} from={key} />}
          </section>
        )}

        <aside className="image-kit-side">
          <h2 className="group-title">{mode === 'exif' ? '拍摄信息' : '处理选项'}</h2>
          <fieldset disabled={busy} className="group settings-group">
            {formatRow}
            {mode === 'resize' && (
              <>
                <Field div block label="调整方式">
                  <Segmented
                    label="调整方式"
                    value={settings.resizeMode}
                    onChange={(resizeMode) => update({ resizeMode })}
                    options={[
                      { value: 'long', label: '按长边' },
                      { value: 'box', label: '按宽高' },
                      { value: 'percent', label: '按比例' }
                    ]}
                  />
                </Field>
                {settings.resizeMode === 'percent'
                  ? number('缩放百分比', 'percent', 1, 1000)
                  : number(settings.resizeMode === 'long' ? '长边（像素）' : '宽度（像素）', 'width')}
                {settings.resizeMode === 'box' && (
                  <>
                    {number('高度（像素）', 'height')}
                    <SwitchRow checked={settings.keepRatio} onChange={(keepRatio) => update({ keepRatio })}>
                      保持比例，完整放进宽高里
                    </SwitchRow>
                  </>
                )}
              </>
            )}
            {mode === 'crop' && (
              <>
                <Field label="比例">
                  <Select value={ratio} onChange={(e) => selectRatio(Number(e.target.value))}>
                    <option value={0}>自由裁剪</option>
                    <option value={1}>1:1 · 头像 / 方图</option>
                    <option value={4 / 3}>4:3</option>
                    <option value={16 / 9}>16:9 · 视频封面</option>
                    <option value={9 / 16}>9:16 · 短视频</option>
                    <option value={3 / 4}>3:4 · 小红书</option>
                    <option value={4 / 5}>4:5 · Instagram</option>
                  </Select>
                </Field>
                <Field label="导出尺寸">
                  <Select
                    value={settings.cropPixels ? String(settings.cropPixels) : ''}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      if (w && h) {
                        selectRatio(w / h);
                        update({ cropPixels: w });
                      } else update({ cropPixels: 0 });
                    }}
                  >
                    <option value="">保持裁剪像素</option>
                    <option value="1080x1080">方图 · 1080 × 1080</option>
                    <option value="1080x1440">小红书 · 1080 × 1440</option>
                    <option value="1080x1350">Instagram · 1080 × 1350</option>
                    <option value="1080x1920">竖屏故事 · 1080 × 1920</option>
                  </Select>
                </Field>
                <Field div block label="旋转">
                  <Segmented
                    label="旋转"
                    value={String(settings.rotation)}
                    onChange={(v) => {
                      update({ rotation: Number(v), x: 10, y: 10, cropWidth: 80, cropHeight: 80 });
                      setRatio(0);
                    }}
                    options={[0, 90, 180, 270].map((a) => ({ value: String(a), label: `${a}°` }))}
                  />
                </Field>
                <SwitchRow checked={settings.flip} onChange={(flip) => update({ flip })}>
                  水平翻转
                </SwitchRow>
                {number('左边距 %', 'x', 0, 99)}
                {number('上边距 %', 'y', 0, 99)}
                {number('裁剪宽度 %', 'cropWidth', 1, 100)}
                {number('裁剪高度 %', 'cropHeight', 1, 100)}
              </>
            )}
            {mode === 'watermark' && (
              <>
                <Field block label="水印文字">
                  <input value={settings.text} disabled={!!logo} onChange={(e) => update({ text: e.target.value })} />
                </Field>
                <Field div label={logo ? `图片水印：${logo.name}` : '图片水印'}>
                  {logo ? (
                    <button type="button" className="link-btn" onClick={() => setLogo(undefined)}>
                      改用文字
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-soft btn-sm"
                      onClick={() => pickFiles('image/*', false).then((f) => setLogo(f[0]))}
                    >
                      选择图片
                    </button>
                  )}
                </Field>
                {slider('不透明度', 'opacity', 1, 100, '%')}
                {slider('大小（占图片宽度）', 'size', 1, 30, '%')}
                <Field label="位置">
                  <Select value={settings.position} onChange={(e) => update({ position: e.target.value })}>
                    {[
                      ['top-left', '左上'],
                      ['top-right', '右上'],
                      ['center', '居中'],
                      ['bottom-left', '左下'],
                      ['bottom-right', '右下']
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SwitchRow checked={settings.tile} onChange={(tile) => update({ tile })}>
                  平铺满整张图
                </SwitchRow>
              </>
            )}
            {mode === 'exif' && (
              <Field div label="图里存了什么">
                <button type="button" className="btn-soft btn-sm" disabled={!items.length} onClick={() => process(true)}>
                  查看
                </button>
              </Field>
            )}
            {mode === 'svg' && (
              <>
                {number('小数精度', 'precision', 0, 8)}
                <SwitchRow checked={settings.removeDimensions} onChange={(removeDimensions) => update({ removeDimensions })}>
                  移除固定宽高
                </SwitchRow>
                <SwitchRow checked={settings.cleanupIds} onChange={(cleanupIds) => update({ cleanupIds })}>
                  精简 ID
                </SwitchRow>
              </>
            )}
          </fieldset>
          <p className="group-note">
            {mode === 'convert' && '动图只取第一帧；转 GIF、BMP、JPEG 时透明处铺白。不能导出 HEIC。'}
            {mode === 'resize' && '用 Lanczos 3 缩放，照片缩小更清晰。'}
            {mode === 'crop' &&
              `在图上拖动框，或直接改数字。${settings.cropPixels > 0 ? `导出宽 ${settings.cropPixels} 像素，高按比例。` : ''}`}
            {mode === 'watermark' && '选了图片水印，文字就不用了。'}
            {mode === 'exif' && '不重新编码，画质不变。去掉 EXIF、位置、时间和注释，保留色彩和方向。'}
            {mode === 'svg' && '用 SVGO 多轮优化。ID 被别处引用时，别开“精简 ID”。预览不执行 SVG 里的脚本。'}
          </p>

          {!items.length && <p className="group-note">先选好也行，放进图片后按这里的设置处理。</p>}
          {items.length > 0 && (
            <>
              <h2 className="group-title">图片 · {items.length} 张</h2>
              <div className="group image-kit-list" aria-live="polite">
                {items.map((i) => (
                  <div className={'image-kit-row' + (item?.id === i.id ? ' is-sel' : '')} key={i.id}>
                    <button type="button" className="image-kit-file" aria-pressed={item?.id === i.id} onClick={() => setSelected(i.id)}>
                      <img className="image-kit-thumb" src={i.url} alt="" loading="lazy" decoding="async" />
                      <span>
                        <span className="image-kit-name">{i.file.name}</span>
                        <small>
                          {i.status === 'work'
                            ? '正在处理…'
                            : (i.error ??
                              (i.status === 'done'
                                ? `${fmtSize(i.file.size)} → ${fmtSize(i.result!.blob.size)}`
                                : `${fmtSize(i.file.size)} · 待处理`))}
                          {i.animated && <span> · 动图，只留第一帧</span>}
                          {i.result?.note && <span> · {i.result.note}</span>}
                        </small>
                      </span>
                      <Led status={i.status} />
                    </button>
                    {i.status === 'done' && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`下载 ${name(i)}`}
                        title="下载这一张"
                        onClick={() => {
                          saveBlob(i.result!.blob, name(i));
                          toast(`已下载 ${name(i)}`);
                        }}
                      >
                        <DownloadIcon size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="icon-btn"
                      aria-label={`移除 ${i.file.name}`}
                      onClick={() => remove(i.id)}
                    >
                      <CloseIcon size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {items.length > 0 && (
        <ActionBar
          led={busy ? 'work' : finished ? 'done' : 'idle'}
          status={
            busy
              ? `正在处理 ${working} / ${batch.length}`
              : finished && done.length
                ? `${outputs.length} 张 · ${fmtSize(before)} → ${fmtSize(after)}`
                : `${items.length} 张 · 待处理`
          }
        >
          <button type="button" className="btn-soft" disabled={busy} onClick={clearAll}>
            清空
          </button>
          <button type="button" className="btn-soft" disabled={busy} onClick={pick}>
            <PlusIcon size={15} />
            添加
          </button>
          {finished && outputs.length > 0 ? (
            <button type="button" className="btn" onClick={download}>
              <DownloadIcon size={15} />
              {outputs.length > 1 ? `打包下载 ${outputs.length} 张` : '下载'}
              <KeyHint keys="save" />
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy || !batch.length} onClick={() => process()}>
              {busy ? '正在处理…' : RUN[mode]}
              {!busy && <KeyHint keys="run" />}
            </button>
          )}
        </ActionBar>
      )}
      <DropOverlay show={dragging} title="松手，添加图片" />
    </ToolPage>
  );
}

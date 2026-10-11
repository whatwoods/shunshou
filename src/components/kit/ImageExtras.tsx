import { useCallback, useEffect, useRef, useState } from 'react';
import { ToolPage } from '../ToolPage';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, CopyIcon, DownloadIcon, Field, GripIcon, Led, PlusIcon, Segmented } from '../ui';
import { DropOverlay, DropZone } from '../DropZone';
import { ActionBar, KeyHint } from '../ActionBar';
import { NextSteps } from '../FileMatch';
import { toast } from '../Toast';
import { useHandOff } from '../../lib/useHandOff';
import { useFileDrop } from '../../lib/useFileDrop';
import { usePersisted } from '../../lib/settings';
import { useShortcuts } from '../../lib/useShortcuts';
import { toolById } from '../../tools';
import { pickFiles, saveBlob, copyText, fmtSize } from '../../lib/files';
import { stitchDefaults, type StitchSettings } from '../../lib/image/extras';
import './ImageWorkbench.css';
import './ImageExtras.css';

type Color = { hex: string; rgb: string; alpha?: number };
type Item = { id: string; file: File; url: string };
type Output = { blob: Blob; preview?: Blob; colors?: Color[]; width: number; height: number; url: string; previewUrl?: string };

export function ImageExtras({ mode }: { mode: 'stitch' | 'palette' }) {
  const [items, setItems] = useState<Item[]>([]),
    [settings, setSettings] = usePersisted('image-stitch', stitchDefaults),
    [palette, setPalette] = usePersisted('image-palette', { count: 8 }),
    [output, setOutput] = useState<Output>(),
    [picked, setPicked] = useState<Color>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const count = palette.count;
  const worker = useRef<Worker | null>(null),
    itemsRef = useRef(items),
    outputRef = useRef(output),
    dragId = useRef(''),
    busyRef = useRef(false),
    alive = useRef(true);
  busyRef.current = busy;
  itemsRef.current = items;
  outputRef.current = output;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      worker.current?.terminate();
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
      if (outputRef.current) {
        URL.revokeObjectURL(outputRef.current.url);
        if (outputRef.current.previewUrl) URL.revokeObjectURL(outputRef.current.previewUrl);
      }
    };
  }, []);
  const add = useCallback((files: File[]) => {
    if (busyRef.current) {
      toast('正在处理，完成后再添加');
      return;
    }
    const selected = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!selected.length) {
      if (files.length) toast('请选择图片文件', 'error');
      return;
    }
    const next = selected.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setItems((old) => [...old, ...next]);
  }, []);
  useHandOff(add);
  const dragging = useFileDrop(add);
  const pick = () => pickFiles('image/*,.heic,.heif').then(add);
  // 图片、顺序或设置变了，旧结果就作废
  useEffect(() => {
    const old = outputRef.current;
    if (old) {
      URL.revokeObjectURL(old.url);
      if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
    }
    outputRef.current = undefined;
    setOutput(undefined);
    setPicked(undefined);
  }, [items, settings, count]);
  const update = (s: Partial<StitchSettings>) => setSettings((old) => ({ ...old, ...s }));
  const reorder = (id: string, to: number) =>
    setItems((old) => {
      if (busyRef.current) return old;
      const list = [...old],
        from = list.findIndex((i) => i.id === id);
      if (from < 0 || to < 0 || to >= list.length) return old;
      list.splice(to, 0, list.splice(from, 1)[0]);
      return list;
    });
  const run = (point?: { x: number; y: number }) => {
    if (busyRef.current || !items.length) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const w = new Worker(new URL('../../lib/image/extras-worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (!alive.current) return;
      busyRef.current = false;
      setBusy(false);
      w.terminate();
      if (!e.data.ok) {
        setError(e.data.error);
        return;
      }
      if (e.data.picked) {
        setPicked(e.data.picked);
        return;
      }
      const old = outputRef.current;
      if (old) {
        URL.revokeObjectURL(old.url);
        if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
      }
      const result = e.data;
      setOutput({
        ...result,
        url: URL.createObjectURL(result.blob),
        previewUrl: result.preview ? URL.createObjectURL(result.preview) : undefined
      });
      setPicked(undefined);
    };
    w.onerror = () => {
      w.terminate();
      if (!alive.current) return;
      busyRef.current = false;
      setBusy(false);
      setError('处理失败，换小一点的图片再试');
    };
    w.postMessage({ mode, files: (mode === 'palette' ? items.slice(0, 1) : items).map((i) => i.file), settings, count, point });
  };
  const copy = async (text: string) => {
    const ok = await copyText(text);
    toast(ok ? '已复制' : '复制失败，请重试', ok ? 'done' : 'error');
  };
  const outName = mode === 'palette' ? '调色板.png' : `拼接图.${output?.blob.type === 'image/jpeg' ? 'jpg' : 'png'}`;
  const download = () => {
    if (!output) {
      toast(mode === 'stitch' ? '先生成拼接图' : '先提取调色板');
      return;
    }
    saveBlob(output.blob, outName);
    toast(`已下载 ${outName}`);
  };
  useShortcuts({
    run: () => {
      if (!items.length || busy) return false;
      run();
    },
    save: download
  });

  return (
    <ToolPage
      tool={toolById(`image-${mode}`)!}
      sub={
        <>
          {mode === 'stitch' ? '几张照片拼成长图，或横着排。' : '提取主题色，也能点图取色。'}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      {/* 没有图片时版式不变：拖放区占预览的位置，右边的设置可以先选好 */}
      <div className="image-kit">
        {!items.length ? (
          <DropZone
            className="in-layout"
            accept="image/*,.heic,.heif"
            title="把图片拖到这里"
            hint={mode === 'stitch' ? '按顺序拼起来' : '点图片任意位置取色'}
            button="选择图片"
            onFiles={add}
          />
        ) : (
          <section className="image-kit-stage">
            <div className="image-extra-preview">
              {mode === 'palette' ? (
                <button
                  type="button"
                  className="image-extra-picker"
                  disabled={busy || !output?.previewUrl}
                  aria-label="点图片取色，用键盘时改右侧坐标"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    run({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
                  }}
                >
                  <img src={output?.previewUrl ?? items[0].url} alt="待取色图片" />
                </button>
              ) : (
                <img src={output?.url ?? items[0].url} alt={output ? '拼接结果' : '第一张图片'} />
              )}
            </div>
            {output && (
              <p className="image-kit-caption">
                {output.width} × {output.height} · {fmtSize(output.blob.size)}
                {mode === 'palette' && ' · 点图片任意位置取色'}
              </p>
            )}
            {mode === 'palette' && output?.colors && (
              <>
                <div className="image-extra-colors">
                  {output.colors.map((c) => (
                    <button
                      type="button"
                      key={c.hex}
                      style={{ background: c.hex }}
                      onClick={() => copy(c.hex)}
                      aria-label={`复制颜色 ${c.hex}`}
                    >
                      <span>{c.hex}</span>
                    </button>
                  ))}
                </div>
                {picked && (
                  <p className="image-extra-picked">
                    <span className="image-extra-swatch" style={{ background: picked.hex }} />
                    选中颜色：
                    <button type="button" className="link-btn" onClick={() => copy(picked.hex)}>
                      {picked.hex}
                    </button>
                    <button type="button" className="link-btn" onClick={() => copy(picked.rgb)}>
                      {picked.rgb}
                    </button>
                    {picked.alpha !== undefined && <span>透明度 {Math.round(picked.alpha * 100)}%</span>}
                  </p>
                )}
                <button
                  type="button"
                  className="btn-soft btn-sm image-extra-css"
                  onClick={() => copy(output.colors!.map((c, i) => `--color-${i + 1}: ${c.hex};`).join('\n'))}
                >
                  <CopyIcon size={16} />
                  复制为 CSS 变量
                </button>
              </>
            )}
            {error && (
              <p className="image-kit-error" role="alert">
                {error}
              </p>
            )}
            {mode === 'stitch' && output && !busy && <NextSteps outputs={[{ blob: output.blob, name: outName }]} from="image-stitch" />}
          </section>
        )}
        <aside className="image-kit-side">
          <h2 className="group-title">选项</h2>
          <fieldset disabled={busy} className="group settings-group">
            {mode === 'stitch' ? (
              <>
                <Field div label="方向">
                  <Segmented
                    label="方向"
                    value={settings.direction}
                    onChange={(direction) => update({ direction })}
                    options={[
                      { value: 'vertical', label: '竖向长图' },
                      { value: 'horizontal', label: '横向' }
                    ]}
                  />
                </Field>
                <Field label={`统一${settings.direction === 'vertical' ? '宽度' : '高度'}（像素）`}>
                  <input
                    type="number"
                    min={1}
                    max={8192}
                    value={settings.size}
                    onChange={(e) => update({ size: Number(e.target.value) })}
                  />
                </Field>
                <Field label="图片间距（像素）">
                  <input type="number" min={0} max={500} value={settings.gap} onChange={(e) => update({ gap: Number(e.target.value) })} />
                </Field>
                <Field div block label="背景">
                  <Segmented
                    label="背景"
                    value={settings.background}
                    onChange={(background) => update({ background })}
                    options={[
                      { value: 'white', label: '白色' },
                      { value: 'black', label: '黑色' },
                      { value: 'transparent', label: '透明' }
                    ]}
                  />
                </Field>
                <Field div label="格式">
                  <Segmented
                    label="格式"
                    value={settings.format}
                    onChange={(format) => update({ format })}
                    options={[
                      { value: 'png', label: 'PNG' },
                      { value: 'jpeg', label: 'JPEG' }
                    ]}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="调色板颜色数">
                  <input
                    type="number"
                    min={2}
                    max={16}
                    value={count}
                    onChange={(e) => setPalette({ count: Math.max(2, Math.min(16, Number(e.target.value))) })}
                  />
                </Field>
                <PointPicker disabled={!output || busy} onPick={run} />
              </>
            )}
          </fieldset>
          <p className="group-note">
            {mode === 'stitch' ? '保持各图比例，拖动列表调整顺序。只有 PNG 保留透明背景。' : '取第一张图。点色块复制 HEX，透明像素不计入。'}
          </p>
          {items.length > 0 ? (
            <>
              <h2 className="group-title">图片 · {items.length} 张</h2>
              <div className="group image-kit-list">
                {items.map((i, index) => (
                  <div
                    key={i.id}
                    className="image-kit-row"
                    draggable={!busy && mode === 'stitch'}
                    onDragStart={() => {
                      dragId.current = i.id;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      reorder(dragId.current, index);
                    }}
                  >
                    {mode === 'stitch' && (
                      <span className="drag-grip" aria-hidden="true">
                        <GripIcon />
                      </span>
                    )}
                    <span className="image-kit-file">
                      <img className="image-kit-thumb" src={i.url} alt="" loading="lazy" decoding="async" />
                      <span>
                        <span className="image-kit-name">
                          {mode === 'stitch' ? `${index + 1}. ` : ''}
                          {i.file.name}
                        </span>
                        <small>{fmtSize(i.file.size)}</small>
                      </span>
                    </span>
                    {mode === 'stitch' && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`上移 ${i.file.name}`}
                          disabled={busy || index === 0}
                          onClick={() => reorder(i.id, index - 1)}
                        >
                          <ArrowUpIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`下移 ${i.file.name}`}
                          disabled={busy || index === items.length - 1}
                          onClick={() => reorder(i.id, index + 1)}
                        >
                          <ArrowDownIcon size={16} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`移除 ${i.file.name}`}
                      disabled={busy}
                      onClick={() => {
                        URL.revokeObjectURL(i.url);
                        setItems((old) => old.filter((x) => x.id !== i.id));
                      }}
                    >
                      <CloseIcon size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="group-note">先选好也行，放进图片后按这里的设置处理。</p>
          )}
        </aside>
      </div>
      {items.length > 0 && (
        <ActionBar
          led={busy ? 'work' : output ? 'done' : 'idle'}
          status={
            busy ? '正在处理…' : output ? `${output.width} × ${output.height} · ${fmtSize(output.blob.size)}` : `${items.length} 张图片`
          }
        >
          <button
            type="button"
            className="btn-soft"
            disabled={busy}
            onClick={() => {
              items.forEach((i) => URL.revokeObjectURL(i.url));
              setItems([]);
            }}
          >
            清空
          </button>
          <button type="button" className="btn-soft" disabled={busy} onClick={pick}>
            <PlusIcon size={15} />
            添加
          </button>
          {output ? (
            <button type="button" className="btn" onClick={download}>
              <DownloadIcon size={15} />
              下载{mode === 'palette' ? '调色板' : '拼接图'}
              <KeyHint keys="save" />
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => run()}>
              {busy ? '正在处理…' : mode === 'stitch' ? '生成拼接图' : '提取调色板'}
              {!busy && <KeyHint keys="run" />}
            </button>
          )}
        </ActionBar>
      )}
      <DropOverlay show={dragging} title="松手，添加图片" />
    </ToolPage>
  );
}

function PointPicker({ onPick, disabled }: { onPick: (p: { x: number; y: number }) => void; disabled: boolean }) {
  const [x, setX] = useState(50),
    [y, setY] = useState(50);
  return (
    <>
      <Field label="横向位置 %">
        <input type="number" min={0} max={100} value={x} onChange={(e) => setX(Math.max(0, Math.min(100, Number(e.target.value))))} />
      </Field>
      <Field label="纵向位置 %">
        <input type="number" min={0} max={100} value={y} onChange={(e) => setY(Math.max(0, Math.min(100, Number(e.target.value))))} />
      </Field>
      <Field div label="用键盘取色">
        <button type="button" className="btn-soft btn-sm" disabled={disabled} onClick={() => onPick({ x: x / 100, y: y / 100 })}>
          读取颜色
        </button>
      </Field>
    </>
  );
}

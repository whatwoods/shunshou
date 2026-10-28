import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { CloseIcon, DownloadIcon, Field, Led, PlusIcon, RedoIcon, Segmented, Slider, SwitchRow, UndoIcon } from '../../components/ui';
import { DropOverlay, DropZone } from '../../components/DropZone';
import { ActionBar, KeyHint } from '../../components/ActionBar';
import { NextSteps } from '../../components/FileMatch';
import { Select } from '../../components/Select';
import { toast } from '../../components/Toast';
import { toolById } from '../../tools';
import { useFileDrop } from '../../lib/useFileDrop';
import { useHandOff } from '../../lib/useHandOff';
import { isAnimated } from '../../lib/image/animated';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { MOD, useShortcuts } from '../../lib/useShortcuts';
import { decode } from '../../lib/image/decode';
import { dragCrop, type CropDrag } from '../../lib/image/crop';
import { baseName, fmtSize, pickFiles, saveBlob, saveZip } from '../../lib/files';
import { bounds, type ModelId, type Rect, type Stroke } from './logic';
import { paintStroke, render } from './paint';
import '../../components/kit/ImageWorkbench.css';
import './cutout.css';

type Box = { x: number; y: number; w: number; h: number };
interface Item {
  id: string;
  file: File;
  url: string;
  status: 'idle' | 'work' | 'done' | 'error';
  cut?: Blob;
  cutUrl?: string;
  box?: Box | null;
  size?: { width: number; height: number };
  error?: string;
  animated?: boolean;
  // 只在这个范围里抠（百分比）；修整的笔画；撤回 / 重做用的历史
  range?: Rect;
  strokes: Stroke[];
  past: Snap[];
  future: Snap[];
  rev: number;
}
type Snap = Pick<Item, 'status' | 'cut' | 'cutUrl' | 'box' | 'size' | 'error' | 'range' | 'strokes'>;
const snap = ({ status, cut, cutUrl, box, size, error, range, strokes }: Item): Snap => ({
  status,
  cut,
  cutUrl,
  box,
  size,
  error,
  range,
  strokes
});
const UNCUT = { status: 'idle', cut: undefined, cutUrl: undefined, box: undefined, error: undefined } as const;
const HISTORY = 30;
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
// 结果 / 原图 是看；范围 / 保留 / 擦除 是在图上动手
type EditMode = 'cut' | 'original' | 'range' | 'keep' | 'erase';

const defaults = {
  model: 'fine' as ModelId,
  clean: true,
  bg: 'none' as 'none' | 'white' | 'color',
  color: '#E8F0FF',
  trim: false,
  format: 'png' as 'png' | 'webp' | 'jpeg',
  // 笔刷直径：占图片长边的百分比
  brush: 6
};
const MODEL_SIZE: Record<ModelId, string> = { fast: '4.6 MB', fine: '90 MB' };
const MIME = { png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg' } as const;

export default function Page() {
  const tool = toolById('image-cutout')!;
  const [s, setS] = usePersisted('image-cutout', defaults);
  const update = (patch: Partial<typeof defaults>) => setS((v) => ({ ...v, ...patch }));
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [editMode, setEditMode] = useState<EditMode>('cut');
  const [exported, setExported] = useState<{ signature: string; files: { blob: Blob; name: string }[] }>();
  const worker = useRef<Worker | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const alive = useRef(true);
  useSettingsLock(busy);

  // 换模型或改边缘清理，已经抠好的就不对应了：退回待处理（旧结果进历史，撤回还能找回来）
  const maskSig = `${s.model}:${s.clean}`;
  const live = useRef(maskSig);
  live.current = maskSig;
  useEffect(() => {
    setItems((list) =>
      list.map((i) => {
        if (i.status === 'error') return { ...i, ...UNCUT };
        if (i.status !== 'done') return i;
        return { ...i, ...UNCUT, past: [...i.past, snap(i)].slice(-HISTORY), future: [], rev: i.rev + 1 };
      })
    );
  }, [maskSig]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      worker.current?.terminate();
      itemsRef.current.forEach(revoke);
    };
  }, []);

  const add = useCallback((files: File[]) => {
    const ok = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|bmp)$/i.test(f.name));
    if (!ok.length && files.length) toast('请选择图片文件', 'error');
    const fresh: Item[] = ok.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      status: 'idle',
      strokes: [],
      past: [],
      future: [],
      rev: 0
    }));
    setItems((old) => [...old, ...fresh]);
    setSelected((old) => old || fresh[0]?.id || '');
    for (const item of fresh)
      void isAnimated(item.file)
        .then((yes) => yes && alive.current && setItems((old) => old.map((i) => (i.id === item.id ? { ...i, animated: true } : i))))
        .catch(() => {});
  }, []);
  useHandOff(add);
  const dragging = useFileDrop(add);
  const pick = () => pickFiles('image/*,.heic,.heif').then(add);
  const item = items.find((i) => i.id === selected) ?? items[0];
  const done = items.filter((i) => i.status === 'done' && i.cut);
  const finished = items.length > 0 && items.every((i) => i.status === 'done');
  const hasCut = item?.status === 'done' && !!item.cut && !!item.size;
  // 还没抠好时只能看原图、框范围
  const mode: EditMode = hasCut ? editMode : editMode === 'range' ? 'range' : 'original';
  const brushing = mode === 'keep' || mode === 'erase';
  const showCanvas = hasCut && (mode === 'cut' || brushing);

  // 改动都走这里：先把当前状态存进历史，再改
  const commit = (id: string, patch: (i: Item) => Partial<Snap>) =>
    setItems((list) =>
      list.map((i) => (i.id === id ? { ...i, ...patch(i), past: [...i.past, snap(i)].slice(-HISTORY), future: [], rev: i.rev + 1 } : i))
    );
  const travel = (dir: 'undo' | 'redo') => {
    if (busy || !item || !(dir === 'undo' ? item.past : item.future).length) return false;
    setItems((list) =>
      list.map((i) => {
        if (i.id !== item.id) return i;
        const past = [...i.past],
          future = [...i.future];
        const to = dir === 'undo' ? past.pop() : future.pop();
        if (!to) return i;
        (dir === 'undo' ? future : past).push(snap(i));
        return { ...i, ...to, past, future, rev: i.rev + 1 };
      })
    );
  };
  // 改了范围，旧结果就不算数了，等着重抠
  const setRange = (id: string, range: Rect | undefined) =>
    commit(id, (i) => ({ range, ...(i.status === 'done' || i.status === 'error' ? UNCUT : {}) }));

  // 预览画布：抠图结果 + 修整笔画。“保留”要从原图取像素，原图按结果的尺寸缓存一份
  const canvas = useRef<HTMLCanvasElement>(null);
  const bitmaps = useRef(new WeakMap<Blob, Promise<ImageBitmap>>());
  const originals = useRef(new Map<string, Promise<HTMLCanvasElement>>());
  const ready = useRef<HTMLCanvasElement | null>(null);
  const bitmap = (b: Blob) => {
    let p = bitmaps.current.get(b);
    if (!p) bitmaps.current.set(b, (p = createImageBitmap(b)));
    return p;
  };
  const original = (i: Item) => {
    let p = originals.current.get(i.id);
    if (!p) {
      const { width, height } = i.size!;
      p = decode(i.file).then((bmp) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, width, height);
        bmp.close();
        return c;
      });
      p.catch(() => originals.current.delete(i.id));
      originals.current.set(i.id, p);
    }
    return p;
  };
  const needOriginal = mode === 'keep' || !!item?.strokes.some((st) => st.mode === 'keep');
  useEffect(() => {
    const c = canvas.current;
    ready.current = null;
    if (!showCanvas || !item?.cut || !c) return;
    let off = false;
    Promise.all([bitmap(item.cut), needOriginal ? original(item) : null])
      .then(([b, o]) => {
        if (off) return;
        ready.current = o;
        render(c.getContext('2d')!, b, o, item.strokes);
      })
      .catch(() => !off && toast('原图读不出来，“保留”用不了', 'error'));
    return () => {
      off = true;
    };
  }, [item?.id, item?.cut, item?.strokes, showCanvas, needOriginal]);

  function getWorker() {
    if (!worker.current) worker.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    return worker.current;
  }

  const process = async () => {
    if (busy) return;
    const at = maskSig;
    setBusy(true);
    for (const current of itemsRef.current.filter((i) => i.status !== 'done')) {
      if (!alive.current || live.current !== at) break;
      const before: Snap = { ...snap(current), ...UNCUT };
      setSelected(current.id);
      setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: 'work', error: undefined } : i)));
      try {
        const w = getWorker();
        const r = await new Promise<{ blob: Blob; box: Box | null; width: number; height: number }>((resolve, reject) => {
          w.onmessage = (e) => {
            const d = e.data;
            if (d.id !== current.id) return;
            if (d.stage === 'download')
              setStage(d.total ? `第一次使用，正在下载模型 ${Math.round((d.loaded / d.total) * 100)}%` : '正在下载模型…');
            else if (d.stage === 'infer') setStage('正在抠图…');
            else if (d.ok) resolve(d);
            else reject(new Error(d.error));
          };
          w.onerror = () => reject(new Error('抠图模块没能启动，请刷新重试'));
          w.postMessage({ id: current.id, file: current.file, model: s.model, clean: s.clean, range: current.range });
        });
        if (!alive.current) break;
        if (live.current !== at) {
          setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: 'idle' } : i)));
          break;
        }
        const cutUrl = URL.createObjectURL(r.blob);
        // 抠完也算一步：撤回就回到抠之前，换个范围或效果再抠
        setItems((list) =>
          list.map((i) =>
            i.id === current.id
              ? {
                  ...i,
                  status: 'done',
                  cut: r.blob,
                  cutUrl,
                  box: r.box,
                  size: { width: r.width, height: r.height },
                  past: [...i.past, before].slice(-HISTORY),
                  future: [],
                  rev: i.rev + 1
                }
              : i
          )
        );
        setEditMode('cut');
      } catch (e) {
        // Worker 出错（多半是内存不够）就整个换掉，下一张重新开始
        worker.current?.terminate();
        worker.current = null;
        if (alive.current)
          setItems((list) =>
            list.map((i) => (i.id === current.id ? { ...i, status: 'error', error: e instanceof Error ? e.message : String(e) } : i))
          );
      }
    }
    if (alive.current) {
      setBusy(false);
      setStage('');
    }
  };

  // 背景、裁边、格式只在导出时合成，改了不用重新抠
  const format = s.bg === 'none' && s.format === 'jpeg' ? 'png' : s.format;
  const ext = format === 'jpeg' ? 'jpg' : format;
  const fileName = (i: Item) => `${baseName(i.file.name)}-抠图.${ext}`;
  async function compose(i: Item): Promise<Blob> {
    const { width, height } = i.size!;
    if (s.bg === 'none' && !s.trim && format === 'png' && !i.strokes.length) return i.cut!;
    // 先把修整的笔画画上去，主体范围也要按画完的算
    let src: CanvasImageSource = await bitmap(i.cut!);
    let box = i.box;
    if (i.strokes.length) {
      const full = document.createElement('canvas');
      full.width = width;
      full.height = height;
      const fctx = full.getContext('2d', { willReadFrequently: true })!;
      render(fctx, src, i.strokes.some((st) => st.mode === 'keep') ? await original(i) : null, i.strokes);
      if (s.trim) {
        const a = fctx.getImageData(0, 0, width, height).data;
        box = bounds((k) => a[k * 4 + 3], width, height);
      }
      src = full;
    }
    if (!s.trim || !box) box = { x: 0, y: 0, w: width, h: height };
    const c = document.createElement('canvas');
    c.width = box.w;
    c.height = box.h;
    const ctx = c.getContext('2d')!;
    if (s.bg !== 'none') {
      ctx.fillStyle = s.bg === 'white' ? '#ffffff' : s.color;
      ctx.fillRect(0, 0, box.w, box.h);
    }
    ctx.drawImage(src, -box.x, -box.y);
    return new Promise((resolve, reject) =>
      c.toBlob(
        (b) => (b?.type === MIME[format] ? resolve(b) : reject(new Error('浏览器不支持这个输出格式，请选择 PNG'))),
        MIME[format],
        0.92
      )
    );
  }
  const exportSig = `${maskSig}:${s.bg}:${s.color}:${s.trim}:${format}:${done.map((i) => `${i.id}.${i.rev}`).join()}`;
  const outputs = !busy && exported?.signature === exportSig ? exported.files : [];
  useEffect(() => {
    let off = false;
    setExported(undefined);
    if (busy || !done.length) {
      return;
    }
    Promise.all(done.map(async (i) => ({ blob: await compose(i), name: fileName(i) })))
      .then((files) => !off && setExported({ signature: exportSig, files }))
      .catch((error) => !off && toast(error instanceof Error ? error.message : '导出失败，请重试', 'error'));
    return () => {
      off = true;
    };
  }, [exportSig, busy]);

  const download = () => {
    if (!outputs.length) return void toast('还没有抠好的图片');
    if (outputs.length === 1) {
      saveBlob(outputs[0].blob, outputs[0].name);
      return void toast(`已下载 ${outputs[0].name}`);
    }
    saveZip(outputs, `顺手-抠图.zip`)
      .then(() => toast(`已打包 ${outputs.length} 张图片`))
      .catch(() => toast('打包失败，请逐张下载', 'error'));
  };
  useShortcuts({
    run: () => {
      if (!items.length || busy) return false;
      void process();
    },
    save: download,
    undo: () => travel('undo'),
    redo: () => travel('redo')
  });
  // 历史里的旧结果也占着地址，删图时一起还
  function revoke(i: Item) {
    URL.revokeObjectURL(i.url);
    for (const x of [i, ...i.past, ...i.future]) if (x.cutUrl) URL.revokeObjectURL(x.cutUrl);
    originals.current.delete(i.id);
  }
  const remove = (id: string) => {
    const old = items.find((i) => i.id === id);
    if (old) revoke(old);
    setItems((list) => list.filter((i) => i.id !== id));
  };
  const clearAll = () => {
    items.forEach(revoke);
    setItems([]);
    setSelected('');
  };

  // 框范围：框里拖是移动，拖角和边改大小，框外拖是重新画（和裁剪同一套手势）
  const drag = useRef<{ kind: CropDrag; start: Rect; px: number; py: number; id: number } | null>(null);
  const [dragged, setDragged] = useState<Rect | null>(null);
  const shownRange = dragged ?? item?.range;
  const toPercent = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { px: ((e.clientX - rect.left) / rect.width) * 100, py: ((e.clientY - rect.top) / rect.height) * 100 };
  };
  // 修整：笔画边画边显示，松手才记进历史
  const stroke = useRef<{ s: Stroke; id: number } | null>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const toImage = (e: PointerEvent<HTMLDivElement>) => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height];
  };
  const moveRing = (e: PointerEvent<HTMLDivElement>) => {
    const r = ring.current;
    if (!r) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const d = (s.brush / 100) * Math.max(rect.width, rect.height);
    r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - rect.left - d / 2}px;top:${e.clientY - rect.top - d / 2}px;opacity:1`;
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !item || busy || !(mode === 'range' || (brushing && canvas.current))) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 指针已经抬起时拿不到捕获，照样能拖 */
    }
    if (mode === 'range') {
      const kind = ((e.target as HTMLElement).closest<HTMLElement>('[data-crop]')?.dataset.crop || 'draw') as CropDrag;
      const { px, py } = toPercent(e);
      drag.current = { kind, start: item.range ?? { x: 0, y: 0, w: 100, h: 100 }, px, py, id: e.pointerId };
      return;
    }
    const { width, height } = item.size!;
    const st: Stroke = { mode: mode as Stroke['mode'], size: (s.brush / 100) * Math.max(width, height), points: toImage(e) };
    stroke.current = { s: st, id: e.pointerId };
    paintStroke(canvas.current!.getContext('2d')!, ready.current, st);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (brushing) moveRing(e);
    const d = drag.current;
    if (d?.id === e.pointerId) {
      const { px, py } = toPercent(e);
      // 轻轻一点不算，免得点一下就把框缩成一个小方块
      if (d.kind === 'draw' && Math.hypot(px - d.px, py - d.py) < 1.5) return;
      setDragged(dragCrop(d.start, d.kind, d.px, d.py, px - d.px, py - d.py));
    }
    const st = stroke.current;
    if (st?.id === e.pointerId && canvas.current) {
      const [x, y] = toImage(e);
      const p = st.s.points;
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < st.s.size * 0.1) return;
      p.push(x, y);
      paintStroke(canvas.current.getContext('2d')!, ready.current, st.s, p.length / 2 - 1);
    }
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      if (dragged && item) setRange(item.id, dragged);
      setDragged(null);
    }
    const st = stroke.current;
    if (st?.id === e.pointerId && item) {
      stroke.current = null;
      commit(item.id, (i) => ({ strokes: [...i.strokes, st.s] }));
    }
  };

  const stageBg = mode === 'cut' && hasCut && s.bg !== 'none' ? (s.bg === 'white' ? '#ffffff' : s.color) : undefined;

  return (
    <ToolPage
      tool={tool}
      sub={
        <>
          自动认出主体，背景变透明。
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="image-kit">
        {!item ? (
          <DropZone className="in-layout" accept="image/*" title="把图片拖到这里" hint="人像、商品、宠物都行，也能粘贴" onFiles={add} />
        ) : (
          <section className="image-kit-stage">
            <div
              className={
                'image-kit-preview cutout-preview' +
                (mode === 'cut' && s.bg === 'none' ? '' : ' is-solid') +
                (mode === 'range' ? ' is-crop' : '') +
                (dragged ? ' is-dragging' : '') +
                (brushing ? ' is-brush' : '')
              }
              style={stageBg ? { background: stageBg } : undefined}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={() => ring.current && (ring.current.style.opacity = '0')}
            >
              {showCanvas ? (
                <>
                  {brushing && <img className="cutout-under" src={item.url} alt="" />}
                  <canvas ref={canvas} width={item.size!.width} height={item.size!.height} role="img" aria-label={item.file.name} />
                  {brushing && <span ref={ring} className="cutout-ring" aria-hidden="true" />}
                </>
              ) : (
                <img src={item.url} alt={item.file.name} className={item.status === 'work' ? 'is-working' : undefined} />
              )}
              {mode === 'range' && shownRange && (
                <div
                  className="image-kit-crop"
                  data-crop="move"
                  style={{ left: `${shownRange.x}%`, top: `${shownRange.y}%`, width: `${shownRange.w}%`, height: `${shownRange.h}%` }}
                >
                  {HANDLES.map((h) => (
                    <span key={h} className={'image-kit-handle is-' + h} data-crop={h} aria-hidden="true" />
                  ))}
                </div>
              )}
              {item.status === 'work' && (
                <div className="cutout-busy" role="status">
                  <span className="cutout-scan" aria-hidden="true" />
                  <p>
                    <Led status="work" />
                    {stage || '准备中…'}
                  </p>
                </div>
              )}
            </div>
            {item.status === 'error' && <p className="image-kit-caption">{item.error}</p>}
            <div className="cutout-tools">
              <Segmented
                className="seg-sm"
                label="预览和修整"
                value={mode}
                onChange={setEditMode}
                disabled={busy}
                options={[
                  ...(hasCut ? [{ value: 'cut' as EditMode, label: '结果' }] : []),
                  { value: 'original', label: '原图' },
                  { value: 'range', label: '范围' },
                  ...(hasCut
                    ? [
                        { value: 'keep' as EditMode, label: '保留' },
                        { value: 'erase' as EditMode, label: '擦除' }
                      ]
                    : [])
                ]}
              />
              {brushing && (
                <span className="cutout-brush">
                  <Slider label="笔刷大小" min={1} max={20} value={s.brush} onChange={(brush) => update({ brush })} />
                </span>
              )}
              {mode === 'range' && item.range && (
                <button type="button" className="btn-soft cutout-whole" disabled={busy} onClick={() => setRange(item.id, undefined)}>
                  整张图
                </button>
              )}
              <span className="cutout-history">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="撤回"
                  title={`撤回 ${MOD}Z`}
                  disabled={busy || !item.past.length}
                  onClick={() => travel('undo')}
                >
                  <UndoIcon size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="重做"
                  title={MOD === '⌘' ? '重做 ⇧⌘Z' : '重做 Ctrl Y'}
                  disabled={busy || !item.future.length}
                  onClick={() => travel('redo')}
                >
                  <RedoIcon size={17} />
                </button>
              </span>
            </div>
            {items.some((i) => i.animated) && (
              <p className="image-kit-warn" role="status">
                动图只处理第一帧，导出静态图。
              </p>
            )}
            {outputs.length > 0 && !busy && <NextSteps outputs={outputs} from="image-cutout" />}
          </section>
        )}

        <aside className="image-kit-side">
          <h2 className="group-title">抠图</h2>
          <fieldset disabled={busy} className="group settings-group">
            <Field div block label="效果" hint={`第一次用要下载 ${MODEL_SIZE[s.model]}，之后断网也能用`}>
              <Segmented
                label="效果"
                value={s.model}
                onChange={(model) => update({ model })}
                options={[
                  { value: 'fine', label: '精细' },
                  { value: 'fast', label: '快速' }
                ]}
              />
            </Field>
            <SwitchRow checked={s.clean} onChange={(clean) => update({ clean })}>
              清理边缘残影
            </SwitchRow>
          </fieldset>
          <p className="group-note">
            {s.model === 'fine'
              ? '精细：边缘更利落，深色衣服、细碎边缘也能留住。有显卡加速时一张一两秒，没有时十几秒。'
              : '快速：一秒左右，适合主体明显、背景干净的图。'}
          </p>

          <h2 className="group-title">导出</h2>
          <div className="group settings-group">
            <Field div block label="背景">
              <Segmented
                label="背景"
                value={s.bg}
                onChange={(bg) => update({ bg })}
                options={[
                  { value: 'none', label: '透明' },
                  { value: 'white', label: '白色' },
                  { value: 'color', label: '自选颜色' }
                ]}
              />
            </Field>
            {s.bg === 'color' && (
              <Field label="颜色">
                <input type="color" value={s.color} onChange={(e) => update({ color: e.target.value })} />
              </Field>
            )}
            <SwitchRow checked={s.trim} onChange={(trim) => update({ trim })}>
              裁掉四周空白
            </SwitchRow>
            <Field label="格式">
              <Select value={format} onChange={(e) => update({ format: e.target.value as typeof s.format })}>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
                {s.bg !== 'none' && <option value="jpeg">JPEG</option>}
              </Select>
            </Field>
          </div>
          <p className="group-note">透明背景要用 PNG 或 WebP；换成纯色背景后也能存 JPEG。</p>

          {items.length > 0 && (
            <>
              <h2 className="group-title">图片 · {items.length} 张</h2>
              <div className="group image-kit-list" aria-live="polite">
                {items.map((i) => (
                  <div className={'image-kit-row' + (item?.id === i.id ? ' is-sel' : '')} key={i.id}>
                    <button type="button" className="image-kit-file" aria-pressed={item?.id === i.id} onClick={() => setSelected(i.id)}>
                      <img className="image-kit-thumb cutout-thumb" src={i.cutUrl ?? i.url} alt="" loading="lazy" decoding="async" />
                      <span>
                        <span className="image-kit-name">{i.file.name}</span>
                        <small>
                          {i.status === 'work'
                            ? '正在抠图…'
                            : (i.error ??
                              (i.status === 'done' ? `${i.size!.width} × ${i.size!.height} · 已抠好` : `${fmtSize(i.file.size)} · 待处理`))}
                          {i.animated && ' · 动图只处理第一帧'}
                        </small>
                      </span>
                      <Led status={i.status} />
                    </button>
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
          status={busy ? stage || '正在抠图…' : finished ? `${done.length} 张已抠好` : `${items.length} 张 · 待处理`}
        >
          <button type="button" className="btn-soft" disabled={busy} onClick={clearAll}>
            清空
          </button>
          <button type="button" className="btn-soft" disabled={busy} onClick={pick}>
            <PlusIcon size={15} />
            添加
          </button>
          {finished ? (
            <button type="button" className="btn" disabled={!outputs.length} onClick={download}>
              <DownloadIcon size={15} />
              {outputs.length > 1 ? `打包下载 ${outputs.length} 张` : '下载'}
              <KeyHint keys="save" />
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => process()}>
              {busy ? '正在抠图…' : '开始抠图'}
              {!busy && <KeyHint keys="run" />}
            </button>
          )}
        </ActionBar>
      )}
      <DropOverlay show={dragging} title="松手，添加图片" />
    </ToolPage>
  );
}

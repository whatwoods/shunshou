import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { toolById } from '../../tools';
import { usePersisted } from '../../lib/settings';
import { isAnimated } from '../../lib/image/animated';
import { useShortcuts } from '../../lib/useShortcuts';
import { NextSteps } from '../../components/FileMatch';
import { KeyHint } from '../../components/ActionBar';
import { useHandOff } from '../../lib/useHandOff';
import { fmtSize, pickFiles, saveBlob, saveZip, today } from '../../lib/files';
import { ToolPage } from '../../components/ToolPage';
import { Glass } from '../../components/Glass';
import island from './island.webp';
import { toast } from '../../components/Toast';
import { DropOverlay } from '../../components/DropZone';
import { useFileDrop } from '../../lib/useFileDrop';
import { CloseIcon, DownloadIcon, ImageIcon, Led, PlusIcon, Segmented, Slider, SwapIcon, SwitchRow } from '../../components/ui';
import { Pool } from './pool';
import { DEFAULT_SETTINGS, EXT, FMT_LABEL, TYPE_LABEL, type Fmt, type Job, type JobResult, type Output, type Settings } from './types';
import './image-compress.css';
import { Select } from '../../components/Select';
import { useMedia, TOUCH } from '../../lib/useMedia';

interface Item {
  id: string;
  file: File;
  url: string;
  status: 'queued' | 'working' | 'done' | 'error';
  out?: Output & { url: string };
  error?: string;
  animated?: boolean;
}

const ACCEPT = 'image/*,.heic,.heif,.avif';
const MAX_WIDTHS = [0, 3840, 2560, 1920, 1280, 800];
const isImage = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(f.name);

let seq = 0;

function outName(it: Item): string {
  if (!it.out || it.out.kept) return it.file.name;
  const base = it.file.name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${EXT[it.out.type] || 'img'}`;
}

function change(before: number, after: number): { text: string; grew: boolean } {
  const pct = Math.round((1 - after / before) * 100);
  if (after > before) return { text: '+' + Math.round((after / before - 1) * 100) + '%', grew: true };
  return { text: pct === 0 ? '0%' : '−' + pct + '%', grew: false };
}

export default function ImageCompress() {
  const touch = useMedia(TOUCH);
  const tool = toolById('image-compress')!;
  const [settings, setSettings] = usePersisted<Settings>('image-compress', DEFAULT_SETTINGS);
  const [items, setItems] = useState<Item[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [split, setSplit] = useState(50);
  // 拖着对比线的时候，手柄那颗玻璃像被捏住一样鼓起来
  const [grab, setGrab] = useState(false);
  // 双击放大到 100%：记录要看的位置（百分比），鼠标移动时跟着平移
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const hinted = useRef(false);

  // 每次设置生效都换一“代”，旧一代的结果到了就丢掉
  const gen = useRef(0);
  const applied = useRef(settings);
  const submitted = useRef(new Set<string>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onStart = useRef((job: Job) => {
    if (job.gen !== gen.current) return;
    setItems((list) => list.map((it) => (it.id === job.id ? { ...it, status: 'working' } : it)));
  });
  const onResult = useRef((res: JobResult) => {
    if (res.gen !== gen.current) return;
    const prev = itemsRef.current.find((it) => it.id === res.id);
    if (!prev) return;
    if (prev.out) {
      const old = prev.out.url;
      setTimeout(() => URL.revokeObjectURL(old), 2000);
    }
    const url = res.ok ? URL.createObjectURL(res.blob) : '';
    setItems((list) =>
      list.map((it) => {
        if (it.id !== res.id) return it;
        if (!res.ok) return { ...it, status: 'error', error: res.error, out: undefined };
        const { id: _id, gen: _gen, ok: _ok, ...out } = res;
        return { ...it, status: 'done', error: undefined, out: { ...out, url } };
      })
    );
  });
  const pool = useRef<Pool | null>(null);
  if (!pool.current)
    pool.current = new Pool(
      (j) => onStart.current(j),
      (r) => onResult.current(r)
    );

  // 离开页面时停掉所有 Worker、释放预览用的内存
  useEffect(
    () => () => {
      pool.current?.dispose();
      submitted.current.clear();
    },
    []
  );
  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.url);
        if (it.out) URL.revokeObjectURL(it.out.url);
      }
    },
    []
  );

  // 排队中的文件交给 Worker；设置变化或重新挂载后也会走到这里
  useEffect(() => {
    const jobs: Job[] = [];
    for (const it of items) {
      if (it.status !== 'queued' || submitted.current.has(it.id)) continue;
      submitted.current.add(it.id);
      jobs.push({ id: it.id, gen: gen.current, file: it.file, ...applied.current });
    }
    if (jobs.length) pool.current!.submit(jobs, selId ?? undefined);
  }, [items, selId]);

  // 设置变了：停下手头的活，按新设置全部重做（拖动画质时等手停下再开始）
  useEffect(() => {
    if (applied.current === settings) return;
    const t = setTimeout(() => {
      applied.current = settings;
      gen.current += 1;
      pool.current!.reset();
      submitted.current.clear();
      setItems((list) => list.map((it) => ({ ...it, status: 'queued', error: undefined })));
    }, 250);
    return () => clearTimeout(t);
  }, [settings]);

  const moving = items.filter((it) => it.animated);
  const addFiles = useCallback((files: File[]) => {
    const fresh: Item[] = files.filter(isImage).map((file) => ({
      id: 'f' + ++seq,
      file,
      url: URL.createObjectURL(file),
      status: 'queued'
    }));
    if (fresh.length === 0) return;
    setItems((list) => [...list, ...fresh]);
    setSelId((cur) => cur ?? fresh[0].id);
    // 压缩只取动图的第一帧：认出来以后在列表和画面下方说清楚
    for (const f of fresh)
      void isAnimated(f.file)
        .then((yes) => yes && setItems((list) => list.map((it) => (it.id === f.id ? { ...it, animated: true } : it))))
        .catch(() => {});
  }, []);

  // 从首页或 ⌘K 带过来的文件
  useHandOff(addFiles);

  // 整个页面都能拖入，也能直接粘贴
  const dragging = useFileDrop(addFiles);

  const select = (id: string) => {
    setSelId(id);
    pool.current!.prioritize(id);
  };

  const remove = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    pool.current!.cancel(id);
    submitted.current.delete(id);
    URL.revokeObjectURL(it.url);
    if (it.out) URL.revokeObjectURL(it.out.url);
    const rest = items.filter((x) => x.id !== id);
    setItems(rest);
    if (selId === id) {
      const i = items.indexOf(it);
      setSelId(rest[Math.min(i, rest.length - 1)]?.id ?? null);
    }
  };

  const clearAll = () => {
    gen.current += 1;
    pool.current!.reset();
    submitted.current.clear();
    for (const it of items) {
      URL.revokeObjectURL(it.url);
      if (it.out) URL.revokeObjectURL(it.out.url);
    }
    setItems([]);
    setSelId(null);
  };

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  const settingsPending = applied.current !== settings;
  const done = settingsPending ? [] : items.filter((it) => it.status === 'done' && it.out);
  const before = done.reduce((n, it) => n + it.file.size, 0);
  const after = done.reduce((n, it) => n + it.out!.blob.size, 0);
  const finished = !settingsPending && items.length > 0 && items.every((it) => it.status === 'done' || it.status === 'error');
  const sel = items.find((it) => it.id === selId) ?? items[0];
  const qualityUnused = settings.fmt === 'keep' && items.length > 0 && items.every((it) => it.file.type === 'image/png');

  const downloadAll = () => {
    if (!done.length) {
      toast('还没有压好的图片');
      return;
    }
    if (done.length === 1) {
      saveBlob(done[0].out!.blob, outName(done[0]));
      toast(`已下载 ${outName(done[0])}`);
    } else {
      saveZip(
        done.map((it) => ({ name: outName(it), blob: it.out!.blob })),
        `顺手-图片压缩-${today()}.zip`
      )
        .then(() => toast(`已打包 ${done.length} 张图片`))
        .catch(() => toast('打包失败，可以点每张图片单独下载', 'error'));
    }
  };

  useShortcuts({ save: downloadAll });

  // 对比线：在画面上按住拖动；键盘用隐藏的滑块
  const pointAt = (e: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  };
  const moveSplit = (e: PointerEvent<HTMLDivElement>) => setSplit(pointAt(e).x);

  // 第一次出结果时，对比线左右晃一下，告诉用户这里可以拖
  useEffect(() => {
    if (hinted.current || !sel?.out || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    hinted.current = true;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      setSplit(50 + Math.sin(p * Math.PI * 2) * 12 * (1 - p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sel?.out]);

  useEffect(() => setZoom(null), [sel?.id]);
  const fit = zoom ? { objectFit: 'none' as const, objectPosition: `${zoom.x}% ${zoom.y}%` } : undefined;

  const status = (it: Item) => {
    if (settingsPending) return 'work' as const;
    if (it.status === 'error') return 'error' as const;
    if (it.status === 'done') return 'done' as const;
    if (it.status === 'working' || it.out) return 'work' as const;
    return 'idle' as const;
  };

  return (
    <ToolPage
      tool={tool}
      sub={
        <>
          {items.length ? `${items.length} 张图片，都在这台设备上处理。` : '图片只在这台设备上处理。'}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
      actions={
        items.length > 0 && (
          <>
            <button type="button" className="btn btn-soft" onClick={() => pickFiles(ACCEPT).then(addFiles)}>
              <PlusIcon size={15} />
              添加图片
            </button>
            <button type="button" className="btn" disabled={done.length === 0 || !finished} onClick={downloadAll}>
              <DownloadIcon size={15} />
              {items.length > 0 && !finished
                ? `处理中 ${done.length} / ${items.length}`
                : done.length > 1
                  ? `全部下载（${fmtSize(after)}）`
                  : done.length === 1
                    ? `下载（${fmtSize(after)}）`
                    : '全部下载'}
              {finished && done.length > 0 && <KeyHint keys="save" />}
            </button>
          </>
        )
      }
    >
      <div className="ic-body">
        <div className="stage-col">
          <div className="stage">
            {sel ? (
              <>
                <img className="stage-bg" src={sel.url} alt="" aria-hidden="true" />
                <div
                  className={'compare' + (zoom ? ' is-zoomed' : '')}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setGrab(true);
                    moveSplit(e);
                  }}
                  onLostPointerCapture={() => setGrab(false)}
                  onPointerMove={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) moveSplit(e);
                    else if (zoom) setZoom(pointAt(e));
                  }}
                  onDoubleClick={(e) => setZoom(zoom ? null : pointAt(e))}
                >
                  <img key={sel.id} className="stage-img" src={sel.url} alt={`原图：${sel.file.name}`} draggable={false} style={fit} />
                  {sel.out && (
                    <>
                      <img
                        key={sel.out.url}
                        className="stage-img stage-after"
                        src={sel.out.url}
                        alt="压缩后"
                        draggable={false}
                        style={{ ...fit, clipPath: `inset(0 0 0 ${split}%)` }}
                      />
                      <span className="stage-line" style={{ left: `${split}%` }} aria-hidden="true" />
                      <label htmlFor="ic-split" className="sr">
                        左边是原图，右边是压缩后，调整分界线
                      </label>
                      <input
                        id="ic-split"
                        className="sr"
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(split)}
                        onChange={(e) => setSplit(Number(e.target.value))}
                      />
                      <Glass
                        as="span"
                        kind="clear"
                        className="knob"
                        style={{ left: `${split}%` }}
                        pressed={grab}
                        bezel={24}
                        thick={20}
                        blur={0}
                        saturate={140}
                        brightness={1.08}
                        fallbackBlur={4}
                      >
                        <SwapIcon size={20} />
                      </Glass>
                    </>
                  )}
                </div>

                <Glass kind="clear" className="pill pill-left">
                  <small>原图</small>
                  <b>
                    {fmtSize(sel.file.size)}
                    {sel.out && ` · ${sel.out.srcWidth}×${sel.out.srcHeight}`}
                  </b>
                </Glass>
                <Glass kind="clear" className="pill pill-right">
                  {sel.status === 'error' ? (
                    <>
                      <small>没能处理</small>
                      <b>见右侧说明</b>
                    </>
                  ) : sel.out && !settingsPending && sel.status === 'done' ? (
                    <>
                      <small>
                        {sel.out.kept
                          ? '已经很小，保留原图'
                          : sel.out.lossless
                            ? `${TYPE_LABEL[sel.out.type]} · 无损优化`
                            : `${TYPE_LABEL[sel.out.type]} · 画质 ${applied.current.quality}`}
                        {sel.out.width !== sel.out.srcWidth && ` · ${sel.out.width}×${sel.out.height}`}
                      </small>
                      <b>
                        {fmtSize(sel.out.blob.size)} ·{' '}
                        {(() => {
                          const c = change(sel.file.size, sel.out.blob.size);
                          return <span className={c.grew ? 'grew' : 'saved'}>{c.text}</span>;
                        })()}
                      </b>
                    </>
                  ) : (
                    <>
                      <small>
                        {FMT_LABEL[settings.fmt]} · 画质 {settings.quality}
                      </small>
                      <b>正在压缩…</b>
                    </>
                  )}
                </Glass>
              </>
            ) : (
              <>
                <div className="scene" aria-hidden="true">
                  <img src={island} alt="" decoding="async" />
                </div>
                <div className="stage-empty">
                  <Glass kind="sheet" className="drop-sheet" blur={3}>
                    <ImageIcon size={28} />
                    <p className="big">{touch ? '从手机里选图片' : '把图片拖到这里'}</p>
                    <p className="small">JPEG、PNG、WebP、AVIF 都行{touch ? '' : '，也能粘贴'}</p>
                    <button type="button" className="btn btn-lg" style={{ marginTop: 14 }} onClick={() => pickFiles(ACCEPT).then(addFiles)}>
                      选择图片
                    </button>
                  </Glass>
                </div>
              </>
            )}

            <Glass className="toolbar" blur={1.5}>
              <Segmented<Fmt>
                label="输出格式"
                value={settings.fmt}
                onChange={(fmt) => update({ fmt })}
                options={(['keep', 'webp', 'avif', 'jpeg'] as Fmt[]).map((f) => ({ value: f, label: FMT_LABEL[f] }))}
              />
              <span className="quality">
                <label htmlFor="ic-q">画质</label>
                <Slider
                  id="ic-q"
                  min={10}
                  max={100}
                  value={settings.quality}
                  disabled={qualityUnused}
                  onChange={(quality) => update({ quality })}
                />
                <span className="num">{settings.quality}</span>
              </span>
            </Glass>
          </div>
          {sel?.out && <p className="stage-caption">左原图，右压缩后，拖中间的线对比 · {zoom ? '双击回到全图' : '双击放大到 100%'}</p>}
          {moving.length > 0 && (
            <p className="stage-warn" role="status">
              {moving.length === 1 ? `「${moving[0].file.name}」是动图` : `有 ${moving.length} 张是动图`}
              ：只压第一帧，导出静态图（变大时保留原图）。想保留动画，就别压它。
            </p>
          )}
          {finished && done.length > 0 && (
            <NextSteps outputs={done.map((it) => ({ blob: it.out!.blob, name: outName(it) }))} from="image-compress" />
          )}
        </div>

        <aside className="side" aria-label="文件与选项">
          <div className="side-head">
            <h2>
              文件 · 已完成 {done.length} / {items.length}
            </h2>
            {done.length > 0 && (
              <span>
                {after <= before ? '省下' : '多出'}{' '}
                <b>
                  {fmtSize(Math.abs(before - after))}（{change(before, after).text.replace(/^[−+]/, '')}）
                </b>
              </span>
            )}
          </div>
          <ul className="files">
            {items.length === 0 && <li className="files-empty">还没有图片。</li>}
            {items.map((it) => {
              const on = it === sel;
              const c = it.out && change(it.file.size, it.out.blob.size);
              return (
                <li key={it.id} className={'file' + (on ? ' is-sel' : '')}>
                  <button type="button" className="file-main" aria-pressed={on} onClick={() => select(it.id)}>
                    <img className="thumb" src={it.url} alt="" loading="lazy" decoding="async" />
                    <span className="file-text">
                      <span className="file-name">{it.file.name}</span>
                      {it.status === 'error' ? (
                        <span className="file-meta err">{it.error}</span>
                      ) : it.out ? (
                        <span className="file-meta">
                          {fmtSize(it.file.size)} → {fmtSize(it.out.blob.size)}
                          {it.out.kept && ' · 原图'}
                          {it.animated && !it.out.kept && ' · 动图只留了第一帧'}
                        </span>
                      ) : it.status === 'working' ? (
                        <span className="bar-indet" aria-label="正在压缩" />
                      ) : (
                        <span className="file-meta" style={{ color: 'var(--ink-3)' }}>
                          等待中 · {fmtSize(it.file.size)}
                        </span>
                      )}
                    </span>
                    <span className="file-end">
                      {!on && c && <span className={c.grew ? 'grew' : undefined}>{c.text}</span>}
                      <Led status={status(it)} />
                    </span>
                  </button>
                  {on && (
                    <span className="file-actions">
                      {!settingsPending && it.status === 'done' && it.out && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`下载 ${outName(it)}`}
                          title="下载这一张"
                          onClick={() => {
                            saveBlob(it.out!.blob, outName(it));
                            toast(`已下载 ${outName(it)}`);
                          }}
                        >
                          <DownloadIcon size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`移除 ${it.file.name}`}
                        title="移除"
                        onClick={() => remove(it.id)}
                      >
                        <CloseIcon size={15} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length > 0 && (
            <div className="side-foot">
              <button type="button" className="link-btn" onClick={clearAll}>
                清空列表
              </button>
            </div>
          )}

          <h2 className="group-title">选项</h2>
          <div className="group">
            <SwitchRow checked={settings.stripExif} onChange={(stripExif) => update({ stripExif })}>
              去除 EXIF 信息
            </SwitchRow>
            <label className="select-row">
              最大宽度
              <Select value={settings.maxWidth} onChange={(e) => update({ maxWidth: Number(e.target.value) })}>
                {MAX_WIDTHS.map((w) => (
                  <option key={w} value={w}>
                    {w ? `${w} 像素` : '不限'}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <p className="group-note">
            {settings.stripExif ? '抹掉拍摄地点、相机型号和时间。' : '保留拍摄信息（含地点），只有输出 JPEG 时能带上。'}
          </p>
        </aside>
      </div>

      <DropOverlay show={dragging} title="松手，开始压缩" />
    </ToolPage>
  );
}

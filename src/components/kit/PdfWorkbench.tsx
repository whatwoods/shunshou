import { useCallback, useEffect, useRef, useState } from 'react';
import { ToolPage } from '../ToolPage';
import { DropOverlay, DropZone } from '../DropZone';
import { ActionBar, KeyHint } from '../ActionBar';
import { NextSteps } from '../FileMatch';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  Field,
  GripIcon,
  Led,
  PlusIcon,
  RotateIcon,
  Segmented,
  Slider,
  SwitchRow
} from '../ui';
import { toolById } from '../../tools';
import { copyText, fmtSize, pickFiles, saveBlob, saveZip } from '../../lib/files';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { useShortcuts } from '../../lib/useShortcuts';
import { useHandOff } from '../../lib/useHandOff';
import { toast } from '../Toast';
import { useFileDrop } from '../../lib/useFileDrop';
import { PdfClient } from '../../lib/pdf/client';
import { moveItem, pageGroups } from '../../lib/pdf/logic';
import { PDF_DEFAULTS, type PdfMode, type PdfOutput, type PdfPageItem, type PdfSettings, type PdfSource } from '../../lib/pdf/types';
import './PdfWorkbench.css';
import { Select } from '../Select';

const DESCRIPTIONS: Record<PdfMode, string> = {
  'extract-text': '取出能选中的文字，复制或存成 TXT。',
  'extract-images': '取出里面的图片，JPEG 原样保留。',
  merge: '排好顺序，合成一份。',
  split: '按页码或页数拆成多份。',
  'to-image': '每页导出一张清晰图片。',
  'from-image': '多张图片合成一份 PDF。',
  organize: '旋转、删页、排序，插入空白页。',
  compress: '压小图片，文字和矢量不动。',
  'page-numbers': '给每页加上页码。'
};
function Thumb({
  page,
  client,
  cache,
  onError
}: {
  page: PdfPageItem;
  client: PdfClient | null;
  cache: Map<string, string>;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${page.source}:${page.index}`;
  const [url, setUrl] = useState(cache.get(key) || '');
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!page.source || !client || cache.has(key)) return;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        client
          .request<Blob>({ op: 'thumbnail', source: page.source, index: page.index })
          .then((blob) => {
            if (!active) return;
            const next = URL.createObjectURL(blob);
            cache.set(key, next);
            setUrl(next);
          })
          .catch((reason: Error) => {
            if (active) {
              setError(true);
              onError(`缩略图无法显示：${reason.message}`);
            }
          });
      },
      { rootMargin: '150px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [client, key, page.source, page.index, cache, onError]);
  return (
    <div className="pdf-thumb" ref={ref}>
      {url ? (
        <img
          src={url}
          alt="页面缩略图"
          draggable={false}
          style={{
            transform: `rotate(${page.rotation}deg)`,
            maxWidth: page.rotation % 180 ? '70%' : undefined,
            maxHeight: page.rotation % 180 ? '70%' : undefined
          }}
        />
      ) : (
        <span>{!page.source ? '空白页' : error ? '预览不可用' : '载入预览…'}</span>
      )}
    </div>
  );
}
// 输出文件名是用户输入的文字，不存本机
const CONTENT = ['name'] as const;

export function PdfWorkbench({ mode }: { mode: PdfMode }) {
  const id = `pdf-${mode}`;
  const [settings, setSettings] = usePersisted<PdfSettings>(id, PDF_DEFAULTS, CONTENT);
  const [sources, setSources] = useState<PdfSource[]>([]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [view, setView] = useState<'file' | 'page'>(mode === 'merge' ? 'file' : 'page');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [compressionSizes, setCompressionSizes] = useState<Partial<Record<PdfSettings['compression'], number>>>({});
  const [textPreview, setTextPreview] = useState('');
  const pendingHandOff = useRef<File[]>([]);
  const [outputs, setOutputs] = useState<PdfOutput[]>([]);
  const [history, setHistory] = useState<PdfPageItem[][]>([]);
  const [client, setClient] = useState<PdfClient | null>(null);
  const clientRef = useRef<PdfClient | null>(null);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const cache = useRef(new Map<string, string>());
  const dragIndex = useRef<number | null>(null);
  const images = mode === 'merge' || mode === 'from-image';
  const multiple = images || mode === 'organize';
  const accept =
    mode === 'from-image'
      ? 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp,.heic,.heif'
      : images
        ? '.pdf,image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp,.heic,.heif'
        : '.pdf';
  const editable = ['merge', 'organize', 'from-image'].includes(mode);
  const add = useCallback(
    async (files: File[]) => {
      if (!files.length || busyRef.current || !clientRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError('');
      setOutputs([]);
      setTextPreview('');
      const gen = generation.current;
      const accepted = multiple ? files : files.slice(0, 1);
      const nextSources: PdfSource[] = [],
        nextPages: PdfPageItem[] = [],
        errors: string[] = [];
      for (const file of accepted) {
        setStatus(`正在读取 ${file.name}`);
        try {
          const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
          if (mode === 'from-image' ? isPdf : !images && !isPdf)
            throw new Error(mode === 'from-image' ? '请选择图片文件' : '请选择 PDF 文件');
          const source = await clientRef.current.request<PdfSource>({ op: 'load', id: crypto.randomUUID(), file });
          nextSources.push(source);
          nextPages.push(
            ...Array.from({ length: source.count }, (_, index) => ({ id: crypto.randomUUID(), source: source.id, index, rotation: 0 }))
          );
        } catch (reason) {
          errors.push(`${file.name}：${reason instanceof Error ? reason.message : '读不了，换个文件试试'}`);
        }
        if (!alive.current || gen !== generation.current) return;
      }
      if (nextSources.length) {
        setCompressionSizes({});
        if (!multiple) {
          for (const old of sourcesRef.current) {
            void clientRef.current.request({ op: 'release', source: old.id }).catch(() => {});
            for (const [key, url] of cache.current)
              if (key.startsWith(`${old.id}:`)) {
                URL.revokeObjectURL(url);
                cache.current.delete(key);
              }
          }
        }
        setSources((old) => (multiple ? [...old, ...nextSources] : nextSources));
        setPages((old) => (multiple ? [...old, ...nextPages] : nextPages));
        setHistory([]);
      }
      setError(errors.join('；'));
      setStatus(nextSources.length ? `已添加 ${nextPages.length} 页` : '');
      setBusy(false);
      busyRef.current = false;
    },
    [images, mode, multiple]
  );
  useEffect(() => {
    alive.current = true;
    const next = new PdfClient();
    next.onProgress = setStatus;
    clientRef.current = next;
    setClient(next);
    return () => {
      alive.current = false;
      generation.current++;
      busyRef.current = false;
      next.dispose();
      clientRef.current?.dispose();
      clientRef.current = null;
      for (const url of cache.current.values()) URL.revokeObjectURL(url);
      cache.current.clear();
    };
  }, [add]);
  const flushHandOff = useCallback(() => {
    if (!alive.current || !clientRef.current || busyRef.current || !pendingHandOff.current.length) return;
    void add(pendingHandOff.current.splice(0));
  }, [add]);
  useHandOff((files) => {
    pendingHandOff.current.push(...files);
    queueMicrotask(flushHandOff);
  });
  useEffect(() => {
    if (!busy) flushHandOff();
  }, [busy, flushHandOff]);
  // 设置变了（包括“恢复默认”），旧结果作废；正在跑的任务回来时设置已经变了，也不算数。分辨率和画质变了，体积对比也要重算
  const signature = JSON.stringify(settings);
  const live = useRef(signature);
  live.current = signature;
  useEffect(() => setOutputs([]), [signature]);
  useSettingsLock(busy);
  useEffect(() => setCompressionSizes({}), [settings.dpi, settings.quality]);
  const dragging = useFileDrop(add, { enabled: !busy });
  const pick = () => void pickFiles(accept, multiple).then(add);
  function change<K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) {
    setSettings((old) => ({ ...old, [key]: value }));
  }
  function edit(next: PdfPageItem[]) {
    setHistory((old) => [...old.slice(-19), pages]);
    setPages(next);
    setOutputs([]);
  }
  function clear() {
    pendingHandOff.current = [];
    setTextPreview('');
    setCompressionSizes({});
    toast(busy ? '已取消并清空' : '已清空');
    generation.current++;
    clientRef.current?.dispose();
    const next = new PdfClient();
    next.onProgress = setStatus;
    clientRef.current = next;
    setClient(next);
    for (const url of cache.current.values()) URL.revokeObjectURL(url);
    cache.current.clear();
    setPages([]);
    setSources([]);
    setHistory([]);
    setOutputs([]);
    setBusy(false);
    busyRef.current = false;
    setError('');
    setStatus('');
  }
  const activeSources = sources
    .filter((source) => pages.some((page) => page.source === source.id))
    .sort((a, b) => pages.findIndex((p) => p.source === a.id) - pages.findIndex((p) => p.source === b.id));
  const cards =
    view === 'file' && mode === 'merge' ? activeSources.map((source) => pages.find((page) => page.source === source.id)!) : pages;
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= cards.length) return;
    if (view === 'file' && mode === 'merge')
      edit(moveItem(activeSources, from, to).flatMap((source) => pages.filter((page) => page.source === source.id)));
    else edit(moveItem(pages, from, to));
  }
  async function run() {
    if (busyRef.current || !clientRef.current) return;
    try {
      if (mode === 'split') pageGroups(pages.length, settings.split, settings.ranges, settings.every);
    } catch (reason) {
      setError((reason as Error).message);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setOutputs([]);
    setTextPreview('');
    setStatus('正在准备…');
    const gen = generation.current;
    const at = signature;
    try {
      const result = await clientRef.current.request<PdfOutput[]>({ op: 'export', mode, pages, settings });
      if (!alive.current || gen !== generation.current) return;
      if (live.current !== at) {
        setStatus('设置改了，请重新开始');
        return;
      }
      if (mode === 'extract-text') {
        const text = await result[0].blob.text();
        if (!alive.current || gen !== generation.current) return;
        setTextPreview(text.slice(0, 100000));
      }
      if (mode === 'compress') setCompressionSizes((old) => ({ ...old, [settings.compression]: result[0].blob.size }));
      setOutputs(result);
      setStatus(`已完成，共 ${result.length} 个文件`);
    } catch (reason) {
      if (alive.current && gen === generation.current) {
        setError(`${(reason as Error).message}。检查设置或换个文件再试。`);
        setStatus('处理未完成');
      }
    } finally {
      if (alive.current && gen === generation.current) {
        setBusy(false);
        busyRef.current = false;
      }
    }
  }
  async function download() {
    try {
      if (outputs.length === 1) saveBlob(outputs[0].blob, outputs[0].name);
      else await saveZip(outputs, `${settings.name.trim() || outputs[0].name.replace(/(-\d{3})?\.[^.]+$/, '')}.zip`);
      toast('已开始下载');
    } catch (reason) {
      setError(`打包失败：${(reason as Error).message}。少选几页再试。`);
    }
  }
  useShortcuts({
    run: () => {
      if (!pages.length || busyRef.current) return false;
      void run();
    },
    save: () => {
      if (!outputs.length) toast('还没有可下载的结果');
      else void download();
    },
    cancel: busy ? clear : undefined
  });
  async function copyResult() {
    if (!outputs[0]) return;
    const copied = await copyText(await outputs[0].blob.text());
    toast(copied ? '已复制文字' : '复制失败，请下载 TXT', copied ? 'done' : 'error');
  }
  const totalSize = activeSources.reduce((sum, source) => sum + source.size, 0);
  const outputSize = outputs.reduce((sum, output) => sum + output.blob.size, 0);
  const numberInput = (key: 'margin' | 'every' | 'start' | 'fontSize', min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      value={settings[key]}
      onChange={(e) => change(key, Math.max(min, Math.min(max, Number(e.target.value) || min)))}
    />
  );
  return (
    <ToolPage
      tool={toolById(id)!}
      sub={
        <>
          {DESCRIPTIONS[mode]}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="pdf-workbench">
        {error && (
          <p role="alert" className="pdf-error">
            {error}
          </p>
        )}
        {/* 没有文件时版式不变：拖放区占页面区的位置，右边的设置可以先选好 */}
        <div className="pdf-layout">
          {!pages.length && !busy && !history.length ? (
            <DropZone
              className="in-layout"
              accept={accept}
              multiple={multiple}
              title={mode === 'from-image' ? '把图片拖到这里' : images ? '把 PDF 或图片拖到这里' : '把 PDF 拖到这里'}
              hint={images ? 'JPEG、PNG、WebP、HEIC 等都行，也能粘贴' : '也可以直接粘贴'}
              onFiles={add}
            />
          ) : (
            <section className="pdf-stage" aria-label="页面工作区">
              <div className="pdf-stage-head">
                <div>
                  {mode === 'merge' ? (
                    <Segmented
                      label="查看方式"
                      value={view}
                      onChange={setView}
                      options={[
                        { value: 'file', label: '按文件' },
                        { value: 'page', label: '按页面' }
                      ]}
                    />
                  ) : (
                    <strong>{pages.length} 页</strong>
                  )}
                </div>
                <span>{editable ? '拖动或用箭头排序' : `${activeSources.length} 个来源`}</span>
              </div>
              <div className="pdf-grid" role="list" aria-label="页面顺序">
                {cards.map((page, index) => {
                  const source = sources.find((source) => source.id === page.source);
                  const label =
                    view === 'file' && mode === 'merge'
                      ? `${pages.filter((p) => p.source === page.source).length} 页`
                      : `第 ${index + 1} 页`;
                  return (
                    <article
                      className="pdf-card"
                      key={page.id}
                      role="listitem"
                      draggable={editable && !busy}
                      onDragStart={(e) => {
                        dragIndex.current = index;
                        e.dataTransfer.setData('text/plain', page.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null;
                      }}
                      onDragOver={(e) => {
                        if (dragIndex.current !== null) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (dragIndex.current !== null) {
                          e.preventDefault();
                          move(dragIndex.current, index);
                          dragIndex.current = null;
                        }
                      }}
                    >
                      <Thumb page={page} client={client} cache={cache.current} onError={setError} />
                      {editable && (
                        <span className="drag-grip" aria-hidden="true">
                          <GripIcon />
                        </span>
                      )}
                      <p className="pdf-card-title" title={source?.name || '空白页'}>
                        <Led status="done" />
                        {source?.name || '空白页'}
                      </p>
                      <p className="pdf-card-detail">
                        {label}
                        {source && view === 'page' ? ` · 来源第 ${page.index + 1} 页` : ''}
                      </p>
                      {editable && (
                        <div className="pdf-card-actions">
                          <button
                            className="btn btn-soft"
                            aria-label={`${label}前移`}
                            onClick={() => move(index, index - 1)}
                            disabled={busy || index === 0}
                          >
                            <ArrowLeftIcon size={16} />
                          </button>
                          <button
                            className="btn btn-soft"
                            aria-label={`${label}后移`}
                            onClick={() => move(index, index + 1)}
                            disabled={busy || index === cards.length - 1}
                          >
                            <ArrowRightIcon size={16} />
                          </button>
                          {view === 'page' && mode !== 'from-image' && (
                            <button
                              className="btn btn-soft"
                              aria-label={`旋转${label}`}
                              disabled={busy}
                              onClick={() => edit(pages.map((p) => (p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)))}
                            >
                              <RotateIcon size={16} />
                            </button>
                          )}
                          <button
                            className="btn btn-soft"
                            aria-label={`移除${label}`}
                            disabled={busy}
                            onClick={() =>
                              edit(pages.filter((p) => (view === 'file' && mode === 'merge' ? p.source !== page.source : p.id !== page.id)))
                            }
                          >
                            <CloseIcon size={16} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {mode === 'organize' && (
                <button
                  className="btn btn-soft"
                  disabled={busy}
                  onClick={() => edit([...pages, { id: crypto.randomUUID(), source: '', index: 0, rotation: 0 }])}
                >
                  <PlusIcon size={16} />
                  插入空白页
                </button>
              )}
            </section>
          )}
          <aside className="pdf-sidebar">
            <h2 className="group-title">输出设置</h2>
            <fieldset disabled={busy} className="group settings-group">
              <Field label="文件名">
                <input value={settings.name} maxLength={100} placeholder="沿用原文件名" onChange={(e) => change('name', e.target.value)} />
              </Field>
              {mode === 'merge' && (
                <SwitchRow checked={settings.a4} onChange={(v) => change('a4', v)}>
                  统一为 A4
                </SwitchRow>
              )}
              {mode === 'from-image' && (
                <>
                  <Field div block label="纸张">
                    <Segmented
                      label="纸张"
                      value={settings.paper}
                      onChange={(v) => change('paper', v)}
                      options={[
                        { value: 'a4', label: 'A4' },
                        { value: 'letter', label: 'Letter' },
                        { value: 'original', label: '和图片一样' }
                      ]}
                    />
                  </Field>
                  {settings.paper !== 'original' && (
                    <Field div label="方向">
                      <Segmented
                        label="方向"
                        value={settings.landscape ? 'landscape' : 'portrait'}
                        onChange={(v) => change('landscape', v === 'landscape')}
                        options={[
                          { value: 'portrait', label: '纵向' },
                          { value: 'landscape', label: '横向' }
                        ]}
                      />
                    </Field>
                  )}
                </>
              )}
              {(mode === 'from-image' || (mode === 'merge' && settings.a4)) && (
                <Field label="边距（毫米）">{numberInput('margin', 0, 60)}</Field>
              )}
              {mode === 'split' && (
                <>
                  <Field div block label="拆分方式">
                    <Segmented
                      label="拆分方式"
                      value={settings.split}
                      onChange={(v) => change('split', v)}
                      options={[
                        { value: 'ranges', label: '按页码' },
                        { value: 'every', label: '每 N 页' },
                        { value: 'each', label: '每页一份' }
                      ]}
                    />
                  </Field>
                  {settings.split === 'ranges' ? (
                    <Field label="页码分组">
                      <input value={settings.ranges} placeholder="1-3,5;6-8" onChange={(e) => change('ranges', e.target.value)} />
                    </Field>
                  ) : settings.split === 'every' ? (
                    <Field label="每份页数">{numberInput('every', 1, 10000)}</Field>
                  ) : null}
                </>
              )}
              {mode === 'compress' && (
                <Field div block label="压缩方式">
                  <Segmented
                    label="压缩方式"
                    value={settings.compression}
                    onChange={(v) => change('compression', v)}
                    options={[
                      { value: 'preserve', label: '保留文字' },
                      { value: 'raster', label: '强力 · 图片化' }
                    ]}
                  />
                </Field>
              )}
              {(mode === 'to-image' || mode === 'compress') && (
                <>
                  <Field label={mode === 'compress' && settings.compression === 'preserve' ? '图片分辨率上限' : '分辨率'}>
                    <Select value={settings.dpi} onChange={(e) => change('dpi', Number(e.target.value))}>
                      {[72, 100, 150, 200, 300].map((dpi) => (
                        <option key={dpi} value={dpi}>
                          {dpi} DPI
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {mode === 'to-image' && (
                    <Field div label="图片格式">
                      <Segmented
                        label="图片格式"
                        value={settings.format}
                        onChange={(v) => change('format', v)}
                        options={[
                          { value: 'png', label: 'PNG' },
                          { value: 'jpeg', label: 'JPEG' }
                        ]}
                      />
                    </Field>
                  )}
                  {(mode === 'compress' || settings.format === 'jpeg') && (
                    <Field
                      div
                      block
                      label={
                        <span className="field-split">
                          图片画质<span className="field-value">{settings.quality}</span>
                        </span>
                      }
                    >
                      <Slider label="图片画质" min={20} max={100} value={settings.quality} onChange={(v) => change('quality', v)} />
                    </Field>
                  )}
                </>
              )}
              {mode === 'page-numbers' && (
                <>
                  <Field label="位置">
                    <Select value={settings.position} onChange={(e) => change('position', e.target.value as PdfSettings['position'])}>
                      {[
                        ['top-left', '左上'],
                        ['top-center', '顶部居中'],
                        ['top-right', '右上'],
                        ['bottom-left', '左下'],
                        ['bottom-center', '底部居中'],
                        ['bottom-right', '右下']
                      ].map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field div block label="样式">
                    <Segmented
                      label="样式"
                      value={settings.numberStyle}
                      onChange={(v) => change('numberStyle', v)}
                      options={[
                        { value: 'plain', label: '1' },
                        { value: 'chinese', label: '第 1 页' },
                        { value: 'total', label: '1 of N' }
                      ]}
                    />
                  </Field>
                  <Field label="起始页码">{numberInput('start', 0, 99999)}</Field>
                  <Field label="字号（pt）">{numberInput('fontSize', 6, 48)}</Field>
                  <SwitchRow checked={settings.skipCover} onChange={(v) => change('skipCover', v)}>
                    跳过封面
                  </SwitchRow>
                </>
              )}
            </fieldset>
            {mode === 'compress' && (
              <table className="pdf-size-table">
                <caption>两种模式体积对比</caption>
                <thead>
                  <tr>
                    <th>原文件</th>
                    <th>保留文字</th>
                    <th>强力</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{fmtSize(totalSize)}</td>
                    <td>{compressionSizes.preserve === undefined ? '待处理' : fmtSize(compressionSizes.preserve)}</td>
                    <td>{compressionSizes.raster === undefined ? '待处理' : fmtSize(compressionSizes.raster)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {mode === 'split' && <p className="group-note">逗号连页码，分号分文件：1-3,5;6-8 拆成两份。留空导出全部。</p>}
            {mode === 'compress' && settings.compression === 'preserve' && (
              <p className="group-note">
                只重压普通的 RGB、灰度图片，文字、矢量、链接、表单都不动，特殊颜色和蒙版保持原样。变大了就保留原文件。数字签名会失效。
              </p>
            )}
            {mode === 'extract-text' && <p className="group-note">只取已有的文字，不做 OCR，扫描件取不到。多栏和表格可能要再整理。</p>}
            {mode === 'extract-images' && (
              <p className="group-note">导出常见的 JPEG、PNG 图片，重复的只导出一次。特殊颜色和编码会跳过并说明，矢量图形不算图片。</p>
            )}
            {mode === 'compress' && settings.compression === 'raster' && (
              <p className="pdf-warning">
                适合扫描件。每页变成 JPEG 图片：文字不能再选中搜索，链接、表单、书签和数字签名都会去掉。变大了建议保留原文件。
              </p>
            )}
            {['merge', 'split', 'organize', 'page-numbers'].includes(mode) && (
              <p className="group-note">页面内容原样保留；书签、表单和数字签名不保留。加密的 PDF 请先解锁。</p>
            )}
            {activeSources.length > 0 ? (
              <>
                <h2 className="group-title">来源文件</h2>
                <div className="group pdf-source-list">
                  {activeSources.map((source) => (
                    <div key={source.id}>
                      <span title={source.name}>{source.name}</span>
                      <small>
                        {source.count} 页 · {fmtSize(source.size)}
                      </small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="group-note">先选好也行，放进文件后按这里的设置处理。</p>
            )}
          </aside>
        </div>
        {mode === 'extract-text' && textPreview && (
          <section className="pdf-text-result">
            <label htmlFor="pdf-text-preview">文字预览（只显示前 10 万字，复制和下载是全文）</label>
            <textarea id="pdf-text-preview" className="pdf-text-preview" value={textPreview} readOnly />
            <button className="btn btn-soft" onClick={copyResult}>
              <CopyIcon size={16} />
              复制全部文字
            </button>
          </section>
        )}
        {outputs.length > 0 && (
          <div className="pdf-result" role="status">
            <Led status="done" />
            <div>
              <b>处理好了</b>
              {outputs[0].note && <p>{outputs[0].note}</p>}
              {mode === 'compress' && (
                <p>
                  原文件 {fmtSize(totalSize)} → {fmtSize(outputSize)}
                  {outputSize < totalSize
                    ? `，减少 ${Math.round((1 - outputSize / totalSize) * 100)}%`
                    : '，没有变小，建议保留原文件或调低画质。'}
                </p>
              )}
              {!busy && <NextSteps outputs={outputs} from={id} />}
            </div>
          </div>
        )}
        {(pages.length > 0 || busy || history.length > 0) && (
          <ActionBar
            led={busy ? 'work' : outputs.length ? 'done' : 'idle'}
            status={
              busy
                ? status
                : outputs.length
                  ? `${outputs.length} 份 · ${fmtSize(outputSize)}`
                  : `${pages.length} 页 · ${fmtSize(totalSize)}`
            }
          >
            {editable && (
              <button
                type="button"
                className="btn-soft"
                disabled={busy || !history.length}
                onClick={() => {
                  setPages(history[history.length - 1]);
                  setHistory((old) => old.slice(0, -1));
                  setOutputs([]);
                }}
              >
                撤销
              </button>
            )}
            {mode === 'merge' && (
              <button
                type="button"
                className="btn-soft"
                disabled={busy}
                onClick={() =>
                  edit(
                    [...activeSources]
                      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
                      .flatMap((source) => pages.filter((page) => page.source === source.id))
                  )
                }
              >
                按文件名排序
              </button>
            )}
            <button type="button" className="btn-soft" onClick={clear}>
              {busy ? '取消' : '清空'}
            </button>
            <button type="button" className="btn-soft" onClick={pick} disabled={busy}>
              {multiple ? (
                <>
                  <PlusIcon size={15} />
                  添加
                </>
              ) : (
                '换个文件'
              )}
            </button>
            <button type="button" className="btn" disabled={busy || !pages.length} onClick={outputs.length ? download : run}>
              {outputs.length > 0 && !busy && <DownloadIcon size={15} />}
              {busy
                ? '正在处理…'
                : outputs.length
                  ? outputs.length > 1
                    ? '打包下载'
                    : '下载结果'
                  : mode === 'merge'
                    ? '合并 PDF'
                    : '开始处理'}
              {!busy && <KeyHint keys={outputs.length ? 'save' : 'run'} />}
            </button>
          </ActionBar>
        )}
      </div>
      <DropOverlay show={dragging} title="松手，添加文件" />
    </ToolPage>
  );
}

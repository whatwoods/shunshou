import { useCallback, useEffect, useRef, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { CloseIcon, DownloadIcon, Field, Led, PlusIcon, Segmented, SwitchRow } from '../../components/ui';
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
import { useShortcuts } from '../../lib/useShortcuts';
import { baseName, fmtSize, pickFiles, saveBlob, saveZip } from '../../lib/files';
import type { ModelId } from './logic';
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
}

const defaults = {
  model: 'fine' as ModelId,
  clean: true,
  bg: 'none' as 'none' | 'white' | 'color',
  color: '#E8F0FF',
  trim: false,
  format: 'png' as 'png' | 'webp' | 'jpeg'
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
  const [view, setView] = useState<'cut' | 'original'>('cut');
  const [exported, setExported] = useState<{ signature: string; files: { blob: Blob; name: string }[] }>();
  const worker = useRef<Worker | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const alive = useRef(true);
  useSettingsLock(busy);

  // 换模型或改边缘清理，已经抠好的就不对应了：退回待处理
  const maskSig = `${s.model}:${s.clean}`;
  const live = useRef(maskSig);
  live.current = maskSig;
  useEffect(() => {
    setItems((list) =>
      list.map((i) => {
        if (i.status !== 'done' && i.status !== 'error') return i;
        if (i.cutUrl) URL.revokeObjectURL(i.cutUrl);
        return { ...i, status: 'idle', cut: undefined, cutUrl: undefined, box: undefined, error: undefined };
      })
    );
  }, [maskSig]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      worker.current?.terminate();
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.url);
        if (i.cutUrl) URL.revokeObjectURL(i.cutUrl);
      });
    };
  }, []);

  const add = useCallback((files: File[]) => {
    const ok = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|bmp)$/i.test(f.name));
    if (!ok.length && files.length) toast('请选择图片文件', 'error');
    const fresh = ok.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'idle' as const }));
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
          w.postMessage({ id: current.id, file: current.file, model: s.model, clean: s.clean });
        });
        if (!alive.current) break;
        if (live.current !== at) {
          setItems((list) => list.map((i) => (i.id === current.id ? { ...i, status: 'idle' } : i)));
          break;
        }
        const cutUrl = URL.createObjectURL(r.blob);
        setItems((list) =>
          list.map((i) =>
            i.id === current.id ? { ...i, status: 'done', cut: r.blob, cutUrl, box: r.box, size: { width: r.width, height: r.height } } : i
          )
        );
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
    const box = s.trim && i.box ? i.box : { x: 0, y: 0, w: i.size!.width, h: i.size!.height };
    if (s.bg === 'none' && !s.trim && format === 'png') return i.cut!;
    const bmp = await createImageBitmap(i.cut!);
    const c = document.createElement('canvas');
    c.width = box.w;
    c.height = box.h;
    const ctx = c.getContext('2d')!;
    if (s.bg !== 'none') {
      ctx.fillStyle = s.bg === 'white' ? '#ffffff' : s.color;
      ctx.fillRect(0, 0, box.w, box.h);
    }
    ctx.drawImage(bmp, -box.x, -box.y);
    bmp.close();
    return new Promise((resolve, reject) =>
      c.toBlob(
        (b) => (b?.type === MIME[format] ? resolve(b) : reject(new Error('浏览器不支持这个输出格式，请选择 PNG'))),
        MIME[format],
        0.92
      )
    );
  }
  const exportSig = `${maskSig}:${s.bg}:${s.color}:${s.trim}:${format}:${done.map((i) => i.id).join()}`;
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
    save: download
  });
  const remove = (id: string) => {
    const old = items.find((i) => i.id === id);
    if (old) {
      URL.revokeObjectURL(old.url);
      if (old.cutUrl) URL.revokeObjectURL(old.cutUrl);
    }
    setItems((list) => list.filter((i) => i.id !== id));
  };
  const clearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.url);
      if (i.cutUrl) URL.revokeObjectURL(i.cutUrl);
    });
    setItems([]);
    setSelected('');
  };

  const showCut = view === 'cut' && item?.cutUrl;
  const stageBg = showCut && s.bg !== 'none' ? (s.bg === 'white' ? '#ffffff' : s.color) : undefined;

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
              className={'image-kit-preview cutout-preview' + (showCut && s.bg === 'none' ? '' : ' is-solid')}
              style={stageBg ? { background: stageBg } : undefined}
            >
              <img
                src={showCut ? item.cutUrl : item.url}
                alt={item.file.name}
                className={item.status === 'work' ? 'is-working' : undefined}
              />
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
            <div className="cutout-caption">
              {item.cutUrl ? (
                <Segmented
                  className="seg-sm"
                  label="预览"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'cut', label: '抠图后' },
                    { value: 'original', label: '原图' }
                  ]}
                />
              ) : (
                <p className="image-kit-caption">{item.status === 'error' ? item.error : '点“开始抠图”，结果会出现在这里'}</p>
              )}
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

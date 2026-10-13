import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ToolPage } from '../ToolPage';
import { CheckIcon, CopyIcon, DownloadIcon, ExampleButton, FileIcon, Led } from '../ui';
import { useShortcuts } from '../../lib/useShortcuts';
import { toolById } from '../../tools';
import { copyText, pickFiles, saveBlob } from '../../lib/files';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { useFileDrop } from '../../lib/useFileDrop';
import './OfficeKit.css';
import { useHandOff } from '../../lib/useHandOff';
import { toast } from '../Toast';
export function OfficePage({ id, sub, children }: { id: string; sub: string; children: ReactNode }) {
  return (
    <ToolPage
      tool={toolById(id)!}
      sub={
        <>
          {sub}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="office-kit">{children}</div>
    </ToolPage>
  );
}
// 设置自动存到本机；改过以后工具页标题旁会出现“恢复默认”
export function usePreference<T extends object>(key: string, fallback: T, content?: readonly (keyof T)[]) {
  const [value, setValue] = usePersisted(key, fallback, content);
  return [value, setValue] as const;
}
// 文字工具的版式（和文件工具同一套宽屏方案 B）：左边主区放原文和结果，右边是设置栏（iOS 设置式分组）。
// 设置栏里的开关、几选一、输入框各占一行，天然对齐；≤900px 时设置栏排到主区后面
export function TextLayout({ side, children }: { side?: ReactNode; children: ReactNode }) {
  return (
    <div className={'tw' + (side ? ' has-side' : '')}>
      <div className="tw-main">{children}</div>
      {side && (
        <aside className="tw-side" aria-label="设置">
          {side}
        </aside>
      )}
    </div>
  );
}

// 设置栏里的一组：小标题 + 白底分组 + 灰字说明
export function SideGroup({ title, note, children }: { title?: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {title && <h2 className="group-title">{title}</h2>}
      {children && <div className="group">{children}</div>}
      {note && <p className="group-note">{note}</p>}
    </>
  );
}

// 设置栏里的单选列表（iOS 设置式：每个选项一行，选中的打勾）。选项多于 4 个、又想一眼看全时用它代替下拉框
export function ChoiceList<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode }[];
}) {
  return (
    <div className="group choice-list" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="choice-row"
          onClick={() => onChange(o.value)}
        >
          <span>
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </span>
          {o.value === value && <CheckIcon size={18} />}
        </button>
      ))}
    </div>
  );
}

// 原文 / 结果卡片：标题行左边是名字，右边固定放这张卡片的操作——
// 原文：打开文件、试试示例、清空；结果：复制、下载。每个文字工具的按钮都在同一个位置
export function TextBox({
  label,
  value,
  onChange,
  readOnly = false,
  example,
  onFiles,
  accept,
  output,
  placeholder,
  actions,
  foot,
  textareaClass
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  // 输入框为空时显示“试试示例”，点一下填入这段文字
  example?: string;
  // 传了就在标题行放“打开文件”
  onFiles?: (files: File[]) => void;
  accept?: string;
  // 结果卡片：标题行放复制和下载（⌘S 也是下载）
  output?: { name?: string; ready?: boolean };
  placeholder?: string;
  actions?: ReactNode;
  foot?: ReactNode;
  textareaClass?: string;
}) {
  const id = useId();
  // 外层结构固定不变，示例按钮出现或消失时输入框不会重新挂载、丢焦点
  return (
    <section className="tw-box">
      <div className="tw-box-head">
        <label htmlFor={id}>{label}</label>
        <div className="tw-box-actions">
          {actions}
          {onFiles && <OpenFile onFiles={onFiles} accept={accept} />}
          {example && !readOnly && !value && <ExampleButton onClick={() => onChange?.(example)} />}
          {!readOnly && onChange && value && (
            <button
              type="button"
              className="btn-soft btn-sm"
              onClick={() => {
                onChange('');
                toast('已清空');
              }}
            >
              清空
            </button>
          )}
          {output && <OutputActions text={value} name={output.name} ready={output.ready ?? !!value} compact />}
        </div>
      </div>
      <textarea
        id={id}
        className={textareaClass}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder ?? (readOnly ? '结果会出现在这里' : '在这里输入或粘贴文字…')}
      />
      {foot && <div className="tw-box-foot">{foot}</div>}
    </section>
  );
}

// 和 TextBox 同一个样子的卡片，里面放预览、对比结果这类不是文本框的内容
export function Panel({
  title,
  actions,
  children,
  foot,
  className = ''
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
}) {
  return (
    <section className={'tw-box tw-panel' + (className ? ' ' + className : '')}>
      <div className="tw-box-head">
        <h2>{title}</h2>
        {actions && <div className="tw-box-actions">{actions}</div>}
      </div>
      <div className="tw-panel-body">{children}</div>
      {foot && <div className="tw-box-foot">{foot}</div>}
    </section>
  );
}

// 卡片标题行里的小号“打开文件”
export function OpenFile({ onFiles, accept = '.txt,.md,.csv,.json' }: { onFiles: (files: File[]) => void; accept?: string }) {
  return (
    <button
      type="button"
      className="btn-soft btn-sm"
      onClick={async () => {
        const files = await pickFiles(accept, false);
        if (files.length) onFiles(files);
      }}
    >
      <FileIcon size={15} />
      打开文件
    </button>
  );
}
export function OutputActions({
  text,
  name = 'result.txt',
  ready = !!text,
  compact = false
}: {
  text: string;
  name?: string;
  ready?: boolean;
  // compact：放在卡片标题行里的小号按钮
  compact?: boolean;
}) {
  function download() {
    saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
    toast('已开始下载');
  }
  useShortcuts({ save: () => (ready ? download() : false) });
  const copy = (
    <button
      type="button"
      className={compact ? 'btn-soft btn-sm' : 'btn-soft'}
      disabled={!ready}
      onClick={async () => {
        const ok = await copyText(text);
        toast(ok ? '已复制' : '复制失败，请选中文字手动复制', ok ? 'done' : 'error');
      }}
    >
      <CopyIcon size={compact ? 15 : 16} />
      {compact ? '复制' : '复制结果'}
    </button>
  );
  const save = (
    <button type="button" className={compact ? 'btn-soft btn-sm' : 'btn-soft'} disabled={!ready} onClick={download}>
      {compact && <DownloadIcon size={15} />}
      下载
    </button>
  );
  if (compact)
    return (
      <>
        {copy}
        {save}
      </>
    );
  return (
    <div className="office-row">
      {copy}
      {save}
    </div>
  );
}
export function useIncoming(onFiles: (files: File[]) => void) {
  useHandOff(onFiles);
  return useFileDrop(onFiles);
}
export function useOfficeWorker<T>(createWorker: () => Worker, input: unknown, delay = 180) {
  const [state, setState] = useState<{ input: string; result?: T; error: string; busy: boolean }>();
  const factory = useRef(createWorker);
  factory.current = createWorker;
  const serialized = JSON.stringify(input);
  useEffect(() => {
    let active = true;
    let worker: Worker;
    const fail = () => {
      if (active) setState({ input: serialized, busy: false, error: '处理失败，内容短一点再试' });
    };
    setState({ input: serialized, error: '', busy: true });
    try {
      worker = factory.current();
    } catch {
      fail();
      return;
    }
    const timer = setTimeout(() => {
      try {
        worker.postMessage(JSON.parse(serialized));
      } catch {
        fail();
      }
    }, delay);
    worker.onmessage = (e) => {
      if (!active) return;
      setState({ input: serialized, busy: false, error: e.data.error || '', result: e.data.error ? undefined : e.data.result });
    };
    worker.onerror = fail;
    return () => {
      active = false;
      clearTimeout(timer);
      worker.terminate();
    };
  }, [serialized, delay]);
  const current = state?.input === serialized ? state : undefined;
  return { result: current?.result, error: current?.error || '', busy: current?.busy ?? true };
}
export function Status({ busy, error, ready }: { busy?: boolean; error?: string; ready?: boolean }) {
  // 处理中锁住标题旁的“恢复默认”
  useSettingsLock(!!busy);
  return (
    <p className={error ? 'office-error' : 'office-note'} role="status">
      <Led status={error ? 'error' : busy ? 'work' : ready ? 'done' : 'idle'} />{' '}
      {error || (busy ? '正在处理…' : ready ? '已完成' : '输入内容后开始')}
    </p>
  );
}

export function useOfficeRead() {
  const generation = useRef(0);
  const active = useRef(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function invalidate() {
    generation.current++;
    setReading(false);
    setError('');
  }
  async function read<T>(operation: () => Promise<T>, commit: (value: T) => void) {
    const current = ++generation.current;
    setReading(true);
    setError('');
    try {
      const value = await operation();
      if (active.current && generation.current === current) commit(value);
    } catch (e) {
      if (active.current && generation.current === current) setError(e instanceof Error ? e.message : '读不了这个文件，换个文本文件试试');
    } finally {
      if (active.current && generation.current === current) setReading(false);
    }
  }
  return { reading, error, read, invalidate };
}

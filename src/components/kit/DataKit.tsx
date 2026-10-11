import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSettingsLock } from '../../lib/settings';
import { ToolPage } from '../ToolPage';
import { ArrowDownIcon, ArrowUpIcon, ExampleButton, Led } from '../ui';
import { toolById } from '../../tools';
import { pickFiles } from '../../lib/files';
import { useHandOff } from '../../lib/useHandOff';
import { useFileDrop } from '../../lib/useFileDrop';
import { dataDefaults, cellText, type ParseOptions, type ViewOptions } from '../../lib/dataCore';
import type { TableSummary, TableView } from '../../lib/dataWorker';
import './DataKit.css';
import { Select } from '../Select';
import { useMedia, TOUCH } from '../../lib/useMedia';
export function DataPage({
  id,
  children,
  status,
  busy,
  error
}: {
  id: string;
  children: ReactNode;
  status: string;
  busy: boolean;
  error: string;
}) {
  // 处理中锁住标题旁的“恢复默认”
  useSettingsLock(busy);
  return (
    <ToolPage
      tool={toolById(id)!}
      sub={
        <>
          <span>数据只在浏览器里。</span>
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <div className="data-kit">
        {children}
        <p className={error ? 'data-error' : 'data-status'} role="status">
          <Led status={error ? 'error' : busy ? 'work' : status ? 'done' : 'idle'} />
          {error || (busy ? status || '正在处理…' : status || '选个文件，或粘贴数据。')}
        </p>
      </div>
    </ToolPage>
  );
}
// 示例表格：带重复行、首尾空格和大小写不一，清洗、统计、图表、SQL 都能马上看到效果
const SAMPLE_CSV = `日期,城市,品类,销量,单价
2026-09-01,上海,咖啡豆,32,68
2026-09-01,北京,咖啡豆,21,68
2026-09-01,杭州,滤纸,54,15
2026-09-02,上海,手冲壶,6,239
2026-09-02, 北京 ,滤纸,40,15
2026-09-02,深圳,咖啡豆,18,68
2026-09-03,上海,咖啡豆,35,68
2026-09-03,杭州,手冲壶,4,239
2026-09-03,深圳,Filter Paper,22,15
2026-09-04,北京,咖啡豆,27,68
2026-09-04,上海,滤纸,61,15
2026-09-04,上海,滤纸,61,15
2026-09-05,杭州,咖啡豆,29,68
2026-09-05,深圳,手冲壶,9,239
2026-09-05,北京,FILTER PAPER,33,15
2026-09-06,上海,咖啡豆,44,68
2026-09-06,杭州,滤纸,38,15
2026-09-07,深圳,咖啡豆,25,68
2026-09-07,北京,手冲壶,7,239
2026-09-07,上海,咖啡豆,39,68
`;
export const sampleTable = () => new File(['\ufeff' + SAMPLE_CSV], '示例-门店销量.csv', { type: 'text/csv' });

export function DataImport({
  onFile,
  busy,
  accept = '.csv,.tsv,.txt,.json,.xlsx,.xls,.ods,.parquet',
  sample = accept.includes('.csv') ? { label: '用示例表格试试', file: sampleTable } : undefined,
  children
}: {
  onFile: (file: File) => void;
  busy?: boolean;
  accept?: string;
  // 没有文件也能先看看效果；默认能读 CSV 的工具都带示例表格
  sample?: { label: string; file: () => File };
  children?: ReactNode;
}) {
  const current = useRef({ onFile, busy });
  current.current = { onFile, busy };
  const dragging = useFileDrop((files) => {
    if (files[0] && !current.current.busy) current.current.onFile(files[0]);
  });
  useHandOff((files) => {
    if (files[0] && !current.current.busy) current.current.onFile(files[0]);
  });
  const touch = useMedia(TOUCH);
  return (
    <div className={`data-import ${dragging ? 'data-drag' : ''}`}>
      <div>
        <strong>{dragging ? '松手，读取表格' : touch ? '从手机里选一个文件' : '把文件拖到这里'}</strong>
        <p>
          {accept.replaceAll('.', '').replaceAll(',', ' · ')}
          {touch ? '' : '，也能粘贴'}
        </p>
        {children}
        {sample && !busy && <ExampleButton onClick={() => onFile(sample.file())}>{sample.label}</ExampleButton>}
      </div>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          const files = await pickFiles(accept, false);
          if (files[0]) onFile(files[0]);
        }}
      >
        选择文件
      </button>
    </div>
  );
}
export function DataParseOptions({
  value,
  onChange,
  encoding = true,
  disabled = false
}: {
  value: ParseOptions;
  onChange: (v: ParseOptions) => void;
  encoding?: boolean;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="data-controls data-options">
      <label>
        分隔符
        <Select value={value.delimiter} onChange={(e) => onChange({ ...value, delimiter: e.target.value })}>
          <option value="">自动识别</option>
          <option value=",">逗号 ,</option>
          <option value={'\t'}>制表符 Tab</option>
          <option value=";">分号 ;</option>
          <option value="|">竖线 |</option>
        </Select>
      </label>
      {encoding && (
        <label>
          编码
          <Select value={value.encoding} onChange={(e) => onChange({ ...value, encoding: e.target.value })}>
            <option value="auto">自动（UTF-8 / GBK）</option>
            <option value="utf-8">UTF-8</option>
            <option value="gb18030">GBK / GB18030</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="utf-16be">UTF-16 BE</option>
          </Select>
        </label>
      )}
      <label className="data-check">
        <input type="checkbox" checked={value.header} onChange={(e) => onChange({ ...value, header: e.target.checked })} />
        首行是表头
      </label>
      <label className="data-check">
        <input type="checkbox" checked={value.infer} onChange={(e) => onChange({ ...value, infer: e.target.checked })} />
        推断数字和布尔值
      </label>
    </fieldset>
  );
}
export function DataSheets({ sheets, value, onChange }: { sheets: TableSummary[]; value: string; onChange: (name: string) => void }) {
  return sheets.length ? (
    <label className="data-sheet">
      工作表
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {sheets.map((s) => (
          <option value={s.name} key={s.name}>
            {s.name} · {s.count.toLocaleString()} 行
          </option>
        ))}
      </Select>
    </label>
  ) : null;
}
export const viewDefaults: ViewOptions = { filter: '', sort: -1, descending: false };
export { dataDefaults };
export function DataTable({
  fetchView,
  version,
  columns,
  options = viewDefaults,
  onSort
}: {
  fetchView: (start: number, limit: number) => Promise<TableView>;
  version: string;
  columns: string[];
  options?: ViewOptions;
  onSort?: (index: number) => void;
}) {
  const [view, setView] = useState<TableView>({ columns, rows: [], total: 0, start: 0 });
  const [start, setStart] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50000;
  const pageOffset = page * pageSize;
  const [widths, setWidths] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const loader = useRef(fetchView);
  loader.current = fetchView;
  const rowHeight = 38;
  useEffect(() => {
    setPage(0);
    setStart(0);
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [version]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      () =>
        loader
          .current(pageOffset + start, Math.min(35, pageSize - start))
          .then((v) => {
            if (active) {
              setView(v);
              setError('');
            }
          })
          .catch((e) => {
            if (active) setError(String(e.message));
          }),
      60
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [start, pageOffset, version]);
  const grid = columns.map((_, i) => `${widths[i] ?? 180}px`).join(' ');
  const changePage = (next: number) => {
    setPage(next);
    setStart(0);
    if (scroll.current) scroll.current.scrollTop = 0;
  };
  return (
    <>
      {view.total > pageSize && (
        <div className="data-controls">
          <button className="btn-soft" disabled={page === 0} onClick={() => changePage(page - 1)}>
            上一页
          </button>
          <label>
            页码
            <input
              type="number"
              min="1"
              max={Math.ceil(view.total / pageSize)}
              value={page + 1}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= Math.ceil(view.total / pageSize)) changePage(n - 1);
              }}
            />
          </label>
          <span className="data-note">共 {Math.ceil(view.total / pageSize)} 页，每页最多 5 万行</span>
          <button className="btn-soft" disabled={(page + 1) * pageSize >= view.total} onClick={() => changePage(page + 1)}>
            下一页
          </button>
        </div>
      )}
      <div
        className="data-table"
        ref={scroll}
        onScroll={(e) => setStart(Math.max(0, Math.floor(e.currentTarget.scrollTop / rowHeight) - 4))}
        role="table"
        aria-label="数据预览"
        aria-rowcount={view.total + 1}
        aria-colcount={columns.length}
      >
        <div className="data-table-head" role="row" style={{ gridTemplateColumns: grid }}>
          {columns.map((name, i) => (
            <div key={i} role="columnheader" aria-sort={options.sort === i ? (options.descending ? 'descending' : 'ascending') : 'none'}>
              <button onClick={() => onSort?.(i)} title={name}>
                {name}
                {options.sort === i && (options.descending ? <ArrowDownIcon size={12} /> : <ArrowUpIcon size={12} />)}
              </button>
              <input
                aria-label={`调整 ${name} 列宽`}
                type="range"
                min="90"
                max="600"
                value={widths[i] ?? 180}
                onChange={(e) => setWidths((w) => ({ ...w, [i]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            height: Math.max(0, Math.min(pageSize, view.total - pageOffset)) * rowHeight,
            position: 'relative',
            width: 'max-content',
            minWidth: '100%'
          }}
        >
          {view.rows.map((row, i) => (
            <div
              role="row"
              aria-rowindex={view.start + i + 2}
              className="data-table-row"
              key={view.start + i}
              style={{ gridTemplateColumns: grid, top: (view.start + i - pageOffset) * rowHeight }}
            >
              {columns.map((_, j) => (
                <div role="cell" title={cellText(row[j])} key={j}>
                  {cellText(row[j])}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="data-note">{error || `共 ${view.total.toLocaleString()} 行 · 拖表头滑块调列宽`}</p>
    </>
  );
}

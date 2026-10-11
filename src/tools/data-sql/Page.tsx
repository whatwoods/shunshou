import { toast } from '../../components/Toast';
import { useRef, useState } from 'react';
import { DataImport, DataPage, DataTable } from '../../components/kit/DataKit';
import { useDataRpc } from '../../lib/dataClient';
import { saveBlob } from '../../lib/files';
import type { TableView } from '../../lib/dataWorker';
import { quoteIdentifier } from './logic';
interface Schema {
  name: string;
  columns: string[];
}
export default function Sql() {
  const rpc = useDataRpc(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
  // SQL 正文是用户内容，只放在内存里，关页就没了
  const [query, setQuery] = useState('SELECT * FROM "data" LIMIT 100;');
  const [tables, setTables] = useState<Schema[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const gen = useRef(0);
  const inFlight = useRef(false);
  async function run(file?: File) {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++gen.current;
    setBusy(true);
    setError('');
    setStatus(file ? '正在导入文件…' : '正在运行 SQL…');
    if (!file) {
      setColumns([]);
      setCount(0);
    }
    try {
      if (file) {
        const result = await rpc.call<{ tables: Schema[]; imported: string[] }>({ action: 'load', file });
        if (current !== gen.current) return;
        setTables(result.tables);
        setQuery(`SELECT * FROM ${quoteIdentifier(result.imported[0])} LIMIT 100;`);
        setStatus(`已导入 ${result.imported.join('、')}，可再加文件用 JOIN 关联。`);
      } else {
        const result = await rpc.call<{ columns: string[]; count: number; tables: Schema[] }>({ action: 'query', query });
        if (current !== gen.current) return;
        setColumns(result.columns);
        setCount(result.count);
        setTables(result.tables);
        setRevision((n) => n + 1);
        setStatus(`查询完成 · ${result.count.toLocaleString()} 行`);
      }
    } catch (e) {
      if (current === gen.current) setError(`处理失败：${e instanceof Error ? e.message : e}。检查一下 SQL 或文件格式。`);
    } finally {
      if (current === gen.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }
  function cancel() {
    gen.current++;
    rpc.stop();
    inFlight.current = false;
    setBusy(false);
    setTables([]);
    setColumns([]);
    setCount(0);
    setStatus('请重新导入文件。');
    toast('已清空数据库');
  }
  async function exportFile(format: 'csv' | 'json') {
    try {
      saveBlob(await rpc.call<Blob>({ action: 'export', format }), `查询结果.${format}`);
      toast('已开始下载');
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <DataPage id="data-sql" busy={busy} error={error} status={status}>
      <DataImport busy={busy} onFile={run} />
      <div className="data-panel">
        <h2>本地数据表</h2>
        {tables.length ? (
          <div className="data-chip-list">
            {tables.map((table) => (
              <button
                className="btn-soft"
                disabled={busy}
                title={table.columns.join('、')}
                key={table.name}
                onClick={() => setQuery(`SELECT * FROM ${quoteIdentifier(table.name)} LIMIT 100;`)}
              >
                {table.name} · {table.columns.length} 列
              </button>
            ))}
          </div>
        ) : (
          <p className="data-note">文件名就是表名，Excel 每张工作表各建一张表。</p>
        )}
        {tables.map((table) => (
          <p className="data-note" key={table.name}>
            {table.name}：{table.columns.join(' · ')}
          </p>
        ))}
      </div>
      <label>
        SQL 查询
        <textarea
          value={query}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void run();
            }
          }}
        />
      </label>
      <div className="data-actions">
        <button className="btn" disabled={busy || !query.trim()} onClick={() => run()}>
          运行 SQL · ⌘ / Ctrl + Enter
        </button>
        <button className="btn-soft" onClick={cancel}>
          {busy ? '停止查询（清空数据库）' : '清空数据库'}
        </button>
        <button className="btn-soft" disabled={busy || !columns.length} onClick={() => exportFile('csv')}>
          导出 CSV
        </button>
        <button className="btn-soft" disabled={busy || !columns.length} onClick={() => exportFile('json')}>
          导出 JSON
        </button>
      </div>
      {columns.length > 0 && (
        <>
          <p className="data-note">结果 {count.toLocaleString()} 行；多条 SQL 只显示最后一条的结果。</p>
          <DataTable
            columns={columns}
            version={String(revision)}
            fetchView={(start, limit) => rpc.call<TableView>({ action: 'view', start, limit })}
          />
        </>
      )}
      <p className="data-note">SQLite 语法，支持 JOIN、GROUP BY 和窗口函数。数据都在内存里，超大文件请分批。</p>
    </DataPage>
  );
}

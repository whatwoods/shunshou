import { toast } from '../components/Toast';
import { useRef, useState } from 'react';
import { usePersisted } from './settings';
import { saveBlob } from './files';
import { dataDefaults, importRequest, type ParseOptions, type ViewOptions } from './dataCore';
import { useDataRpc } from './dataClient';
import type { TableSummary, TableView } from './dataWorker';
export function useDataWorkspace(id: string) {
  const rpc = useDataRpc();
  const [options, setOptions] = usePersisted<ParseOptions>(id, { ...dataDefaults, keepEmpty: id === 'data-clean' });
  const [sheets, setSheets] = useState<TableSummary[]>([]);
  const [sheet, setSheet] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const selected = sheets.find((s) => s.name === sheet);
  async function ingest(input: File | { text: string; format: 'csv' | 'json' }) {
    const gen = ++generation.current;
    rpc.stop();
    setBusy(true);
    setError('');
    setStatus('正在读取…');
    setSheets([]);
    setSheet('');
    try {
      const result = await rpc.call<TableSummary[]>(importRequest(input, options));
      if (gen !== generation.current) return;
      setSheets(result);
      setSheet(result[0]?.name ?? '');
      setRevision((v) => v + 1);
      setStatus(`读取完成 · ${result.length} 张表 · ${result.reduce((n, s) => n + s.count, 0).toLocaleString()} 行`);
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  async function exportFile(format: 'csv' | 'json', view?: ViewOptions) {
    const gen = generation.current;
    setBusy(true);
    setError('');
    setStatus('正在生成文件…');
    try {
      const result = await rpc.call<{ blob: Blob }>({
        action: 'export',
        sheet,
        format,
        delimiter: options.delimiter || ',',
        header: options.header,
        options: view
      });
      if (gen !== generation.current) return;
      saveBlob(result.blob, `${sheet || '数据'}.${format}`);
      setStatus('导出完成。');
      toast('已开始下载');
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  const fetchView = (start: number, limit: number, view: ViewOptions = { filter: '', sort: -1, descending: false }) =>
    rpc.call<TableView>({ action: 'view', sheet, start, limit, options: view });
  function cancel() {
    generation.current++;
    rpc.stop();
    setBusy(false);
    setSheets([]);
    setSheet('');
    setError('');
    setStatus('已取消，请重新导入文件。');
  }
  return {
    ...rpc,
    options,
    setOptions,
    sheets,
    setSheets,
    sheet,
    setSheet,
    selected,
    revision,
    setRevision,
    busy,
    setBusy,
    status: busy && rpc.progress ? rpc.progress : status,
    setStatus,
    error,
    setError,
    ingest,
    exportFile,
    fetchView,
    cancel
  };
}

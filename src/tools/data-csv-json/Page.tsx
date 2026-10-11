import { toast } from '../../components/Toast';
import { useState } from 'react';
import { DataImport, DataPage, DataParseOptions } from '../../components/kit/DataKit';
import { useDataWorkspace } from '../../lib/dataWorkspace';
import { copyText, saveBlob } from '../../lib/files';
import { usePersisted } from '../../lib/settings';
import { CopyIcon, SegField } from '../../components/ui';
interface Result {
  blob: Blob;
  preview: string;
  truncated: boolean;
}
export default function CsvJson() {
  const w = useDataWorkspace('data-csv-json');
  const [dir, setDir] = usePersisted('data-csv-json-direction', { value: 'csv' as 'csv' | 'json' });
  const direction = dir.value;
  const setDirection = (value: 'csv' | 'json') => setDir({ value });
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const outputFormat = direction === 'csv' ? 'json' : 'csv';
  async function convert() {
    w.setBusy(true);
    w.setError('');
    w.setStatus('正在转换…');
    setResult(null);
    try {
      await w.call({ action: 'text', text: input, format: direction, options: w.options });
      const value = await w.call<Result>({
        action: 'export',
        sheet: '数据',
        format: outputFormat,
        delimiter: w.options.delimiter || ',',
        header: w.options.header
      });
      setResult(value);
      w.setStatus('转换完成。');
    } catch (e) {
      w.setError(e instanceof Error ? e.message : String(e));
    } finally {
      w.setBusy(false);
    }
  }
  async function file(file: File) {
    w.setBusy(true);
    w.setError('');
    setResult(null);
    try {
      const format = /\.json$/i.test(file.name) ? 'json' : 'csv';
      setDirection(format);
      await w.call({ action: 'load', file, options: w.options });
      const value = await w.call<Result>({
        action: 'export',
        sheet: '数据',
        format: format === 'csv' ? 'json' : 'csv',
        delimiter: w.options.delimiter || ',',
        header: w.options.header
      });
      setResult(value);
      setInput('');
      w.setStatus(`${file.name} 已转换，可下载完整结果。`);
    } catch (e) {
      w.setError(e instanceof Error ? e.message : String(e));
    } finally {
      w.setBusy(false);
    }
  }
  return (
    <DataPage id="data-csv-json" busy={w.busy} status={w.status} error={w.error}>
      <div className="data-controls">
        <SegField
          label="转换方向"
          value={direction}
          disabled={w.busy}
          onChange={(value) => {
            setDirection(value);
            setResult(null);
          }}
          options={[
            { value: 'csv', label: 'CSV → JSON' },
            { value: 'json', label: 'JSON → CSV' }
          ]}
        />
      </div>
      <DataParseOptions
        disabled={w.busy}
        value={w.options}
        onChange={(v) => {
          w.setOptions(v);
          setResult(null);
        }}
      />
      <DataImport accept=".csv,.tsv,.txt,.json" onFile={file} busy={w.busy} />
      <div className="data-split">
        <label>
          {direction.toUpperCase()} 输入
          <textarea
            disabled={w.busy}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
            }}
            placeholder={direction === 'csv' ? '姓名,数量\n小顺,12' : '[{"姓名":"小顺","数量":12}]'}
            spellCheck={false}
          />
        </label>
        <label>
          {outputFormat.toUpperCase()} 结果
          <textarea readOnly value={result?.preview ?? ''} placeholder="结果会出现在这里" spellCheck={false} />
          {result?.truncated && <span className="data-note">只预览前 10 万字，复制和下载是全文。</span>}
        </label>
      </div>
      <div className="data-actions">
        <button className="btn" disabled={w.busy || !input.trim()} onClick={convert}>
          开始转换
        </button>
        <button
          className="btn-soft"
          disabled={!result || w.busy}
          onClick={async () => {
            if (result) {
              const ok = await copyText(await result.blob.text());
              toast(ok ? '已复制完整结果' : '复制失败，请下载结果', ok ? 'done' : 'error');
            }
          }}
        >
          <CopyIcon size={16} />
          复制结果
        </button>
        <button
          className="btn-soft"
          disabled={!result || w.busy}
          onClick={() => {
            if (result) {
              saveBlob(result.blob, `转换结果.${outputFormat}`);
              toast('已开始下载');
            }
          }}
        >
          下载 {outputFormat.toUpperCase()}
        </button>
      </div>
      <p className="data-note">导出 CSV 时公式前加单引号，防止被表格软件执行；前导零和大整数原样保留。</p>
    </DataPage>
  );
}

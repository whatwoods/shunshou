import { toast } from '../../components/Toast';
import { useEffect, useRef, useState } from 'react';
import { DataImport, DataPage, DataParseOptions, DataSheets, DataTable } from '../../components/kit/DataKit';
import { useDataWorkspace } from '../../lib/dataWorkspace';
import { cleanDefaults, type CleanOptions } from '../../lib/dataCore';
import { usePersisted } from '../../lib/settings';
import { saveBlob } from '../../lib/files';
import type { TableSummary, TableView } from '../../lib/dataWorker';
import { SegField } from '../../components/ui';
import { Select } from '../../components/Select';
// 查找和替换的词是用户内容，不存本机
const CONTENT = ['find', 'replace'] as const;
export default function Clean() {
  const w = useDataWorkspace('data-clean');
  const [settings, setSettings] = usePersisted<CleanOptions>('data-clean-settings', cleanDefaults, CONTENT);
  const [text, setText] = useState('');
  // 清洗结果记着是按哪份数据、哪套规则做的：规则一变（包括“恢复默认”）或换了数据，旧结果就不再显示，也下载不到
  const sig = `${w.sheet}|${w.revision}|${JSON.stringify(settings)}`;
  const current = useRef(sig);
  current.current = sig;
  const [made, setMade] = useState<{ out: TableSummary; sig: string } | null>(null);
  const result = made?.sig === sig ? made.out : null;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setSettings((v) => ({ ...v, splitColumn: -1, mergeColumns: [] }));
  }, [w.sheet, w.revision]);
  const update = (value: Partial<CleanOptions>) => setSettings((s) => ({ ...s, ...value }));
  // 结果作废时，“清洗完成”的提示也一并撤掉
  const stale = !!made && made.sig !== sig;
  const { status, setStatus } = w;
  useEffect(() => {
    if (stale && status.startsWith('清洗完成')) setStatus('');
  }, [stale, status, setStatus]);
  async function clean() {
    const at = sig;
    w.setBusy(true);
    w.setError('');
    w.setStatus('正在清洗…');
    try {
      const output = await w.call<TableSummary>({ action: 'clean', sheet: w.sheet, options: settings });
      if (current.current !== at) return;
      setMade({ out: output, sig: at });
      setRevision((n) => n + 1);
      w.setStatus(`清洗完成 · ${w.selected?.count ?? 0} → ${output.count} 行，原数据还在。`);
    } catch (e) {
      w.setError(String(e instanceof Error ? e.message : e));
    } finally {
      w.setBusy(false);
    }
  }
  async function download(format: 'csv' | 'json') {
    w.setBusy(true);
    w.setError('');
    try {
      const out = await w.call<{ blob: Blob }>({
        action: 'export',
        sheet: w.sheet,
        cleaned: true,
        format,
        delimiter: w.options.delimiter || ','
      });
      saveBlob(out.blob, `清洗结果.${format}`);
      toast('已开始下载');
    } catch (e) {
      w.setError(String(e));
    } finally {
      w.setBusy(false);
    }
  }
  return (
    <DataPage id="data-clean" busy={w.busy} status={w.status} error={w.error}>
      <DataParseOptions disabled={w.busy} value={w.options} onChange={w.setOptions} />
      <DataImport busy={w.busy} onFile={w.ingest} />
      <details className="data-panel">
        <summary>也可以粘贴 CSV 文本</summary>
        <label>
          CSV 文本
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'姓名,城市\n小顺,杭州'} />
        </label>
        <button className="btn-soft" disabled={!text || w.busy} onClick={() => w.ingest({ text, format: 'csv' })}>
          读取文本
        </button>
      </details>
      {w.selected && (
        <>
          <DataSheets sheets={w.sheets} value={w.sheet} onChange={w.setSheet} />
          <fieldset disabled={w.busy} className="data-panel">
            <h2>清洗规则</h2>
            <div className="data-controls">
              <label className="data-check">
                <input type="checkbox" checked={settings.trim} onChange={(e) => update({ trim: e.target.checked })} />
                去首尾空格
              </label>
              <label className="data-check">
                <input type="checkbox" checked={settings.empty} onChange={(e) => update({ empty: e.target.checked })} />
                去空行
              </label>
              <label className="data-check">
                <input type="checkbox" checked={settings.dedupe} onChange={(e) => update({ dedupe: e.target.checked })} />
                整行去重
              </label>
              <SegField
                label="统一大小写"
                value={settings.casing}
                onChange={(casing) => update({ casing })}
                options={(
                  [
                    ['keep', '不变'],
                    ['lower', '小写'],
                    ['upper', '大写']
                  ] as [CleanOptions['casing'], string][]
                ).map(([value, label]) => ({ value, label }))}
              />
              <label>
                查找文字
                <input value={settings.find} onChange={(e) => update({ find: e.target.value })} placeholder="按字面匹配" />
              </label>
              <label>
                替换为
                <input value={settings.replace} onChange={(e) => update({ replace: e.target.value })} placeholder="留空表示删除" />
              </label>
            </div>
            <div className="data-controls">
              <label>
                拆分一列
                <Select value={settings.splitColumn} onChange={(e) => update({ splitColumn: Number(e.target.value), mergeColumns: [] })}>
                  <option value={-1}>不拆分</option>
                  {w.selected.columns.map((column, i) => (
                    <option key={i} value={i}>
                      {column}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                拆分符
                <input value={settings.separator} onChange={(e) => update({ separator: e.target.value })} />
              </label>
              <label>
                合并分隔符
                <input value={settings.mergeSeparator} onChange={(e) => update({ mergeSeparator: e.target.value })} />
              </label>
            </div>
            <p className="data-note">合并出的列加在最后，原列保留；拆分和合并一次只做一种。</p>
            <div className="data-chip-list">
              {w.selected.columns.map((column, i) => (
                <label key={i} className="data-check">
                  <input
                    type="checkbox"
                    disabled={settings.splitColumn >= 0}
                    checked={settings.mergeColumns.includes(i)}
                    onChange={(e) =>
                      update({
                        mergeColumns: e.target.checked
                          ? [...settings.mergeColumns, i].sort((a, b) => a - b)
                          : settings.mergeColumns.filter((v) => v !== i)
                      })
                    }
                  />
                  合并 {column}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="data-actions">
            <button className="btn" disabled={w.busy} onClick={clean}>
              应用规则
            </button>
            <button className="btn-soft" disabled={!result || w.busy} onClick={() => download('csv')}>
              导出 CSV
            </button>
            <button className="btn-soft" disabled={!result || w.busy} onClick={() => download('json')}>
              导出 JSON
            </button>
          </div>
          <DataTable
            columns={result?.columns ?? w.selected.columns}
            version={`${w.revision}:${w.sheet}:${revision}:${result ? 'result' : 'source'}`}
            fetchView={(start, limit) =>
              w.call<TableView>({
                action: 'view',
                sheet: w.sheet,
                cleaned: !!result,
                start,
                limit,
                options: { filter: '', sort: -1, descending: false }
              })
            }
          />
        </>
      )}
    </DataPage>
  );
}

import { useState } from 'react';
import { DataImport, DataPage, DataParseOptions, DataSheets, DataTable, viewDefaults } from '../../components/kit/DataKit';
import { useDataWorkspace } from '../../lib/dataWorkspace';
export default function CsvViewer() {
  const w = useDataWorkspace('data-csv-viewer');
  const [view, setView] = useState(viewDefaults);
  return (
    <DataPage id="data-csv-viewer" busy={w.busy} status={w.status} error={w.error}>
      <DataParseOptions disabled={w.busy} value={w.options} onChange={w.setOptions} />
      <DataImport accept=".csv,.tsv,.txt" onFile={w.ingest} busy={w.busy}>
        <p>编码和分隔符下次导入时生效。</p>
      </DataImport>
      {w.busy && (
        <button className="btn-soft" onClick={w.cancel}>
          取消处理
        </button>
      )}
      {w.selected && (
        <>
          <div className="data-controls">
            <DataSheets sheets={w.sheets} value={w.sheet} onChange={w.setSheet} />
            <label className="data-wide">
              筛选所有列
              <input
                type="search"
                placeholder="输入要查找的文字"
                value={view.filter}
                onChange={(e) => setView({ ...view, filter: e.target.value })}
              />
            </label>
            <button className="btn-soft" onClick={() => setView(viewDefaults)}>
              重置筛选和排序
            </button>
          </div>
          <DataTable
            columns={w.selected.columns}
            version={`${w.revision}:${w.sheet}:${JSON.stringify(view)}`}
            options={view}
            fetchView={(start, limit) => w.fetchView(start, limit, view)}
            onSort={(sort) => setView({ ...view, sort, descending: view.sort === sort ? !view.descending : false })}
          />
          <div className="data-actions">
            <button className="btn" disabled={w.busy} onClick={() => w.exportFile('csv', view)}>
              导出当前结果 CSV
            </button>
            <button className="btn-soft" disabled={w.busy} onClick={() => w.exportFile('json', view)}>
              导出 JSON
            </button>
          </div>
        </>
      )}
    </DataPage>
  );
}

import { DataImport, DataPage, DataSheets, DataTable } from '../../components/kit/DataKit';
import { useDataWorkspace } from '../../lib/dataWorkspace';
export default function Excel() {
  const w = useDataWorkspace('data-excel');
  return (
    <DataPage id="data-excel" busy={w.busy} status={w.status} error={w.error}>
      <DataImport accept=".xlsx,.xls,.ods" onFile={w.ingest} busy={w.busy} />
      <p className="data-note">读取各工作表保存的数值，公式用文件里存的结果，不重算。首行当列名。</p>
      {w.busy && (
        <button className="btn-soft" onClick={w.cancel}>
          取消读取
        </button>
      )}
      {w.selected && (
        <>
          <DataSheets sheets={w.sheets} value={w.sheet} onChange={w.setSheet} />
          <DataTable columns={w.selected.columns} version={`${w.revision}:${w.sheet}`} fetchView={w.fetchView} />
          <div className="data-actions">
            <button className="btn" disabled={w.busy} onClick={() => w.exportFile('csv')}>
              导出当前工作表 CSV
            </button>
            <button className="btn-soft" disabled={w.busy} onClick={() => w.exportFile('json')}>
              导出当前工作表 JSON
            </button>
          </div>
        </>
      )}
    </DataPage>
  );
}

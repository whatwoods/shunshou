import { toast } from '../../components/Toast';
import { useEffect, useState } from 'react';
import { DataImport, DataPage, DataSheets } from '../../components/kit/DataKit';
import { useDataWorkspace } from '../../lib/dataWorkspace';
import { saveBlob } from '../../lib/files';
import { usePersisted } from '../../lib/settings';
import type { ChartType } from '../../lib/dataCore';
import type { ChartResult } from '../../lib/dataWorker';
import { renderChart, type ChartStyle } from './logic';
import { Select } from '../../components/Select';
function readStyle(): ChartStyle {
  const style = getComputedStyle(document.documentElement);
  const color = (v: string) => style.getPropertyValue(v).trim();
  return {
    ink: color('--ink'),
    muted: color('--ink-2'),
    line: color('--divider'),
    background: color('--surface'),
    palette: ['--accent', '--success', '--warning', '--danger', '--code-lit', '--ink-2'].map(color)
  };
}
export default function Chart() {
  const w = useDataWorkspace('data-chart');
  const [view, setView] = usePersisted('data-chart-view', { type: 'auto' as ChartType | 'auto' });
  const type = view.type;
  const setType = (t: ChartType | 'auto') => setView({ type: t });
  const [title, setTitle] = useState('');
  const [x, setX] = useState(0),
    [y, setY] = useState(1);
  const [data, setData] = useState<ChartResult | null>(null);
  const [style, setStyle] = useState(readStyle);
  const [url, setUrl] = useState('');
  const actual = type === 'auto' ? (data?.recommended ?? 'bar') : type;
  const svg = data ? renderChart(data.points, actual, title, style) : '';
  useEffect(() => {
    const observer = new MutationObserver(() => setStyle(readStyle()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setX(0);
    // 数值轴默认用第一个数字列，没有再退回第二列
    const s = w.selected;
    setY(s ? (s.numeric?.find((c) => c !== 0) ?? (s.columns.length > 1 ? 1 : 0)) : 0);
  }, [w.sheet, w.revision]);
  useEffect(() => {
    let active = true;
    setData(null);
    if (w.selected)
      w.call<ChartResult>({ action: 'chart', sheet: w.sheet, x, y })
        .then((result) => {
          if (active) setData(result);
        })
        .catch((e) => {
          if (active) w.setError(String(e.message));
        });
    return () => {
      active = false;
    };
  }, [w.sheet, w.revision, x, y]);
  useEffect(() => {
    if (!svg) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [svg]);
  async function png() {
    w.setBusy(true);
    w.setError('');
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1120;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器无法创建画布，请改用 SVG。');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('图片导出失败，请使用 SVG。'))), 'image/png')
      );
      saveBlob(blob, '图表.png');
      toast('已开始下载 PNG');
    } catch (e) {
      w.setError(String(e instanceof Error ? e.message : e));
    } finally {
      w.setBusy(false);
    }
  }
  return (
    <DataPage id="data-chart" busy={w.busy} status={w.status} error={w.error}>
      <DataImport onFile={w.ingest} busy={w.busy} />
      {w.selected && (
        <>
          <div className="data-controls">
            <DataSheets sheets={w.sheets} value={w.sheet} onChange={w.setSheet} />
            <label>
              图表类型
              <Select value={type} onChange={(e) => setType(e.target.value as ChartType | 'auto')}>
                <option value="auto">自动推荐</option>
                <option value="bar">柱状图</option>
                <option value="line">折线图</option>
                <option value="pie">饼图</option>
                <option value="scatter">散点图</option>
              </Select>
            </label>
            <label>
              分类 / X 轴
              <Select value={x} onChange={(e) => setX(Number(e.target.value))}>
                {w.selected.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              数值 / Y 轴
              <Select value={y} onChange={(e) => setY(Number(e.target.value))}>
                {w.selected.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label className="data-wide">
              图表标题
              <input value={title} placeholder="给图表起个名字" onChange={(e) => setTitle(e.target.value)} />
            </label>
          </div>
          {url && <img className="data-chart" src={url} alt={`${title || '数据图表'}，${data?.points.length ?? 0} 个数据点`} />}
          <p className="data-note">
            有效数字 {data?.total.toLocaleString() ?? 0} 行。最多画 2000 个点，柱状图 100 个；饼图只算正数，超过 12 项合为「其他」。
          </p>
          <div className="data-actions">
            <button className="btn" disabled={!url || w.busy} onClick={png}>
              导出 PNG
            </button>
            <button
              className="btn-soft"
              disabled={!svg || w.busy}
              onClick={() => {
                saveBlob(new Blob([svg], { type: 'image/svg+xml' }), '图表.svg');
                toast('已开始下载 SVG');
              }}
            >
              导出 SVG
            </button>
          </div>
        </>
      )}
    </DataPage>
  );
}

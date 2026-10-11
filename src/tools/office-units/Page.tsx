import { useState } from 'react';
import { ChoiceList, OfficePage, Panel, Status, TextLayout, usePreference } from '../../components/kit/OfficeKit';
import { CopyIcon, SwapIcon } from '../../components/ui';
import { copyText } from '../../lib/files';
import { toast } from '../../components/Toast';
import { units, convert } from './logic';
import { Select } from '../../components/Select';
export default function Page() {
  const [p, setP] = usePreference('office-units', { category: '长度', from: 0, to: 1 });
  const [value, setValue] = useState('1');
  const list = units[p.category] || units['长度'];
  let result = '',
    error = '';
  try {
    if (value.trim()) result = Number(convert(Number(value), list[p.from] || list[0], list[p.to] || list[1]).toPrecision(13)).toString();
  } catch (e) {
    error = (e as Error).message;
  }
  const unitSelect = (key: 'from' | 'to', label: string) => (
    <Select aria-label={label} value={p[key]} onChange={(e) => setP({ ...p, [key]: Number(e.target.value) })}>
      {list.map((u, i) => (
        <option key={u.name} value={i}>
          {u.name}
        </option>
      ))}
    </Select>
  );
  return (
    <OfficePage id="office-units" sub="常用单位随手换，KB 和 KiB 分清楚。">
      <TextLayout
        side={
          <>
            <h2 className="group-title">类别</h2>
            <ChoiceList
              label="类别"
              value={p.category}
              onChange={(category) => setP({ category, from: 0, to: 1 })}
              options={Object.keys(units).map((c) => ({ value: c, label: c }))}
            />
            <p className="group-note">
              1 市斤 = 500 克，1 市尺 = 1/3 米，1 亩 ≈ 666.7 平方米；1 KB = 1000 字节，1 KiB = 1024 字节。月和年长短不一，不参与换算。
            </p>
          </>
        }
      >
        <Panel
          title={p.category}
          actions={
            <>
              <button
                type="button"
                className="btn-soft btn-sm"
                onClick={() => {
                  setP({ ...p, from: p.to, to: p.from });
                  if (result) setValue(result);
                }}
              >
                <SwapIcon size={15} />
                交换
              </button>
              <button
                type="button"
                className="btn-soft btn-sm"
                disabled={!result}
                onClick={async () => {
                  const ok = await copyText(result);
                  toast(ok ? '已复制' : '复制失败，请选中数字手动复制', ok ? 'done' : 'error');
                }}
              >
                <CopyIcon size={15} />
                复制结果
              </button>
            </>
          }
        >
          <div className="unit-conv">
            <div className="unit-line">
              <input className="unit-value" type="number" aria-label="数值" value={value} onChange={(e) => setValue(e.target.value)} />
              {unitSelect('from', '原单位')}
            </div>
            <div className="unit-eq" aria-hidden="true">
              =
            </div>
            <div className="unit-line">
              <output className="unit-value">{result || '—'}</output>
              {unitSelect('to', '目标单位')}
            </div>
          </div>
        </Panel>
        {error && <Status error={error} />}
      </TextLayout>
    </OfficePage>
  );
}

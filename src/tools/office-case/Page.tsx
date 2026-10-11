import { useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  ChoiceList,
  Status,
  usePreference,
  useIncoming,
  useOfficeWorker,
  useOfficeRead
} from '../../components/kit/OfficeKit';
import { modes } from './logic';
export default function Page() {
  const [text, setText] = useState('');
  const { reading, error, read, invalidate } = useOfficeRead();
  const [p, setP] = usePreference('office-case', { mode: 'camel' as keyof typeof modes });
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<string>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), { text, mode: p.mode });
  function files(fs: File[]) {
    void read(() => fs[0].text(), setText);
  }
  useIncoming(files);
  const ready = !!text && result !== undefined && !busy && !reading && !error && !workerError;
  return (
    <OfficePage id="office-case" sub="每行单独转换，变量名、标题都行。">
      <TextLayout
        side={
          <>
            <h2 className="group-title">转换成</h2>
            <ChoiceList
              label="转换成"
              value={p.mode}
              onChange={(mode) => setP({ mode })}
              options={(Object.keys(modes) as (keyof typeof modes)[]).map((k) => ({ value: k, label: modes[k] }))}
            />
          </>
        }
      >
        <div className="tw-pair">
          <TextBox
            label="原文（每行一条）"
            example={'user profile id\nget_order_list\nShunShou-Toolbox\nMAX_RETRY_COUNT\nthe quick brown fox'}
            value={text}
            onFiles={files}
            onChange={(v) => {
              invalidate();
              setText(v);
            }}
          />
          <TextBox label="转换结果" value={result || ''} readOnly output={{ ready }} />
        </div>
        <Status busy={busy || reading} error={error || workerError} ready={!!text} />
      </TextLayout>
    </OfficePage>
  );
}

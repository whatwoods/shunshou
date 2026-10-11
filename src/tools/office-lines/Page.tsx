import { useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  SideGroup,
  Status,
  useIncoming,
  useOfficeRead,
  useOfficeWorker,
  usePreference
} from '../../components/kit/OfficeKit';
import { defaults, type processLines } from './logic';
import { Field, Segmented, SwitchRow } from '../../components/ui';
// 前后缀是用户输入的文字，不存本机
const CONTENT = ['prefix', 'suffix'] as const;
export default function Page() {
  const [text, setText] = useState('');
  const [options, setOptions] = usePreference('office-lines', defaults, CONTENT);
  const { reading, error, read, invalidate } = useOfficeRead();
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<ReturnType<typeof processLines>>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), {
    text,
    options
  });
  function files(files: File[]) {
    void read(async () => {
      if (files[0].size > 20_000_000) throw new Error('文件超过 20 MB，请分批处理');
      return files[0].text();
    }, setText);
  }
  useIncoming(files);
  const ready = !!text && !!result && !busy && !reading && !error && !workerError;
  return (
    <OfficePage id="office-lines" sub="把一列文字整理好，复制就能用。">
      <TextLayout
        side={
          <>
            <SideGroup title="清理">
              {(
                [
                  ['trim', '去首尾空白'],
                  ['empty', '去空行'],
                  ['unique', '去重（保留第一条）'],
                  ['ignoreCase', '去重和排序忽略大小写']
                ] as const
              ).map(([key, label]) => (
                <SwitchRow key={key} checked={options[key]} onChange={(v) => setOptions({ ...options, [key]: v })}>
                  {label}
                </SwitchRow>
              ))}
            </SideGroup>
            <SideGroup title="顺序" note="自然排序：“第 2”排在“第 10”前面。">
              <Field div block label="排列">
                <Segmented
                  label="顺序"
                  value={options.sort}
                  onChange={(sort) => setOptions({ ...options, sort })}
                  options={[
                    { value: 'none', label: '原顺序' },
                    { value: 'asc', label: '升序' },
                    { value: 'desc', label: '降序' },
                    { value: 'reverse', label: '倒序' }
                  ]}
                />
              </Field>
            </SideGroup>
            <SideGroup title="每行加上" note="按上面的顺序依次处理，最后加前后缀。">
              <Field label="前缀">
                <input value={options.prefix} placeholder="不加" onChange={(e) => setOptions({ ...options, prefix: e.target.value })} />
              </Field>
              <Field label="后缀">
                <input value={options.suffix} placeholder="不加" onChange={(e) => setOptions({ ...options, suffix: e.target.value })} />
              </Field>
            </SideGroup>
          </>
        }
      >
        <div className="tw-pair">
          <TextBox
            label="原文（每行一条）"
            example={'  第 10 章 复盘\n第 2 章 需求\n\n第 1 章 背景\n第 2 章 需求\n第 3 章 设计  \n\n第 10 章 复盘'}
            value={text}
            onFiles={files}
            accept=".txt,.md,.csv,.log"
            onChange={(v) => {
              invalidate();
              setText(v);
            }}
          />
          <TextBox
            label="处理结果"
            value={result?.text || ''}
            readOnly
            output={{ ready }}
            foot={result && text ? `${result.before} 行 → ${result.after} 行` : undefined}
          />
        </div>
        <Status busy={busy || reading} error={error || workerError} ready={!!text} />
      </TextLayout>
    </OfficePage>
  );
}

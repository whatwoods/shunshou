import { useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  ChoiceList,
  Status,
  useIncoming,
  useOfficeRead,
  useOfficeWorker,
  usePreference
} from '../../components/kit/OfficeKit';
import { variants, type Variant } from './logic';
import { SwapIcon } from '../../components/ui';
const EXAMPLE_CN = '这款软件的打印机驱动更新后，鼠标和内存条也能正常识别了。\n周末一起去图书馆复习，顺便借几本关于信息技术的书。';
const EXAMPLE_T = '這款軟體的印表機驅動更新後，滑鼠和記憶體也能正常識別了。\n週末一起去圖書館複習，順便借幾本關於資訊科技的書。';
export default function Page() {
  const [text, setText] = useState('');
  const [options, setOptions] = usePreference('office-chinese', { from: 'cn' as Variant, to: 't' as Variant });
  const { reading, error, read, invalidate } = useOfficeRead();
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<string>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), { text, ...options }, 250);
  function files(files: File[]) {
    void read(async () => {
      if (files[0].size > 8_000_000) throw new Error('文件超过 8 MB，请分批转换');
      return files[0].text();
    }, setText);
  }
  useIncoming(files);
  const ready = !!text && result !== undefined && !busy && !reading && !error && !workerError;
  const variantOptions = (Object.keys(variants) as Variant[]).map((v) => ({ value: v, label: variants[v] }));
  return (
    <OfficePage id="office-chinese" sub="转换整段文字，保留标点和换行">
      <TextLayout
        side={
          <>
            <h2 className="group-title">原文是</h2>
            <ChoiceList
              label="原文是"
              value={options.from}
              onChange={(from) => setOptions({ ...options, from })}
              options={variantOptions}
            />
            <h2 className="group-title">转换成</h2>
            <ChoiceList label="转换成" value={options.to} onChange={(to) => setOptions({ ...options, to })} options={variantOptions} />
            <p className="group-note">用 OpenCC 词库转换，“台湾繁体（含用词）”会顺带换掉地区用语。专有名词和一简多繁的字建议再核对。</p>
          </>
        }
      >
        <div className="tw-pair">
          <TextBox
            textareaClass="is-prose"
            label="原文"
            example={options.from === 'cn' ? EXAMPLE_CN : EXAMPLE_T}
            value={text}
            onFiles={files}
            accept=".txt,.md"
            onChange={(v) => {
              invalidate();
              setText(v);
            }}
          />
          <TextBox
            textareaClass="is-prose"
            label="转换结果"
            value={result || ''}
            readOnly
            output={{ ready }}
            actions={
              <button
                type="button"
                className="btn-soft btn-sm"
                disabled={!ready}
                title="把结果当原文，反过来转"
                onClick={() => {
                  setOptions({ from: options.to, to: options.from });
                  invalidate();
                  setText(result || '');
                }}
              >
                <SwapIcon size={15} />
                反过来转
              </button>
            }
          />
        </div>
        <Status busy={busy || reading} error={error || workerError} ready={!!text} />
      </TextLayout>
    </OfficePage>
  );
}

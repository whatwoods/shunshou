import { useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  SideGroup,
  Panel,
  Status,
  OutputActions,
  usePreference,
  useOfficeWorker,
  useIncoming,
  useOfficeRead
} from '../../components/kit/OfficeKit';
import type { DiffRow } from './logic';
import { ExampleButton, SwitchRow } from '../../components/ui';
const EXAMPLE = [
  '会议时间：10 月 14 日 下午 3 点\n地点：三楼小会议室\n参会：产品、设计、前端\n议题：首页改版\n预计 1 小时',
  '会议时间：10 月 14 日 下午 4 点\n地点：三楼小会议室\n参会：产品、设计、前端、测试\n议题：首页改版和 HTML 预览\n预计 1 小时'
];
export default function Page() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const { reading, error, read, invalidate } = useOfficeRead();
  const [p, setP] = usePreference('office-text-diff', { ignore: false, stack: false });
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<DiffRow[]>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), {
    left,
    right,
    ignore: p.ignore
  });
  // 拖进来两个文件就各放一边；一个文件先放原文，原文已经有内容就放新文本
  function files(fs: File[], target?: 'left' | 'right') {
    void read(
      () => Promise.all(fs.slice(0, 2).map((f) => f.text())),
      (values) => {
        if (values.length > 1) {
          setLeft(values[0]);
          setRight(values[1]);
        } else ((target ?? (left ? 'right' : 'left')) === 'left' ? setLeft : setRight)(values[0]);
      }
    );
  }
  useIncoming((fs) => files(fs));
  function side(row: DiffRow, isLeft: boolean) {
    const text = isLeft ? row.left : row.right;
    const n = isLeft ? row.leftNumber : row.rightNumber;
    return (
      <div className="office-diff">
        {n !== undefined ? (
          <>
            <span className="office-note">{n}　</span>
            {row.changes ? (
              row.changes
                .filter((c) => (isLeft ? !c.added : !c.removed))
                .map((c, i) =>
                  c.removed ? <del key={i}>{c.value}</del> : c.added ? <ins key={i}>{c.value}</ins> : <span key={i}>{c.value}</span>
                )
            ) : row.left === undefined ? (
              <ins>{text || ' '}</ins>
            ) : row.right === undefined ? (
              <del>{text || ' '}</del>
            ) : (
              text || ' '
            )}
          </>
        ) : (
          <span aria-label="空行">　</span>
        )}
      </div>
    );
  }
  const ready = result !== undefined && !busy && !reading && !error && !workerError;
  const diffText =
    result
      ?.map((r) =>
        r.left === r.right
          ? '  ' + r.left
          : [r.left !== undefined ? '- ' + r.left : '', r.right !== undefined ? '+ ' + r.right : ''].filter(Boolean).join('\n')
      )
      .join('\n') || '';
  return (
    <OfficePage id="office-text-diff" sub="逐行比较，变化的词也一眼看清">
      <TextLayout
        side={
          <SideGroup title="对比方式">
            <SwitchRow checked={p.ignore} onChange={(ignore) => setP({ ...p, ignore })}>
              忽略行首尾空白
            </SwitchRow>
            <SwitchRow checked={p.stack} onChange={(stack) => setP({ ...p, stack })}>
              结果上下排
            </SwitchRow>
          </SideGroup>
        }
      >
        <div className="tw-pair">
          <TextBox
            label="原文"
            value={left}
            onFiles={(fs) => files(fs, 'left')}
            actions={
              !left &&
              !right && (
                <ExampleButton
                  onClick={() => {
                    invalidate();
                    setLeft(EXAMPLE[0]);
                    setRight(EXAMPLE[1]);
                  }}
                />
              )
            }
            onChange={(v) => {
              invalidate();
              setLeft(v);
            }}
          />
          <TextBox
            label="新文本"
            value={right}
            onFiles={(fs) => files(fs, 'right')}
            onChange={(v) => {
              invalidate();
              setRight(v);
            }}
          />
        </div>
        <Status busy={busy || reading} error={error || workerError} ready={!!(left || right)} />
        <Panel
          title="差异"
          actions={<OutputActions compact ready={ready && !!(left || right)} text={diffText} name="diff.txt" />}
          foot={(result?.length || 0) > 5000 ? '只预览前 5000 行，复制和下载是全部差异' : undefined}
        >
          {left || right ? (
            result?.slice(0, 5000).map((row, i) => (
              <div key={i} className={p.stack ? 'office-diff-row is-stack' : 'office-diff-row'}>
                {side(row, true)}
                {side(row, false)}
              </div>
            ))
          ) : (
            <p className="office-note">两边都填上文字，差异会出现在这里</p>
          )}
        </Panel>
      </TextLayout>
    </OfficePage>
  );
}

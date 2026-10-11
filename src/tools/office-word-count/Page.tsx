import { useEffect, useRef, useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  SideGroup,
  OutputActions,
  Status,
  useIncoming,
  useOfficeWorker,
  useOfficeRead
} from '../../components/kit/OfficeKit';
import { countText } from './logic';

// Token 数：常驻一个 Worker（分词表只加载一次），停手 250ms 后再算，只认最新一次的结果
function useTokens(text: string) {
  const [state, setState] = useState<{ tokens?: number; busy: boolean; failed: boolean }>({ busy: false, failed: false });
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    const id = ++latest.current;
    if (!text) {
      setState({ tokens: 0, busy: false, failed: false });
      return;
    }
    setState((s) => ({ ...s, busy: true }));
    const timer = setTimeout(() => {
      if (!worker.current) {
        worker.current = new Worker(new URL('./token-worker.ts', import.meta.url), { type: 'module' });
        worker.current.onmessage = (e: MessageEvent<{ id: number; tokens?: number; error?: boolean }>) => {
          if (e.data.id !== latest.current) return;
          setState({ tokens: e.data.tokens, busy: false, failed: !!e.data.error });
        };
      }
      worker.current.postMessage({ id, text });
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);
  return state;
}

const EXAMPLE = `顺手是一组装在浏览器里的小工具。压缩图片、合并 PDF、转换视频，都在你自己的电脑上完成，文件不会上传到任何服务器。

It works offline once loaded, and every tool opens in under a second. 打开就能用，不用注册，也没有广告。`;
export default function Page() {
  const [text, setText] = useState('');
  const docxWorker = useRef<Worker | null>(null);
  useEffect(() => () => docxWorker.current?.terminate(), []);
  const { reading, error, read, invalidate } = useOfficeRead();
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<ReturnType<typeof countText>>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), text);
  function files(fs: File[]) {
    docxWorker.current?.terminate();
    void read(async () => {
      const file = fs[0];
      if (!/\.(txt|md|markdown|docx)$/i.test(file.name)) throw new Error('请选择 TXT、Markdown 或 DOCX 文件');
      if (!/\.docx$/i.test(file.name)) return file.text();
      return new Promise<string>((resolve, reject) => {
        const worker = new Worker(new URL('./docx-worker.ts', import.meta.url), { type: 'module' });
        docxWorker.current = worker;
        worker.onmessage = (e) => {
          worker.terminate();
          e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.text);
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error('DOCX 读取失败，请另存后重试'));
        };
        worker.postMessage(file);
      });
    }, setText);
  }
  useIncoming(files);
  const tok = useTokens(text);
  const tokenText = tok.failed ? '—' : tok.busy || tok.tokens === undefined ? '…' : tok.tokens.toLocaleString('en-US');
  const groups = [
    {
      title: '字数',
      rows: [
        ['words', '中英文字数'],
        ['chinese', '中文字'],
        ['english', '英文单词'],
        ['chars', '字符（含空格）'],
        ['compact', '字符（不含空白）']
      ]
    },
    {
      title: '结构',
      rows: [
        ['paragraphs', '段落'],
        ['sentences', '句子'],
        ['seconds', '阅读时间（秒）']
      ]
    },
    { title: 'AI', rows: [['tokens', 'Token']] }
  ] as { title: string; rows: [string, string][] }[];
  const valueOf = (key: string) => (key === 'tokens' ? tokenText : (result?.[key as keyof typeof result] ?? 0).toLocaleString('en-US'));
  const ready = !!result && !busy && !tok.busy && !reading && !error && !workerError;
  return (
    <OfficePage id="office-word-count" sub="粘贴文字，实时统计。">
      <TextLayout
        side={
          <>
            {groups.map((g) => (
              <SideGroup
                key={g.title}
                title={g.title}
                note={
                  g.title === 'AI'
                    ? 'Token 按 GPT-4o 用的 o200k 分词算，是准数；Claude、Gemini 等模型的分词不一样，换过去会有出入，当个参考。'
                    : g.title === '结构'
                      ? '空行分段；阅读时间按每分钟 400 字或 200 词估算。'
                      : undefined
                }
              >
                {g.rows.map(([key, label]) => (
                  <div className="field-row stat-row" key={key}>
                    <span className="field-label">{label}</span>
                    <strong>{valueOf(key)}</strong>
                  </div>
                ))}
              </SideGroup>
            ))}
            <div className="stat-actions">
              <OutputActions
                compact
                name="word-count.txt"
                ready={ready}
                text={groups
                  .flatMap((g) => g.rows)
                  .map(([k, v]) => `${v}：${valueOf(k)}`)
                  .join('\n')}
              />
            </div>
          </>
        }
      >
        <TextBox
          textareaClass="is-prose"
          label="原文"
          example={EXAMPLE}
          value={text}
          onFiles={files}
          accept=".txt,.md,.markdown,.docx"
          onChange={(v) => {
            docxWorker.current?.terminate();
            docxWorker.current = null;
            invalidate();
            setText(v);
          }}
        />
        <div className="tw-status">
          <Status busy={busy || reading} error={error || workerError} ready={!!text} />
          <p className="office-note">DOCX 只取正文和表格，不含页眉页脚和批注。</p>
        </div>
      </TextLayout>
    </OfficePage>
  );
}

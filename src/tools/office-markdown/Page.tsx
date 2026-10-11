import { toast } from '../../components/Toast';
import { useMemo, useState } from 'react';
import {
  OfficePage,
  TextBox,
  TextLayout,
  Panel,
  Status,
  OutputActions,
  useIncoming,
  useOfficeWorker,
  useOfficeRead
} from '../../components/kit/OfficeKit';
import { sanitize } from './sanitize';
import { saveBlob } from '../../lib/files';
const EXAMPLE = `# 周会纪要

**时间**：10 月 14 日 · **记录**：小顺

## 本周完成

- [x] 首页改成“拖入任意文件”
- [x] 新增 HTML 预览
- [ ] 补齐深色模式截图

## 数据

| 指标 | 上周 | 本周 |
| --- | ---: | ---: |
| 日活 | 1,204 | 1,580 |
| 平均处理时长 | 3.2 秒 | 2.1 秒 |

> 所有文件都在浏览器里处理，不上传。

\`\`\`js
const ok = files.every((f) => f.size < 200 * 1024 * 1024);
\`\`\`
`;
export default function Page() {
  const [text, setText] = useState('');
  const { reading, error, read, invalidate } = useOfficeRead();
  const {
    result,
    busy,
    error: workerError
  } = useOfficeWorker<string>(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), text, 250);
  const html = useMemo(() => sanitize(result || ''), [result]);
  function files(fs: File[]) {
    void read(async () => {
      if (!/\.(md|markdown|txt)$/i.test(fs[0].name)) throw new Error('请选择 Markdown 或 TXT 文件');
      return fs[0].text();
    }, setText);
  }
  useIncoming(files);
  async function download() {
    const { exportHtml } = await import('./logic');
    saveBlob(new Blob([exportHtml(html)], { type: 'text/html;charset=utf-8' }), 'document.html');
    toast('已开始下载');
  }
  const ready = !!text && result !== undefined && !busy && !reading && !error && !workerError;
  return (
    <OfficePage id="office-markdown" sub="边写边看，表格、任务清单和代码都支持">
      <TextLayout>
        <div className="tw-pair">
          <TextBox
            label="Markdown"
            example={EXAMPLE}
            value={text}
            onFiles={files}
            accept=".md,.markdown,.txt"
            onChange={(v) => {
              invalidate();
              setText(v);
            }}
          />
          <Panel
            title="预览"
            actions={
              <>
                <OutputActions compact ready={ready} text={html} name="content.html" />
                <button type="button" className="btn btn-sm" disabled={!ready} onClick={download}>
                  导出 HTML
                </button>
              </>
            }
          >
            <article
              className="office-preview"
              dangerouslySetInnerHTML={{ __html: html || '<p class="office-note">输入 Markdown，预览会出现在这里</p>' }}
            />
          </Panel>
        </div>
        <div className="tw-status">
          <Status busy={busy || reading} error={error || workerError} ready={!!text} />
          <p className="office-note">远程图片不加载，内嵌的 data: 图片照常显示。“复制”的是 HTML 代码。</p>
        </div>
      </TextLayout>
    </OfficePage>
  );
}

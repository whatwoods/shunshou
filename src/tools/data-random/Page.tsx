import { useState } from 'react';
import { DataImport, DataPage } from '../../components/kit/DataKit';
import { toast } from '../../components/Toast';
import { copyText, saveBlob } from '../../lib/files';
import { usePersisted } from '../../lib/settings';
import { drawNames, groupNames, integers, parseNames } from './core';
import { CopyIcon, SegField } from '../../components/ui';
const defaults = { mode: 'integer', min: '1', max: '100', count: '1', groups: '2', replacement: false, deduplicate: true };
export default function RandomPage() {
  const [settings, setSettings] = usePersisted('data-random', defaults);
  const [names, setNames] = useState('');
  const [made, setMade] = useState<{ text: string; signature: string } | null>(null);
  const signature = JSON.stringify([settings, names]);
  const result = made?.signature === signature ? made.text : '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('填好范围，或换到名单抽签。');
  function update<K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setMade(null);
    setError('');
    setStatus('设置改了，再点一次生成。');
  }
  function number(value: string) {
    if (!value.trim()) throw new Error('数字不能为空。');
    return Number(value);
  }
  function run() {
    setError('');
    setMade(null);
    try {
      let output: string;
      if (settings.mode === 'integer')
        output = integers(number(settings.min), number(settings.max), number(settings.count), settings.replacement).join('\n');
      else {
        const list = parseNames(names, settings.deduplicate);
        if (settings.mode === 'group')
          output = groupNames(list, number(settings.groups))
            .map((group, i) => `第 ${i + 1} 组（${group.length} 人）\n${group.join('\n')}`)
            .join('\n\n');
        else
          output = drawNames(
            list,
            settings.mode === 'shuffle' ? list.length : number(settings.count),
            settings.mode === 'shuffle' ? false : settings.replacement
          ).join('\n');
      }
      setMade({ text: output, signature });
      setStatus('已生成，再点一次重新随机。');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function readFile(file: File) {
    setBusy(true);
    setError('');
    setMade(null);
    setStatus('正在读取名单…');
    try {
      if (!/\.(txt|md)$/i.test(file.name)) throw new Error('请选择 TXT 或 Markdown 文本，每行一个名字。');
      if (file.size > 1_000_000) throw new Error('名单文件最多 1 MB，请分批导入。');
      const text = await file.text();
      parseNames(text, settings.deduplicate);
      setNames(text);
      setSettings((s) => ({ ...s, mode: 'draw' }));
      setStatus('名单已读取，可以抽签了。');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <DataPage id="data-random" busy={busy} error={error} status={made && !result ? '设置改了，再点一次生成。' : status}>
      <div className="data-controls">
        <SegField
          label="生成方式"
          value={settings.mode}
          disabled={busy}
          onChange={(mode) => update('mode', mode)}
          options={[
            { value: 'integer', label: '随机整数' },
            { value: 'draw', label: '抽签' },
            { value: 'shuffle', label: '打乱' },
            { value: 'group', label: '分组' }
          ]}
        />
        {settings.mode === 'integer' && (
          <>
            <label>
              下限（包含）
              <input type="number" value={settings.min} onChange={(e) => update('min', e.target.value)} />
            </label>
            <label>
              上限（包含）
              <input type="number" value={settings.max} onChange={(e) => update('max', e.target.value)} />
            </label>
          </>
        )}
        {(settings.mode === 'integer' || settings.mode === 'draw') && (
          <>
            <label>
              生成 / 抽取数量
              <input type="number" min="1" max="10000" value={settings.count} onChange={(e) => update('count', e.target.value)} />
            </label>
            <label className="data-check">
              <input type="checkbox" checked={settings.replacement} onChange={(e) => update('replacement', e.target.checked)} />
              允许重复抽取
            </label>
          </>
        )}
        {settings.mode === 'group' && (
          <label>
            分成几组
            <input type="number" min="1" max="10000" value={settings.groups} onChange={(e) => update('groups', e.target.value)} />
          </label>
        )}
        {settings.mode !== 'integer' && (
          <label className="data-check">
            <input type="checkbox" checked={settings.deduplicate} onChange={(e) => update('deduplicate', e.target.checked)} />
            合并相同名字
          </label>
        )}
      </div>
      <DataImport
        onFile={readFile}
        busy={busy}
        accept=".txt,.md"
        sample={{
          label: '用示例名单试试',
          file: () =>
            new File(['陈一鸣\n林晓雨\n王子豪\n赵思琪\n周可欣\n吴昊然\n郑佳怡\n孙浩宇\n李沐阳\n何雨桐\n高子轩\n马晓晨'], '示例名单.txt')
        }}
      >
        <span className="data-note">导入名单后自动切换到抽签</span>
      </DataImport>
      <div className="data-split">
        {settings.mode !== 'integer' && (
          <label>
            名单，每行一个名字
            <textarea
              disabled={busy}
              value={names}
              onChange={(e) => {
                setNames(e.target.value);
                setMade(null);
                setError('');
              }}
              placeholder={'小顺\n小手\n小林'}
            />
          </label>
        )}
        <label>
          生成结果
          <textarea readOnly value={result} placeholder="结果会显示在这里" />
        </label>
      </div>
      <div className="data-actions">
        <button className="btn" disabled={busy} onClick={run}>
          {settings.mode === 'draw' ? '开始抽签' : '开始生成'}
        </button>
        <button
          className="btn-soft"
          disabled={!result || busy}
          onClick={async () => {
            const ok = await copyText(result);
            toast(ok ? '已复制' : '复制失败，请下载结果', ok ? 'done' : 'error');
          }}
        >
          <CopyIcon size={16} />
          复制结果
        </button>
        <button
          className="btn-soft"
          disabled={!result || busy}
          onClick={() => {
            saveBlob(new Blob([result], { type: 'text/plain;charset=utf-8' }), '随机结果.txt');
            toast('已开始下载');
          }}
        >
          下载结果
        </button>
        <button
          className="btn-soft"
          disabled={busy || (!names && !result)}
          onClick={() => {
            setNames('');
            setMade(null);
            setError('');
            setStatus('已清空。');
            toast('已清空');
          }}
        >
          清空
        </button>
      </div>
      <p className="data-note">
        用浏览器安全随机数，无取模偏差。每次最多 1 万项，范围最宽 2³²，名单最多 1 万行；同名不合并时算不同的签。分组人数最多差 1
        人。不保存名单和结果。
      </p>
    </DataPage>
  );
}

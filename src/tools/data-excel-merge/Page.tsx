import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { toolById } from '../../tools';
import { usePersisted } from '../../lib/settings';
import { useFileDrop } from '../../lib/useFileDrop';
import { useMedia, TOUCH } from '../../lib/useMedia';
import { useHandOff } from '../../lib/useHandOff';
import { useShortcuts } from '../../lib/useShortcuts';
import { pickFiles, saveBlob } from '../../lib/files';
import { toast } from '../../components/Toast';
import { ActionBar, KeyHint } from '../../components/ActionBar';
import { DropOverlay, DropZone } from '../../components/DropZone';
import { FileChip, NextSteps } from '../../components/FileMatch';
import { Select } from '../../components/Select';
import { CloseIcon, DownloadIcon, ExampleButton, Field, Led, PlusIcon, Segmented, SwitchRow } from '../../components/ui';
import { Panel, SideGroup, TextLayout } from '../../components/kit/OfficeKit';
import { merge, readTemplate, type SheetOverride, type Template } from './merge';
import { baseName, defaultSheetOptions, type MatchMode, type Options, type SheetOptions, type Source } from './plan';
import { readSource } from './read';
import { sampleFiles } from './build';
import { colName } from './refs';
import { valText } from './values';
import type { Grid } from './xlsx';
import './excel-merge.css';

const TEMPLATE_ACCEPT = '.xlsx,.xlsm,.xltx';
const DATA_ACCEPT = '.xlsx,.xlsm,.xls,.ods,.csv,.tsv';
const PREVIEW_ROWS = 300;

interface Prefs {
  unmatched: 'append' | 'skip';
  conflict: 'first' | 'last';
  skipSame: boolean;
  fillMerged: boolean;
  renumber: boolean;
  highlight: boolean;
}
const PREFS: Prefs = { unmatched: 'append', conflict: 'first', skipSame: true, fillMerged: true, renumber: true, highlight: false };

interface Item {
  file: File;
  source: Source;
}

const isTemplateFile = (f: File) => /\.(xlsx|xlsm|xltx)$/i.test(f.name);

export default function ExcelMerge() {
  const tool = toolById('data-excel-merge')!;
  const touch = useMedia(TOUCH);
  const [prefs, setPrefs] = usePersisted<Prefs>('data-excel-merge', PREFS);
  const [tplFile, setTplFile] = useState<{ file: File; data: Uint8Array } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, SheetOverride>>({});
  const [sheetOpts, setSheetOpts] = useState<Record<string, SheetOptions>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [route, setRoute] = useState<Record<string, string>>({});
  const [columns, setColumns] = useState<Record<string, Record<number, number>>>({});
  const [active, setActive] = useState('');
  const [reading, setReading] = useState(0);

  // 模板：表头行、底部行改了以后重新认一遍
  const opened = useMemo<{ tpl: Template | null; error: string }>(() => {
    if (!tplFile) return { tpl: null, error: '' };
    try {
      const tpl = readTemplate(tplFile.file.name, tplFile.data, overrides);
      return { tpl, error: tpl.sheets.some((s) => s.model) ? '' : '模板里没认出表头：至少要有一行写着列名' };
    } catch (e) {
      return { tpl: null, error: e instanceof Error ? e.message : '模板读不出来' };
    }
  }, [tplFile, overrides]);
  const tpl = opened.tpl;
  const usable = useMemo(() => tpl?.sheets.filter((s) => s.model) ?? [], [tpl]);
  const current = usable.find((s) => s.name === active) ?? usable[0];

  // 每张表的认行方式：没设过的用推荐值
  const fullSheetOpts = useMemo(() => {
    const out: Record<string, SheetOptions> = {};
    for (const s of usable) out[s.name] = sheetOpts[s.name] ?? defaultSheetOptions(s.model!);
    return out;
  }, [usable, sheetOpts]);

  const options: Options = useMemo(() => ({ ...prefs, sheets: fullSheetOpts, route, columns }), [prefs, fullSheetOpts, route, columns]);

  const result = useMemo(() => {
    if (!tpl || !usable.length) return null;
    try {
      return merge(
        tpl,
        items.map((i) => i.source),
        options,
        { highlight: prefs.highlight }
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : '汇总出错了，换个模板试试' };
    }
  }, [tpl, usable, items, options, prefs.highlight]);
  const ok = result && !('error' in result) ? result : null;
  const error = opened.error || (result && 'error' in result ? result.error : '');

  const setTemplate = useCallback(async (file: File) => {
    setOverrides({});
    setSheetOpts({});
    setRoute({});
    setColumns({});
    setActive('');
    setTplFile({ file, data: new Uint8Array(await file.arrayBuffer()) });
  }, []);

  const addData = useCallback(async (files: File[]) => {
    setReading((n) => n + files.length);
    for (const file of files) {
      try {
        const source = await readSource(file);
        setItems((list) => [...list, { file, source }]);
      } catch (e) {
        toast(e instanceof Error ? e.message : `“${file.name}”读不出来`, 'error');
      } finally {
        setReading((n) => n - 1);
      }
    }
  }, []);

  // 一次拖进来好几个、还没有模板：名字带“模板”的当模板，没有就取第一个 .xlsx
  const take = useCallback(
    async (files: File[]) => {
      const sheets = files.filter((f) => /\.(xlsx|xlsm|xltx|xls|ods|csv|tsv)$/i.test(f.name));
      if (!sheets.length) {
        toast('这里只收表格文件：.xlsx .xls .ods .csv', 'error');
        return;
      }
      if (tplFile) return addData(sheets);
      const t = sheets.find((f) => isTemplateFile(f) && /模板|样表|template/i.test(f.name)) ?? sheets.find(isTemplateFile);
      if (!t) {
        toast('先放一个 .xlsx 格式的母模板', 'error');
        return;
      }
      await setTemplate(t);
      const rest = sheets.filter((f) => f !== t);
      if (rest.length) await addData(rest);
    },
    [tplFile, addData, setTemplate]
  );
  const takeRef = useRef(take);
  takeRef.current = take;
  const dragging = useFileDrop((files) => takeRef.current(files));
  useHandOff((files) => takeRef.current(files));

  const outName = tplFile ? `${baseName(tplFile.file.name)}-汇总.${/\.xlsm$/i.test(tplFile.file.name) ? 'xlsm' : 'xlsx'}` : '';
  const blob = useMemo(
    () =>
      ok && items.length
        ? new Blob([ok.bytes as BlobPart], {
            type: /\.xlsm$/i.test(outName)
              ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          })
        : null,
    [ok, items.length, outName]
  );
  const download = () => {
    if (!blob) return false;
    saveBlob(blob, outName);
    toast('已开始下载');
  };
  useShortcuts({ save: download });

  const totals = useMemo(() => {
    const t = { appended: 0, filled: 0, conflicts: 0 };
    for (const f of ok?.plan.files ?? [])
      for (const p of f.parts) {
        t.appended += p.appended;
        t.filled += p.filled;
        t.conflicts += p.conflicts;
      }
    return t;
  }, [ok]);

  const conflicts = ok?.plan.sheets.flatMap((s) => s.conflicts) ?? [];
  const sheetResult = ok?.sheets.find((s) => s.name === current?.name);
  const grid = sheetResult?.grid ?? current?.model?.grid ?? null;

  const so = current ? fullSheetOpts[current.name] : null;
  const setSo = (patch: Partial<SheetOptions>) =>
    current && setSheetOpts((all) => ({ ...all, [current.name]: { ...fullSheetOpts[current.name], ...patch } }));
  const model = current?.model ?? null;
  const hasRows = !!model && model.lastData >= model.dataStart;

  const status = reading
    ? '正在读取…'
    : error
      ? error
      : !tpl
        ? ''
        : !items.length
          ? '再放各人填好的数据'
          : `${items.length} 份数据：新增 ${totals.appended} 行，补充 ${totals.filled} 格` +
            (totals.conflicts ? `，${totals.conflicts} 处不一致` : '');

  const side = tpl && model && so && (
    <>
      {usable.length > 1 && (
        <SideGroup title="工作表" note="数据按列名自动送到最像的那张表；同名的表优先。">
          <Field label="正在看">
            <Select value={current!.name} onChange={(e) => setActive(e.target.value)}>
              {usable.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </SideGroup>
      )}
      <SideGroup
        title="模板结构"
        note={
          <>
            {hasRows ? `已有 ${model.lastData - model.dataStart + 1} 行数据` : '还没有数据'}
            {model.areaEnd > model.lastData ? `，留了 ${model.areaEnd - model.lastData} 行空行（新行先填这些）` : ''}
            {model.footer ? `。新行不够时插在第 ${model.footer} 行上面，合计会跟着算进去。` : '。'}
          </>
        }
      >
        <Field label="表头">
          <Select
            value={String(model.headerRow)}
            onChange={(e) =>
              setOverrides((o) => ({ ...o, [model.name]: { ...o[model.name], headerRow: +e.target.value, footer: undefined } }))
            }
          >
            {rowChoices(model.grid, 1, Math.min(model.grid.maxRow, 30)).map(([r, text]) => (
              <option key={r} value={r}>
                第 {r} 行 · {text}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="底部行">
          <Select
            value={model.footer ? String(model.footer) : ''}
            onChange={(e) =>
              setOverrides((o) => ({ ...o, [model.name]: { ...o[model.name], footer: e.target.value ? +e.target.value : null } }))
            }
          >
            <option value="">没有</option>
            {rowChoices(model.grid, model.dataStart, model.grid.maxRow).map(([r, text]) => (
              <option key={r} value={r}>
                第 {r} 行起 · {text}
              </option>
            ))}
          </Select>
        </Field>
      </SideGroup>

      <SideGroup
        title="怎么认出同一行"
        note={
          so.match === 'key'
            ? '这几列一样就算同一行：补上空着的格子，对不上的追加成新行。'
            : so.match === 'content'
              ? '已有那行填了的格子，新数据都对得上，就算同一行，补上空着的。'
              : '不找对应，每一行都追加到末尾。'
        }
      >
        <Field div block label="对应方式">
          <Segmented<MatchMode>
            label="对应方式"
            value={so.match}
            onChange={(match) => setSo({ match, keys: match === 'key' && !so.keys.length ? defaultSheetOptions(model).keys : so.keys })}
            options={[
              { value: 'key', label: '按关键列' },
              { value: 'content', label: '按已有内容' },
              { value: 'none', label: '全部追加' }
            ]}
          />
        </Field>
        {so.match === 'key' && (
          <div className="xm-keys" role="group" aria-label="关键列">
            {model.columns
              .filter((c) => !model.formulas.has(c.c))
              .map((c) => {
                const on = so.keys.includes(c.c);
                return (
                  <button
                    key={c.c}
                    type="button"
                    className={'xm-key' + (on ? ' is-on' : '')}
                    aria-pressed={on}
                    onClick={() => setSo({ keys: on ? so.keys.filter((k) => k !== c.c) : [...so.keys, c.c].slice(-3) })}
                  >
                    {c.name}
                  </button>
                );
              })}
          </div>
        )}
      </SideGroup>

      <SideGroup title="规则" note="模板里原有的内容一律不改。两份数据给同一格填了不同的值时，按上面选的保留一个，下面会列出来。">
        {so.match !== 'none' && hasRows && (
          <Field div block label="没对上的行">
            <Segmented
              label="没对上的行"
              value={prefs.unmatched}
              onChange={(unmatched) => setPrefs({ ...prefs, unmatched })}
              options={[
                { value: 'append', label: '追加到末尾' },
                { value: 'skip', label: '不要，只补已有行' }
              ]}
            />
          </Field>
        )}
        <Field div block label="同一格不一样">
          <Segmented
            label="同一格不一样"
            value={prefs.conflict}
            onChange={(conflict) => setPrefs({ ...prefs, conflict })}
            options={[
              { value: 'first', label: '保留先放的' },
              { value: 'last', label: '用后放的' }
            ]}
          />
        </Field>
        <SwitchRow checked={prefs.skipSame} onChange={(skipSame) => setPrefs({ ...prefs, skipSame })}>
          跳过完全相同的行
        </SwitchRow>
        <SwitchRow checked={prefs.fillMerged} onChange={(fillMerged) => setPrefs({ ...prefs, fillMerged })}>
          合并单元格的值填满每一行
        </SwitchRow>
        {model.seq !== null && (
          <SwitchRow checked={prefs.renumber} onChange={(renumber) => setPrefs({ ...prefs, renumber })}>
            “{model.columns.find((c) => c.c === model.seq)?.name}”接着往下编
          </SwitchRow>
        )}
      </SideGroup>

      <SideGroup title="标记" note="标色会给新增的行涂浅绿、补上的格子涂浅黄，核对完可以在 Excel 里清掉。">
        <Field label="来源写进">
          <Select
            value={so.sourceCol === null ? '' : String(so.sourceCol)}
            onChange={(e) => setSo({ sourceCol: e.target.value === '' ? null : +e.target.value })}
          >
            <option value="">不写</option>
            {model.columns.map((c) => (
              <option key={c.c} value={c.c}>
                “{c.name}”列
              </option>
            ))}
          </Select>
        </Field>
        <SwitchRow checked={prefs.highlight} onChange={(highlight) => setPrefs({ ...prefs, highlight })}>
          标出新增和补充的内容
        </SwitchRow>
      </SideGroup>
    </>
  );

  return (
    <ToolPage
      tool={tool}
      sub={
        <>
          多人填的表，合回一份模板
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <DropOverlay
        show={dragging}
        title={tplFile ? '松手，加入汇总' : '松手，放入母模板'}
        hint={tplFile ? undefined : '一起拖进来也行：名字带“模板”的当模板'}
      />
      {!tplFile ? (
        <TextLayout>
          <DropZone
            className="in-layout"
            accept={TEMPLATE_ACCEPT + ',' + DATA_ACCEPT}
            title="先放母模板"
            hint={
              touch
                ? '汇总结果保留模板的格式和原有内容。模板和各人的数据可以一起选'
                : '汇总结果保留模板的格式和原有内容。模板和各人的数据也可以一起拖进来'
            }
            button="选择模板"
            onFiles={take}
          >
            <ExampleButton onClick={() => take(sampleFiles())}>用示例试试</ExampleButton>
          </DropZone>
        </TextLayout>
      ) : (
        <TextLayout side={side}>
          {error && (
            <p className="xm-error" role="alert">
              {error}
            </p>
          )}
          <section className="xm-files" aria-label="文件">
            <div className="xm-file is-template">
              <span className="xm-tag">模板</span>
              <FileChip file={tplFile.file} />
              <span className="xm-meta">{usable.length ? usable.map((s) => s.name).join('、') : '没认出表头'}</span>
              <button
                type="button"
                className="btn-soft btn-sm"
                onClick={() => pickFiles(TEMPLATE_ACCEPT, false).then((f) => f[0] && setTemplate(f[0]))}
              >
                换模板
              </button>
            </div>
            {items.map((item) => {
              const report = ok?.plan.files.find((f) => f.id === item.source.id);
              return (
                <div className="xm-file" key={item.source.id}>
                  <span className="xm-tag is-data">数据</span>
                  <FileChip file={item.file} />
                  <span className="xm-meta">
                    {report?.parts.length
                      ? report.parts.map((p) =>
                          p.target ? (
                            <span key={p.sheet}>
                              {usable.length > 1 && `→ ${p.target}：`}
                              {[
                                p.appended && `新增 ${p.appended} 行`,
                                p.filled && `补充 ${p.filled} 格`,
                                p.conflicts && `${p.conflicts} 处不一致`,
                                p.skipped.same && `${p.skipped.same} 行已有`,
                                p.skipped.unmatched && `${p.skipped.unmatched} 行没对上`
                              ]
                                .filter(Boolean)
                                .join(' · ') || '没有新内容'}
                            </span>
                          ) : (
                            <span key={p.sheet} className="xm-warn">
                              “{p.sheet}”的列名和模板对不上
                            </span>
                          )
                        )
                      : '空表'}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`移除 ${item.file.name}`}
                    onClick={() => setItems((list) => list.filter((i) => i !== item))}
                  >
                    <CloseIcon size={16} />
                  </button>
                  {report?.parts.map((p) => {
                    const key = `${item.source.id}/${p.sheet}`;
                    const target = usable.find((s) => s.name === p.target)?.model;
                    return (
                      <details className="xm-map" key={key} open={!p.target || undefined}>
                        <summary>
                          列怎么对应
                          {p.unmapped.length > 0 && <span className="xm-warn">（{p.unmapped.length} 列没用上）</span>}
                        </summary>
                        {usable.length > 1 && (
                          <Field label="送到">
                            <Select value={p.target} onChange={(e) => setRoute((r) => ({ ...r, [key]: e.target.value }))}>
                              <option value="">不用这张表</option>
                              {usable.map((s) => (
                                <option key={s.name} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        )}
                        {target && (
                          <div className="xm-map-rows">
                            {[
                              ...p.mapped.map((m) => ({ index: m.from, name: m.fromName, to: m.to })),
                              ...p.unmapped.map((u) => ({ index: u.index, name: u.name, to: -1 }))
                            ]
                              .sort((a, b) => a.index - b.index)
                              .map((m) => (
                                <label key={m.index} className="xm-map-row">
                                  <span title={m.name}>{m.name}</span>
                                  <span aria-hidden="true">→</span>
                                  <Select
                                    value={String(m.to)}
                                    onChange={(e) => setColumns((all) => ({ ...all, [key]: { ...all[key], [m.index]: +e.target.value } }))}
                                  >
                                    <option value="-1">不用</option>
                                    {target.columns.map((c) => (
                                      <option key={c.c} value={c.c} disabled={target.formulas.has(c.c)}>
                                        {c.name}
                                        {target.formulas.has(c.c) ? '（公式）' : ''}
                                      </option>
                                    ))}
                                  </Select>
                                </label>
                              ))}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              );
            })}
            <button
              type="button"
              className="xm-add"
              onClick={() =>
                pickFiles(DATA_ACCEPT, true).then((f) => {
                  if (f.length) void addData(f);
                })
              }
            >
              <PlusIcon size={18} />
              {items.length ? '继续添加数据' : '添加各人填好的表'}
              <small>{touch ? 'xlsx · xls · ods · csv，可以一次选好几个' : 'xlsx · xls · ods · csv，可以一次选好几个，也可以拖进来'}</small>
            </button>
          </section>

          {grid && current && (
            <Panel
              title={usable.length > 1 ? `预览 · ${current.name}` : '预览'}
              className="xm-preview"
              actions={
                <span className="xm-legend">
                  <i className="is-new" />
                  新增
                  <i className="is-fill" />
                  补充
                </span>
              }
              foot={grid.maxRow > PREVIEW_ROWS ? `只预览前 ${PREVIEW_ROWS} 行，下载的是全部` : undefined}
            >
              <SheetPreview grid={grid} newRows={sheetResult?.newRows} filled={sheetResult?.filled} />
            </Panel>
          )}

          {conflicts.length > 0 && (
            <Panel title={`${conflicts.length} 处不一致`} className="xm-conflicts">
              <table className="xm-table">
                <thead>
                  <tr>
                    <th>位置</th>
                    <th>列</th>
                    <th>保留</th>
                    <th>没用的</th>
                    <th>来自</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.slice(0, 200).map((c, i) => (
                    <tr key={i}>
                      <td>{c.row}</td>
                      <td>{c.column}</td>
                      <td>{c.kept}</td>
                      <td className="xm-other">{c.other}</td>
                      <td>{c.file}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {blob && <NextSteps outputs={[{ blob, name: outName }]} from={tool.id} />}

          <ActionBar status={status} led={reading ? 'work' : error ? 'error' : items.length ? 'done' : 'idle'}>
            <button
              type="button"
              className="btn-soft"
              onClick={() =>
                pickFiles(DATA_ACCEPT, true).then((f) => {
                  if (f.length) void addData(f);
                })
              }
            >
              <PlusIcon size={16} />
              添加数据
            </button>
            <button type="button" className="btn" disabled={!blob} onClick={download}>
              <DownloadIcon size={16} />
              下载汇总表
              <KeyHint keys="save" />
            </button>
          </ActionBar>
        </TextLayout>
      )}
    </ToolPage>
  );
}

// 选表头、底部行时每行显示前几格的内容，好认
function rowChoices(grid: Grid, from: number, to: number): [number, string][] {
  const out: [number, string][] = [];
  for (let r = from; r <= to; r++) {
    const cells = grid.rows.get(r);
    const text = cells
      ? [...cells.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, c]) => (c.f ? '=' + c.f : valText(c.v)))
          .filter(Boolean)
          .slice(0, 3)
          .join(' | ')
      : '';
    out.push([r, text.length > 28 ? text.slice(0, 28) + '…' : text || '（空行）']);
  }
  return out;
}

function SheetPreview({ grid, newRows, filled }: { grid: Grid; newRows?: Set<number>; filled?: Set<string> }) {
  const last = Math.min(grid.maxRow, PREVIEW_ROWS);
  const cols = Math.min(grid.maxCol + 1, 40);
  // 合并单元格：左上角那格跨行跨列，被盖住的不画
  const { span, covered } = useMemo(() => {
    const span = new Map<string, { rows: number; cols: number }>();
    const covered = new Set<string>();
    for (const m of grid.merges) {
      if (m.r1 > last || m.c1 >= cols) continue;
      span.set(`${m.r1}:${m.c1}`, { rows: Math.min(m.r2, last) - m.r1 + 1, cols: Math.min(m.c2, cols - 1) - m.c1 + 1 });
      for (let r = m.r1; r <= Math.min(m.r2, last); r++)
        for (let c = m.c1; c <= Math.min(m.c2, cols - 1); c++) if (r !== m.r1 || c !== m.c1) covered.add(`${r}:${c}`);
    }
    return { span, covered };
  }, [grid, last, cols]);
  const scrollTo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 有新增时，滚到第一行新增附近
    const first = newRows && [...newRows][0];
    const row = first ? scrollTo.current?.querySelector<HTMLElement>(`[data-row="${Math.max(1, first - 3)}"]`) : null;
    if (row && scrollTo.current) scrollTo.current.scrollTop = row.offsetTop - 36;
  }, [newRows]);
  return (
    <div className="xm-sheet" ref={scrollTo}>
      <table>
        <thead>
          <tr>
            <th />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c}>{colName(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: last }, (_, i) => {
            const r = i + 1;
            const cells = grid.rows.get(r);
            return (
              <tr key={r} data-row={r} className={newRows?.has(r) ? 'is-new' : undefined}>
                <th>{r}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const k = `${r}:${c}`;
                  if (covered.has(k)) return null;
                  const cell = cells?.get(c);
                  const sp = span.get(k);
                  const text = cell?.v ? valText(cell.v) : cell?.f ? '=' + cell.f : '';
                  return (
                    <td
                      key={c}
                      rowSpan={sp?.rows}
                      colSpan={sp?.cols}
                      className={
                        (filled?.has(k) ? 'is-fill' : '') +
                        (cell?.f ? ' is-formula' : '') +
                        (cell?.v?.t === 'n' || cell?.v?.t === 'd' ? ' is-num' : '')
                      }
                      title={text.length > 20 ? text : undefined}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

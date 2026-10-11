import { useMemo, useState } from 'react';
import { navigate } from '../router';
import { prefetchProps, type Tool } from '../tools';
import { handOff } from '../lib/store';
import { fmtSize } from '../lib/files';
import { KINDS, asFile, kindOf, matchFiles, type Kind } from '../lib/match';
import { Chevron, Glyph, Led } from './ui';
import { KindIcon } from './ToolIcon';

// 带着文件去某个工具：先交接，再跳转
export function goWithFiles(tool: Tool, files: File[]) {
  handOff(files, tool.path);
  navigate(tool.path);
}

// 一个文件：类型图标（按分类着色）+ 文件名 + 大小。工具页里“已选的文件”也用它
export function FileChip({ file }: { file: File }) {
  const kind = kindOf(file);
  return (
    <span className="file-chip" style={{ color: KINDS[kind].led }} title={file.name}>
      <KindIcon kind={kind} />
      <span>{file.name}</span>
      <small>{fmtSize(file.size)}</small>
    </span>
  );
}

export function FileChips({ files, max = 8 }: { files: File[]; max?: number }) {
  return (
    <div className="file-chips">
      {files.slice(0, max).map((f, i) => (
        <FileChip key={i} file={f} />
      ))}
      {files.length > max && (
        <span className="file-chip">
          <small>还有 {files.length - max} 个</small>
        </span>
      )}
    </div>
  );
}

// 按文件类型推荐工具：先是“合在一起”的推荐，再按类型分组列出，每组先显示 4 个
export function FileMatch({
  files,
  onGo = goWithFiles,
  except
}: {
  files: File[];
  onGo?: (tool: Tool, files: File[]) => void;
  except?: string;
}) {
  const { groups, combo } = useMemo(() => matchFiles(files, except), [files, except]);
  const [open, setOpen] = useState<Kind[]>([]);

  if (!groups.length && !combo) return <p className="match-empty">这类文件暂时没有能处理的工具。</p>;

  return (
    <>
      {combo && (
        <div className="match-combo">
          <Glyph tool={combo.tool} />
          <span className="text">
            <b>
              {combo.title}
              <span className="badge">推荐</span>
            </b>
            <small>{combo.desc}</small>
          </span>
          <button type="button" className="btn" onClick={() => onGo(combo.tool, combo.files)} {...prefetchProps(combo.tool.id)}>
            {combo.button}
          </button>
        </div>
      )}
      <div className="match-groups">
        {groups.map((g) => {
          const folded = g.tools.length > 4 && !open.includes(g.kind);
          return (
            <section key={g.kind} className="match-group" aria-label={g.title}>
              <h3>
                <Led color={g.led} />
                {g.title}
              </h3>
              {(folded ? g.tools.slice(0, 4) : g.tools).map((t) => (
                <button key={t.id} type="button" className="match-tool" onClick={() => onGo(t, g.files)} {...prefetchProps(t.id)}>
                  <Glyph tool={t} />
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                  <Chevron />
                </button>
              ))}
              {folded && (
                <button type="button" className="match-more" onClick={() => setOpen((o) => [...o, g.kind])}>
                  还有 {g.tools.length - 4} 个工具
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

// 处理完以后：“接着用”。把结果直接带到下一个工具
export function NextSteps({ outputs, from }: { outputs: { blob: Blob; name: string }[]; from: string }) {
  const files = useMemo(() => outputs.map((o) => asFile(o.blob, o.name)), [outputs]);
  const picks = useMemo(() => {
    const seen = new Set<string>();
    const list: { tool: Tool; files: File[] }[] = [];
    for (const g of matchFiles(files, from).groups)
      for (const tool of g.tools)
        if (!seen.has(tool.id)) {
          seen.add(tool.id);
          list.push({ tool, files: g.files });
        }
    return list.slice(0, 5);
  }, [files, from]);
  if (!picks.length) return null;
  return (
    <div className="next-steps">
      <span className="next-label">接着用</span>
      {picks.map(({ tool, files }) => (
        <button key={tool.id} type="button" className="next-chip" onClick={() => goWithFiles(tool, files)} {...prefetchProps(tool.id)}>
          <Glyph tool={tool} />
          {tool.name}
        </button>
      ))}
    </div>
  );
}

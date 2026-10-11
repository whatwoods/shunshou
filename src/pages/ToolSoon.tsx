import { Link } from '../router';
import { TOOLS, categoryOf, type Tool } from '../tools';
import { site } from '../site';
import { ToolPage } from '../components/ToolPage';
import { Glyph, Led } from '../components/ui';

// 还没做好的工具：说清楚，并指向已经能用的
export function ToolSoon({ tool }: { tool: Tool }) {
  const ready = TOOLS.filter((t) => t.ready);
  return (
    <ToolPage
      tool={tool}
      sub={
        <>
          {tool.desc}
          <span className="upload-led">
            <Led status="idle" />
            即将上线
          </span>
        </>
      }
    >
      <div className="group" style={{ marginTop: 28, maxWidth: 640, padding: '28px 28px 24px' }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>这个工具还在做。</p>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>
          做好后就在这个地址，同样只在你的浏览器里处理文件。
          {site.repoUrl && (
            <>
              {' '}
              想让它早点上线，可以<a href={site.repoUrl + '/issues'}>告诉我们</a>。
            </>
          )}
        </p>
        <p style={{ margin: '24px 0 10px', fontSize: 13, color: 'var(--ink-2)' }}>现在就能用</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {ready.map((t) => (
            <Link key={t.id} to={t.path} className="tool-card" style={{ background: 'var(--bg-warm)' }}>
              <Glyph tool={t} />
              <span className="text">
                <span className="name">{t.name}</span>
                <span className="desc">{t.desc}</span>
              </span>
              <Led color={categoryOf(t.cat).led} />
            </Link>
          ))}
        </div>
      </div>
    </ToolPage>
  );
}

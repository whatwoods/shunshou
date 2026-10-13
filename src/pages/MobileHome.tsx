import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, navigate } from '../router';
import { CATEGORIES, POPULAR, TOOLS, categoryOf, prefetchProps, searchTools, toolById, type CatId, type Tool } from '../tools';
import { clearRecents, timeAgo, useLocalLists } from '../lib/store';
import { pickFiles } from '../lib/files';
import { usePalette } from '../components/Nav';
import { Glass } from '../components/Glass';
import { Lens, slotOf, useGlide, type GlideLook, type Mode } from '../components/Lens';
import { PhoneBar } from '../components/PhoneBar';
import { DropAnywhere } from '../components/DropAnywhere';
import { toast } from '../components/Toast';
import { Chevron, ClockIcon, FileIcon, Glyph, HomeIcon, Led, SearchIcon, StarIcon } from '../components/ui';
import { CatIcon, KindIcon } from '../components/ToolIcon';

export type MobileTab = 'tools' | 'recent' | 'starred';

// 设计稿 E · 首页 · 手机：大标题、分类方块、最近使用列表，底部是液态玻璃标签栏和搜索按钮

// 混着不同分类的列表（最近、收藏、搜索）照设计稿用分类图标；同一分类里的列表用工具自己的键帽图标区分
function ToolRow({ tool, trailing, desc, mark }: { tool: Tool; trailing?: ReactNode; desc?: boolean; mark?: boolean }) {
  return (
    <Link to={tool.path} className={'m-row' + (desc ? ' has-desc' : '')} {...prefetchProps(tool.id)}>
      {mark ? (
        <Glyph tool={tool} />
      ) : (
        <span className="m-row-icon">
          <CatIcon id={tool.cat} />
        </span>
      )}
      <span className="m-row-main">
        <span className="m-row-text">
          <span className="m-row-name">{tool.name}</span>
          {desc && <span className="m-row-desc">{tool.desc}</span>}
        </span>
        {trailing && <span className="m-row-trail">{trailing}</span>}
        <Chevron />
      </span>
    </Link>
  );
}

// 标签栏：选中的那格垫着一块浅色胶囊，切换时滑过去。按住会浮起一块玻璃透镜，可以在三个标签之间拖着挑，
// 透镜经过哪个标签哪个就亮起来，松手吸过去再跳转（动效见 components/Lens.tsx）
const TAB_LOOK: GlideLook = { grow: [1.12, 1.3], magnify: 0.22 };
const TABS: [MobileTab, string, string, ReactNode][] = [
  ['tools', '/', '工具', <HomeIcon size={24} />],
  ['recent', '/?tab=recent', '最近', <ClockIcon size={24} />],
  ['starred', '/?tab=starred', '收藏', <StarIcon size={24} />]
];

export function TabBar({ tab }: { tab: MobileTab | null }) {
  const palette = usePalette();
  const box = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const [glide, lens] = useGlide(TAB_LOOK);
  const [near, setNear] = useState(-1);
  glide.onNear = setNear;
  const index = TABS.findIndex(([id]) => id === tab);
  const slots = () => [...box.current!.querySelectorAll<HTMLElement>('.m-tab')].map(slotOf);

  useLayoutEffect(() => {
    const el = box.current!;
    glide.box = el;
    glide.thumb = pill.current;
    const put = (mode: Mode) => glide.place(slots()[index] ?? null, mode);
    put('slide');
    const ro = new ResizeObserver(() => put('jump'));
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  return (
    <div className="m-dock">
      <Glass as="span" className="m-tabbar" pressed={false}>
        <nav
          ref={box}
          aria-label="主导航"
          className={near >= 0 ? 'is-dragging' : undefined}
          onPointerDown={(e) => glide.down(e.nativeEvent, slots())}
          onPointerMove={(e) => glide.move(e.nativeEvent)}
          onPointerUp={(e) => {
            // 和点链接一样：点当前标签也跳一次（分类页回到首页、回到顶部）
            const r = glide.release(e.nativeEvent);
            if (r) navigate(TABS[r.index][1], { replace: true });
          }}
          onPointerCancel={(e) => glide.cancel(index, e.pointerId)}
          onLostPointerCapture={(e) => glide.cancel(index, e.pointerId)}
          onClickCapture={(e) => {
            if (e.detail > 0 && glide.justReleased()) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <span ref={pill} className="m-tab-pill" aria-hidden="true" />
          {TABS.map(([id, to, label, icon], i) => (
            <Link
              key={id}
              to={to}
              replace
              draggable={false}
              className={'m-tab' + (near === i ? ' is-near' : '')}
              aria-current={tab === id ? 'page' : undefined}
            >
              {icon}
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </Glass>
      <Lens glide={glide} on={lens} />
      <Glass as="span" className="m-search-btn">
        <button type="button" aria-label="搜索工具" onClick={palette.open}>
          <SearchIcon size={22} />
        </button>
      </Glass>
    </div>
  );
}

export function MobileHome({ tab, cat }: { tab: MobileTab; cat: CatId | null }) {
  const { recents, starred } = useLocalLists();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<File[] | null>(null);
  const readyCount = TOOLS.filter((t) => t.ready).length;
  const q = query.trim();

  const recentTools = recents
    .map((r) => ({ tool: toolById(r.id), at: r.at }))
    .filter((r): r is { tool: Tool; at: number | undefined } => !!r.tool);
  const starredTools = starred.map(toolById).filter((t): t is Tool => !!t);

  let title = '顺手';
  let body: ReactNode;

  if (cat) {
    const c = categoryOf(cat);
    const list = TOOLS.filter((t) => t.cat === cat && t.ready);
    title = c.name;
    body = (
      <>
        <p className="m-sub">
          <Led color={c.led} />
          {list.length} 个工具 · {c.blurb}
        </p>
        <div className="m-list m-first">
          {list.map((t) => (
            <ToolRow key={t.id} tool={t} desc mark />
          ))}
        </div>
      </>
    );
  } else if (tab === 'recent') {
    title = '最近';
    body = recentTools.length ? (
      <>
        <p className="m-sub">只记在这台手机上</p>
        <div className="m-list m-first">
          {recentTools.map(({ tool, at }) => (
            <ToolRow key={tool.id} tool={tool} trailing={timeAgo(at)} />
          ))}
        </div>
        <button
          type="button"
          className="m-plain-btn"
          onClick={() => {
            clearRecents();
            toast('本机使用记录已清空');
          }}
        >
          清空记录
        </button>
      </>
    ) : (
      <Empty icon={<ClockIcon size={28} />} title="还没有用过的工具" text="用过的工具会出现在这里，只记在这台手机上。" />
    );
  } else if (tab === 'starred') {
    title = '收藏';
    body = starredTools.length ? (
      <>
        <p className="m-sub">常用的放在这里，一点就到</p>
        <div className="m-list m-first">
          {starredTools.map((t) => (
            <ToolRow key={t.id} tool={t} desc />
          ))}
        </div>
      </>
    ) : (
      <Empty icon={<StarIcon size={28} />} title="还没有收藏" text="在工具页点标题旁的星星，就会收藏到这里。" />
    );
  } else {
    const found = q ? searchTools(q).filter((t) => t.ready) : [];
    const list = recentTools.length ? recentTools.slice(0, 6) : POPULAR.map((id) => ({ tool: toolById(id)!, at: undefined }));
    body = (
      <>
        <p className="m-sub">
          <Led status="done" />
          {readyCount} 个工具 · 文件只在这台手机上处理
        </p>
        <div className="m-search">
          <SearchIcon size={16} />
          <label htmlFor="m-search" className="sr">
            搜索工具
          </label>
          <input
            id="m-search"
            type="search"
            placeholder="搜索工具"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {q ? (
          found.length ? (
            <div className="m-list m-first">
              {found.map((t) => (
                <ToolRow key={t.id} tool={t} desc />
              ))}
            </div>
          ) : (
            <Empty icon={<SearchIcon size={28} />} title={`没有找到“${q}”`} text="换个说法试试，比如“合并”“转换”“压缩”。" />
          )
        ) : (
          <>
            <button type="button" className="m-open" onClick={() => pickFiles('*/*', true).then((f) => f.length && setPicked(f))}>
              <span className="m-open-icon">
                <FileIcon size={22} />
              </span>
              <span className="m-open-text">
                <b>打开任意文件</b>
                <small>自动认出类型，推荐能用的工具</small>
              </span>
              <span className="m-open-keys" aria-hidden="true">
                {(['pdf', 'image', 'video'] as const).map((k) => (
                  <span key={k}>
                    <KindIcon kind={k} size={16} />
                  </span>
                ))}
              </span>
            </button>
            <h2 className="m-h2">分类</h2>
            <div className="m-cats">
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/?cat=${c.id}`} className="m-cat">
                  <span className="m-cat-icon">
                    <CatIcon id={c.id} />
                  </span>
                  <span className="m-cat-text">
                    <b>{c.name}</b>
                    <small>{TOOLS.filter((t) => t.cat === c.id && t.ready).length} 个</small>
                  </span>
                  <span className="led" style={{ background: c.led, color: c.led }} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <h2 className="m-h2">{recentTools.length ? '最近使用' : '常用'}</h2>
            <div className="m-list">
              {list.map(({ tool, at }) => (
                <ToolRow key={tool.id} tool={tool} trailing={timeAgo(at)} />
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="m-home">
      {cat && <PhoneBar back="工具" to="/" />}
      <header className={'m-head' + (cat ? ' has-bar' : '')}>
        <h1 className="m-title">{title}</h1>
      </header>
      <main className="m-main" key={cat ?? tab}>
        {body}
      </main>
      <div className="m-main">
        <nav className="guide-links" aria-label="站点说明">
          <Link to="/about">关于顺手</Link>
          <Link to="/privacy">隐私说明</Link>
        </nav>
      </div>
      <TabBar tab={cat ? 'tools' : tab} />
      {picked && <DropAnywhere files={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="m-empty">
      <span className="m-empty-icon">{icon}</span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

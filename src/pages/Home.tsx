import { useEffect, useRef, useState } from 'react';
import { Link, useSearch } from '../router';
import { CATEGORIES, TOOLS, prefetchProps, searchTools, toolById, type CatId, type Tool } from '../tools';
import { useLocalLists } from '../lib/store';
import { useMedia, PHONE, TOUCH } from '../lib/useMedia';
import { MOD } from '../lib/useShortcuts';
import { site } from '../site';
import { CatNav, Nav, usePalette } from '../components/Nav';
import { DropOverlay } from '../components/DropZone';
import { DropAnywhere } from '../components/DropAnywhere';
import { HeroDrop } from '../components/HeroDrop';
import { useFileDrop } from '../lib/useFileDrop';
import { DisplayIcon, Glyph, Kbd, SearchIcon, ShieldIcon, StarIcon, WifiIcon } from '../components/ui';
import { MobileHome, type MobileTab } from './MobileHome';

export function Home() {
  const phone = useMedia(PHONE);
  const search = useSearch();
  const c = search.get('cat');
  const cat = CATEGORIES.some((x) => x.id === c) ? (c as CatId) : null;
  const t = search.get('tab');
  const tab: MobileTab = t === 'recent' || t === 'starred' ? t : 'tools';

  useEffect(() => {
    document.title = '顺手 · 顺手的小工具，全在浏览器里';
  }, []);

  // 手机上是设计稿里的 App 式首页；平板和电脑是完整的长页面
  return phone ? <MobileHome tab={tab} cat={cat} /> : <DesktopHome initialCat={cat} />;
}

function ToolCard({ tool, led }: { tool: Tool; led: string }) {
  return (
    <Link to={tool.path} className={'tool-card' + (tool.ready ? '' : ' is-soon')} {...prefetchProps(tool.id)}>
      <Glyph tool={tool} />
      <span className="text">
        <span className="name">
          {tool.name}
          {!tool.ready && <span className="soon">即将上线</span>}
        </span>
        <span className="desc">{tool.desc}</span>
      </span>
      <span className="led" aria-hidden="true" style={tool.ready ? { background: led, color: led } : undefined} />
    </Link>
  );
}

// 分类导航往上滚、快碰到章节导航时，把章节导航往上推走；它离开（滚出工具区）时再把章节导航放下来。
// 位移写在 :root 的 --nav-push 上，.nav-wrap 用它做 translate；完全推走后 .nav-pushed 让它不可见、不可聚焦
const NAV_TOP = 12;
const NAV_H = 52;
function usePushNav(ref: React.RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const max = NAV_TOP + NAV_H + 14;
    // 分类导航顶部从“章节导航下沿再往下 12px”移到吸顶位置的这一段距离里，章节导航正好被推走
    const zone = NAV_H + 12;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      let push: number;
      if (top >= NAV_TOP) push = Math.min(1, Math.max(0, (NAV_TOP + zone - top) / zone)) * max;
      // 已经吸顶的分类导航随工具区一起滚走：章节导航跟着回来
      else push = Math.max(0, max - (NAV_TOP - top));
      root.style.setProperty('--nav-push', `${push}px`);
      root.classList.toggle('nav-pushed', push >= max - 0.5);
      setStuck(top <= NAV_TOP + 0.5 && push >= max - 0.5);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty('--nav-push');
      root.classList.remove('nav-pushed');
    };
  }, [ref]);
  return stuck;
}

function DesktopHome({ initialCat }: { initialCat: CatId | null }) {
  const palette = usePalette();
  const touch = useMedia(TOUCH);
  const { starred } = useLocalLists();
  const [cat, setCat] = useState<CatId | 'all'>(initialCat ?? 'all');
  const [query, setQuery] = useState('');
  // 主页大卡片里的文件；卡片不在视野里时拖进来的文件，用弹层推荐
  const [files, setFiles] = useState<File[] | null>(null);
  const [dropped, setDropped] = useState<File[] | null>(null);
  const [over, setOver] = useState(false);
  const hero = useRef<HTMLDivElement>(null);
  const filter = useRef<HTMLDivElement>(null);
  const stuck = usePushNav(filter);
  const [heroInView, setHeroInView] = useState(true);

  // 地址里的分类变了（面包屑点进来、或者返回到没有分类的首页）才跟着改；页面里点筛选不动地址
  useEffect(() => {
    setCat(initialCat ?? 'all');
  }, [initialCat]);

  useEffect(() => {
    const el = hero.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroInView(e.intersectionRatio > 0.3), { threshold: [0, 0.3, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const receive = (list: File[]) => {
    setOver(false);
    if (heroInView) setFiles(list);
    else setDropped(list);
  };
  const dragging = useFileDrop(receive);

  const q = query.trim();
  const found = new Set(searchTools(q).map((t) => t.id));
  const groups = CATEGORIES.filter((c) => cat === 'all' || c.id === cat)
    .map((c) => ({ ...c, tools: TOOLS.filter((t) => t.cat === c.id && found.has(t.id)) }))
    .filter((c) => c.tools.length > 0);
  const starredTools = starred.map(toolById).filter((t): t is Tool => !!t?.ready);
  const readyCount = TOOLS.filter((t) => t.ready).length;

  return (
    <div>
      <Nav />

      {/* 首屏只放一句话和“拖入任意文件”卡片，常见笔记本屏幕上不用滚动就能看全 */}
      <section className="hero">
        <h1>顺手的小工具，全在浏览器里。</h1>
        <p className="hero-sub">图片、PDF、音视频、表格和代码，打开就用，文件不上传。</p>
        <HeroDrop
          ref={hero}
          files={files}
          over={over || (dragging && heroInView)}
          touch={touch}
          onFiles={setFiles}
          onClear={() => setFiles(null)}
          onOver={setOver}
        />
      </section>

      <main id="tools" className="tools">
        <div className="wrap">
          <h2 className="h2">{readyCount} 个工具，全都不用上传。</h2>

          <form className="search-field tools-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <SearchIcon size={18} />
            <label htmlFor="home-search" className="sr">
              搜索工具
            </label>
            <input
              id="home-search"
              type="search"
              value={query}
              placeholder="搜索工具，比如“压缩”"
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
            {!touch && (
              <button type="button" className="kbd-btn" onClick={palette.open} aria-label="打开快速搜索">
                <Kbd>{MOD}</Kbd>
                <Kbd>K</Kbd>
              </button>
            )}
          </form>

          {/* 分类导航：吸顶以后把上面的章节导航顶走，自己接替成导航（补上品牌、搜索和深浅色） */}
          <div ref={filter} className={'tools-filter' + (stuck ? ' is-stuck' : '')}>
            <CatNav value={cat} onChange={setCat} brand={stuck} />
          </div>

          {q && (
            <p style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 15, color: 'var(--ink-2)' }}>
              “{q}” 的搜索结果 ·{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setQuery('');
                  setCat('all');
                }}
              >
                清除
              </button>
            </p>
          )}

          {cat === 'all' && !q && starredTools.length > 0 && (
            <section className="tool-group" aria-labelledby="cat-starred">
              <div className="tool-group-head">
                <span className="star-mark" aria-hidden="true">
                  <StarIcon size={15} />
                </span>
                <h3 id="cat-starred">收藏</h3>
                <span>只存在这台设备上</span>
              </div>
              <div className="tool-grid">
                {starredTools.map((t) => (
                  <ToolCard key={t.id} tool={t} led={CATEGORIES.find((c) => c.id === t.cat)!.led} />
                ))}
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.id} className="tool-group reveal" aria-labelledby={`cat-${g.id}`}>
              <div className="tool-group-head">
                <span className="led" style={{ background: g.led, boxShadow: `0 0 6px ${g.led}99` }} aria-hidden="true" />
                <h3 id={`cat-${g.id}`}>{g.name}</h3>
                <span>{g.blurb}</span>
              </div>
              <div className="tool-grid">
                {g.tools.map((t) => (
                  <ToolCard key={t.id} tool={t} led={g.led} />
                ))}
              </div>
            </section>
          ))}

          {groups.length === 0 && (
            <div className="empty-card">
              <p style={{ fontSize: 19, fontWeight: 600 }}>没有找到“{q}”</p>
              <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>换个说法试试，或告诉我们你想要什么工具。</p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setQuery('');
                  setCat('all');
                }}
              >
                查看全部工具
              </button>
            </div>
          )}
        </div>
      </main>

      <section id="privacy" className="privacy">
        <div className="wrap">
          <h2 className="h2">
            你的文件，
            <br />
            从不离开你的设备。
          </h2>
          <p className="lede">服务器只负责把网页交给你，之后每一步都在你的浏览器里。</p>
          <div className="pillars reveal">
            <div>
              <DisplayIcon size={30} width={1.6} />
              <h3>在本机处理</h3>
              <p>由浏览器里的 WebAssembly 和 Web Worker 处理。安全策略只许连本站，文件想传也传不出去。</p>
            </div>
            <div>
              <ShieldIcon size={30} width={1.6} />
              <h3>不留痕迹</h3>
              <p>不用账号，没有追踪。最近使用和收藏只存在本机，{MOD} K 里随时清空。</p>
            </div>
            <div>
              <WifiIcon size={30} width={1.6} />
              <h3>断网也能用</h3>
              <p>打开过一次就缓存在本机，常用工具会提前备好。用过的工具，断网照样能用。</p>
            </div>
          </div>
        </div>
      </section>

      <section id="deploy" className="deploy">
        <div className="wrap">
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <h2>
              自己部署，
              <br />
              五分钟的事。
            </h2>
            <p>
              整站都是静态文件，跑在 Cloudflare Workers 上，没有数据库和后端。换别的静态托管也行，但要照着 public/_headers 配好安全响应头。
            </p>
            {site.repoUrl && (
              <p>
                <a href={site.repoUrl + '#readme'}>查看部署说明 ›</a>
              </p>
            )}
          </div>
          <div className="terminal reveal" role="group" aria-label="部署命令">
            <div>
              <b>$</b> git clone {site.repoUrl || '<仓库地址>'} shunshou
            </div>
            <div>
              <b>$</b> cd shunshou &amp;&amp; npm install
            </div>
            <div>
              <b>$</b> npm run deploy
            </div>
          </div>
        </div>
      </section>

      <DropOverlay show={dragging && !heroInView} title="松手，看看能做什么" />
      {dropped && <DropAnywhere files={dropped} onClose={() => setDropped(null)} />}

      <footer className="footer">
        <div className="wrap">
          <span>顺手 · 把小事做顺手</span>
          <nav aria-label="页脚">
            <a href="#privacy">隐私</a>
            <Link to="/licenses">开源许可</Link>
            {site.repoUrl && <a href={site.repoUrl}>源代码</a>}
            {site.repoUrl && <a href={site.repoUrl + '/issues'}>提需求</a>}
          </nav>
        </div>
      </footer>
    </div>
  );
}

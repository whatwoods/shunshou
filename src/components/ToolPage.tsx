import { useEffect, type ReactNode } from 'react';
import { Link, navigate } from '../router';
import { categoryOf, type Tool } from '../tools';
import { pushRecent, toggleStar, useLocalLists } from '../lib/store';
import { useSettingsLocked, useSettingsReset } from '../lib/settings';
import { useMedia, PHONE } from '../lib/useMedia';
import { CatNav, usePalette } from './Nav';
import { PhoneBar } from './PhoneBar';
import { toast } from './Toast';
import { ResetIcon, SearchIcon, StarIcon } from './ui';

export function ToolPage({ tool, sub, actions, children }: { tool: Tool; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const cat = categoryOf(tool.cat);
  const { starred } = useLocalLists();
  const isStarred = starred.includes(tool.id);
  // 这个工具有改过的设置时，标题旁出现“恢复默认”
  const reset = useSettingsReset();
  const locked = useSettingsLocked();
  const phone = useMedia(PHONE);
  const palette = usePalette();

  useEffect(() => {
    document.title = `${tool.name} · 顺手`;
    if (tool.ready) pushRecent(tool.id);
  }, [tool]);

  const star = (
    <button
      type="button"
      className={'icon-btn star-btn' + (isStarred ? ' is-on' : '')}
      aria-pressed={isStarred}
      aria-label={isStarred ? '取消收藏' : '收藏这个工具'}
      title={isStarred ? '取消收藏' : '收藏'}
      onClick={() => toast(toggleStar(tool.id) ? '已收藏，在首页就能找到' : '已取消收藏')}
    >
      <StarIcon size={phone ? 22 : 20} />
    </button>
  );

  // 页面级按钮：桌面放在标题那一行最右边、和标题中线对齐；手机上放到副标题下面
  const head = actions ? <div className="tool-actions">{actions}</div> : null;

  return (
    <div className={'tool-page' + (phone ? ' is-phone' : '')}>
      {phone ? (
        <PhoneBar back={cat.name} to={`/?cat=${cat.id}`}>
          {star}
          <button type="button" className="icon-btn" aria-label="搜索工具" onClick={palette.open}>
            <SearchIcon size={21} />
          </button>
        </PhoneBar>
      ) : (
        // 工具页直接用分类导航：当前工具的分类亮着；悬停或点击分类展开那一类的工具清单，点“全部”回首页
        <div className="nav-wrap">
          <CatNav value={tool.cat} current={tool.id} onChange={() => navigate('/#tools')} />
        </div>
      )}
      <main className="tool-main">
        <div className="tool-head">
          <div className="titles">
            {!phone && (
              <p className="crumb">
                <Link to={`/?cat=${cat.id}#tools`}>{cat.name}</Link> <span aria-hidden="true">›</span>
              </p>
            )}
            <div className="tool-title-row">
              <h1>{tool.name}</h1>
              {!phone && star}
              {reset && (
                <button
                  type="button"
                  className="reset-btn"
                  disabled={locked}
                  title={locked ? '正在处理，完成后再恢复默认' : '把设置恢复成默认'}
                  onClick={() => {
                    reset();
                    toast('已恢复默认设置');
                  }}
                >
                  <ResetIcon size={14} />
                  恢复默认
                </button>
              )}
              {!phone && head}
            </div>
            {sub && <div className="tool-sub">{sub}</div>}
          </div>
          {phone && head}
        </div>
        {children}
      </main>
      <footer className="tool-foot">
        顺手 · 文件只在你的设备上处理 · <Link to="/licenses">开源许可</Link>
      </footer>
    </div>
  );
}

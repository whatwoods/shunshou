import { useEffect, useState, type ReactNode } from 'react';
import { Link, usePrevious } from '../router';
import { CATEGORIES, toolByPath } from '../tools';
import { Glass } from './Glass';
import { BackIcon } from './ui';

// 手机上的顶栏：返回和右侧按钮各是一颗液态玻璃胶囊，浮在内容上（规范 E：导航只用玻璃）。
// 返回按钮退回上一页（goBack），所以按钮上写上一页的名字；没有上一页时退到 to，写 back
function nameOf(from: string): string | null {
  const url = new URL(from, location.origin);
  if (url.pathname === '/') {
    const cat = CATEGORIES.find((c) => c.id === url.searchParams.get('cat'));
    if (cat) return cat.name;
    const tab = url.searchParams.get('tab');
    return tab === 'recent' ? '最近' : tab === 'starred' ? '收藏' : '工具';
  }
  if (url.pathname === '/licenses') return '开源许可';
  return toolByPath(url.pathname)?.name ?? null;
}

// 页面滚起来以后，顶部再垫一层渐隐的底色，胶囊后面的文字不会和按钮打架
export function PhoneBar({ back, to, children }: { back: string; to: string; children?: ReactNode }) {
  const from = usePrevious();
  const label = (from && nameOf(from)) || back;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={'m-bar' + (scrolled ? ' is-scrolled' : '')}>
      <Glass as="span" className="m-bar-pill">
        <Link to={to} back className="m-bar-back">
          <BackIcon size={19} />
          <span className="m-bar-label">{label}</span>
        </Link>
      </Glass>
      {children && (
        <Glass as="span" className="m-bar-pill m-bar-actions">
          {children}
        </Glass>
      )}
    </header>
  );
}

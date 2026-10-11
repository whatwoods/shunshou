import { useSyncExternalStore } from 'react';

// 只存在这台设备上的小偏好：最近用过的工具、收藏、各工具的设置
// 隐私模式或禁用存储时读写都可能失败，失败就当没有

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('shunshou:' + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem('shunshou:' + key, JSON.stringify(value));
  } catch {
    /* 存不了就算了 */
  }
}

// 旧版本曾把一些用户内容当成设置存进本机，启动时清掉这些字段（设置本身保留）。键名末尾的 * 表示前缀匹配
const LEGACY_CONTENT: [string, string[] | null][] = [
  ['data-sql', null],
  ['data-clean-settings', ['find', 'replace']],
  ['image-watermark', ['text']],
  ['office-lines', ['prefix', 'suffix']],
  ['pdf-*', ['name']]
];
export function forgetLegacyContent() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const full = localStorage.key(i);
      if (!full?.startsWith('shunshou:')) continue;
      const key = full.slice(9);
      const rule = LEGACY_CONTENT.find(([k]) => (k.endsWith('*') ? key.startsWith(k.slice(0, -1)) : key === k));
      if (!rule) continue;
      const [, fields] = rule;
      if (!fields) {
        localStorage.removeItem(full);
        continue;
      }
      const value = JSON.parse(localStorage.getItem(full) || '{}');
      if (!value || typeof value !== 'object' || !fields.some((f) => f in value)) continue;
      for (const f of fields) delete value[f];
      localStorage.setItem(full, JSON.stringify(value));
    }
  } catch {
    /* 存储不可用或内容损坏就算了 */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem('shunshou:' + key);
  } catch {
    /* 同上 */
  }
}

// 最近使用和收藏会在好几个地方同时显示（首页、⌘K、工具页的星标），改了要通知大家
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
// 别的标签页改了也跟着变
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === 'shunshou:recent' || e.key === 'shunshou:starred') emit();
  });

const RECENT_MAX = 12;
type Recents = { ids: string[]; at?: Record<string, number> };

export function getRecents(): string[] {
  return load<Recents>('recent', { ids: [] }).ids;
}

// 带上次使用的时间，手机首页的“最近使用”要显示“10 分钟前”
export function getRecentTimes(): { id: string; at?: number }[] {
  const r = load<Recents>('recent', { ids: [] });
  return r.ids.map((id) => ({ id, at: r.at?.[id] }));
}

export function pushRecent(id: string) {
  const r = load<Recents>('recent', { ids: [] });
  const ids = [id, ...r.ids.filter((x) => x !== id)].slice(0, RECENT_MAX);
  const at = Object.fromEntries(ids.map((x) => [x, x === id ? Date.now() : (r.at?.[x] ?? 0)]));
  save('recent', { ids, at });
  emit();
}

export function clearRecents() {
  remove('recent');
  emit();
}

export function getStarred(): string[] {
  return load<{ ids: string[] }>('starred', { ids: [] }).ids;
}

export function toggleStar(id: string): boolean {
  const ids = getStarred();
  const on = !ids.includes(id);
  save('starred', { ids: on ? [...ids, id] : ids.filter((x) => x !== id) });
  emit();
  return on;
}

// 组件里用：最近或收藏变了就重新渲染
export function useLocalLists(): { recents: { id: string; at?: number }[]; starred: string[] } {
  useSyncExternalStore(subscribe, () => version);
  return { recents: getRecentTimes(), starred: getStarred() };
}

// “刚刚”“10 分钟前”“昨天”“周二”“3 月 8 日”
export function timeAgo(at: number | undefined, now = Date.now()): string {
  if (!at) return '';
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const d = new Date(at),
    today = new Date(now);
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return `${Math.floor(min / 60)} 小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return '周' + '日一二三四五六'[d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// 从首页或 ⌘K 选好的文件，交给工具页接着处理。带上目标路径：在别的工具页上发起交接时，
// 当前页也在听事件，不带路径会被它先接走
let pending: { files: File[]; path?: string } | null = null;

export function handOff(files: File[], path?: string) {
  pending = { files, path };
  // 已经在目标工具页上时，页面靠这个事件接住文件
  window.dispatchEvent(new Event('shunshou:handoff'));
}

export function takeHandOff(path = location.pathname): File[] {
  if (!pending || (pending.path && pending.path !== path)) return [];
  const { files } = pending;
  pending = null;
  return files;
}

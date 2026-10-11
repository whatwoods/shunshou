import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { navigate } from '../router';
import { POPULAR, categoryOf, prefetchTool, searchTools, toolById, type Tool } from '../tools';
import { clearRecents, handOff, useLocalLists } from '../lib/store';
import { pickFiles } from '../lib/files';
import { setThemePref, useTheme } from '../lib/theme';
import { toast } from './Toast';
import { Glass } from './Glass';
import { Glyph, Kbd, Led, MoonIcon, PlusIcon, SearchIcon, SunIcon, TrashIcon } from './ui';

interface Action {
  id: string;
  name: string;
  words: string;
  icon: ReactNode;
  run: () => void;
}

type Item = { kind: 'tool'; tool: Tool } | { kind: 'action'; action: Action };

export function CommandPalette({ onClose, closing }: { onClose: () => void; closing?: boolean }) {
  const { pref, theme } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const lists = useLocalLists();
  const recents = lists.recents.map((r) => r.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const optId = (i: number) => `${uid}-opt-${i}`;

  // 打开时锁住页面滚动，关闭时把焦点还回去。
  // 两处 focus 都不许滚页面：锁过滚动之后，Chrome 会把吸顶导航里的按钮当成被 scroll-padding 挡住，把页面往上滚一大截
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    inputRef.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  const q = query.trim().toLowerCase();
  // 没输入时：先是收藏，再是最近用过（没有记录就列常用）
  const starredTools = lists.starred
    .map(toolById)
    .filter((t): t is Tool => !!t?.ready)
    .slice(0, 4);
  const recentTools = recents
    .filter((id) => !lists.starred.includes(id))
    .map(toolById)
    .filter((t): t is Tool => !!t);
  const sections: { label: string; tools: Tool[] }[] = q
    ? [{ label: '工具', tools: searchTools(q).slice(0, 6) }]
    : [
        { label: '收藏', tools: starredTools },
        recentTools.length
          ? { label: '最近用过', tools: recentTools.slice(0, 4) }
          : {
              label: '常用',
              tools: POPULAR.map((id) => toolById(id)!)
                .filter((t) => !lists.starred.includes(t.id))
                .slice(0, 4)
            }
      ].filter((s) => s.tools.length > 0);
  const tools = sections.flatMap((s) => s.tools);

  const allActions: Action[] = [
    {
      id: 'pick-images',
      name: '选择图片，开始压缩',
      words: '图片 照片 压缩 选择 打开 文件 image',
      icon: <PlusIcon />,
      run: () => {
        onClose();
        pickFiles('image/*').then((files) => {
          if (files.length === 0) return;
          handOff(files, '/image/compress');
          navigate('/image/compress');
        });
      }
    },
    {
      id: 'theme',
      name: theme === 'dark' ? '切换到浅色' : '切换到深色',
      words: '深色 浅色 夜间 主题 外观 暗色 dark light theme',
      icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />,
      run: () => {
        onClose();
        setThemePref(theme === 'dark' ? 'light' : 'dark', { x: innerWidth / 2, y: 0 });
      }
    },
    ...(pref !== 'system'
      ? [
          {
            id: 'theme-system',
            name: '外观跟随系统',
            words: '深色 浅色 主题 外观 系统 自动 theme system',
            icon: <SunIcon />,
            run: () => {
              onClose();
              setThemePref('system');
              toast('外观已改为跟随系统');
            }
          }
        ]
      : []),
    ...(recents.length > 0
      ? [
          {
            id: 'clear',
            name: '清空本机使用记录',
            words: '清空 记录 隐私 最近 history',
            icon: <TrashIcon />,
            run: () => {
              clearRecents();
              setActive(0);
              toast('本机使用记录已清空');
            }
          }
        ]
      : [])
  ];
  const actions = allActions.filter((a) => !q || (a.name + a.words).toLowerCase().includes(q)).slice(0, q ? 3 : 2);

  const items: Item[] = [
    ...tools.map((tool) => ({ kind: 'tool' as const, tool })),
    ...actions.map((action) => ({ kind: 'action' as const, action }))
  ];
  const act = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    document.getElementById(optId(act))?.scrollIntoView({ block: 'nearest' });
  });

  // 选中的工具提前下载，回车后马上打开
  const activeItem = items[act];
  useEffect(() => {
    if (activeItem?.kind === 'tool') prefetchTool(activeItem.tool.id);
  }, [activeItem]);

  const run = (item: Item) => {
    if (item.kind === 'action') return item.action.run();
    onClose();
    navigate(item.tool.path);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((act + step + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[act]) run(items[act]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  return (
    <div className={closing ? 'palette-closing' : undefined}>
      <div className="palette-scrim" aria-hidden="true" onClick={onClose} />
      <Glass kind="sheet" role="dialog" aria-modal="true" aria-label="搜索工具" className="palette">
        <div className="palette-head">
          <SearchIcon size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="搜索工具，或输入一个动作"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-autocomplete="list"
            aria-activedescendant={items.length ? optId(act) : undefined}
            aria-label="搜索工具或动作"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <button type="button" className="kbd" style={{ border: 0, cursor: 'pointer' }} onClick={onClose} aria-label="关闭">
            esc
          </button>
        </div>

        <div className="palette-body" id={`${uid}-list`} role="listbox" aria-label="结果">
          {sections.map((sec, si) => {
            const offset = sections.slice(0, si).reduce((n, x) => n + x.tools.length, 0);
            return (
              <div key={sec.label} role="presentation">
                <p className="palette-label" role="presentation" style={si ? { marginTop: 10 } : undefined}>
                  {sec.label}
                </p>
                {sec.tools.map((t, j) => {
                  const i = offset + j;
                  const cat = categoryOf(t.cat);
                  return (
                    <div
                      key={t.id}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === act}
                      className="palette-item"
                      onMouseMove={() => i !== act && setActive(i)}
                      onClick={() => run(items[i])}
                    >
                      <Glyph tool={t} />
                      <span className="text">
                        <span className="name">
                          {t.name}
                          {!t.ready && <span className="soon">即将上线</span>}
                        </span>
                        <span className="desc">{t.desc}</span>
                      </span>
                      <span className="cat">
                        <Led color={cat.led} />
                        {cat.name}
                      </span>
                      <span className="kbd enter" aria-hidden="true">
                        ↵
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {actions.length > 0 && (
            <p className="palette-label" role="presentation" style={{ marginTop: 10 }}>
              动作
            </p>
          )}
          {actions.map((a, j) => {
            const i = tools.length + j;
            return (
              <div
                key={a.id}
                id={optId(i)}
                role="option"
                aria-selected={i === act}
                className="palette-item palette-action"
                onMouseMove={() => i !== act && setActive(i)}
                onClick={() => run(items[i])}
              >
                <span className="act-icon" aria-hidden="true">
                  {a.icon}
                </span>
                <span className="text">{a.name}</span>
                <span className="kbd enter" aria-hidden="true">
                  ↵
                </span>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="palette-empty">
              <p style={{ fontSize: 17, fontWeight: 600 }}>没找到“{query.trim()}”</p>
              <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>换个说法试试，比如“合并”“转换”“压缩”。</p>
            </div>
          )}
        </div>

        <div className="palette-foot">
          <span className="keys">
            <Kbd small>↑</Kbd>
            <Kbd small>↓</Kbd>选择
          </span>
          <span className="keys">
            <Kbd small>↵</Kbd>打开
          </span>
          <span className="spacer" />
          <span>
            <Led status="done" />
            在本机搜索，不联网
          </span>
        </div>
      </Glass>
    </div>
  );
}

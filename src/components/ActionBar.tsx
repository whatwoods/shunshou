import type { ReactNode } from 'react';
import { Glass } from './Glass';
import { Led } from './ui';
import { MOD } from '../lib/useShortcuts';

// 工具页底部的浮动操作栏：放了文件以后才出现，主要按钮都在这里，滚动时一直在手边
export function ActionBar({
  status,
  led = 'idle',
  children
}: {
  status?: ReactNode;
  led?: 'done' | 'work' | 'error' | 'idle';
  children: ReactNode;
}) {
  return (
    <div className="action-dock">
      <Glass kind="sheet" className="action-bar">
        {status && (
          <span className="action-status" role="status">
            <Led status={led} />
            {status}
          </span>
        )}
        {children}
      </Glass>
    </div>
  );
}

// 主按钮里的快捷键提示：触屏设备上不显示
export function KeyHint({ keys }: { keys: 'run' | 'save' }) {
  return (
    <span className="key-hint" aria-hidden="true">
      {MOD === '⌘' ? '⌘' : 'Ctrl '}
      {keys === 'run' ? '↵' : 'S'}
    </span>
  );
}

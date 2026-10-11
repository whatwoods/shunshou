import { expect, test } from 'vitest';
import { TOOLS } from '../tools';
import { TOOL_ICON_IDS } from './ToolIcon';

// 图标按工具 id 查：id 写错的图标永远不会显示，工具也会悄悄退回键帽字
test('每个工具图标都对得上一个工具', () => {
  const ids = new Set(TOOLS.map((t) => t.id));
  expect(TOOL_ICON_IDS.filter((id) => !ids.has(id))).toEqual([]);
});

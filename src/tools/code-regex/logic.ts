export interface Match {
  length: number;
  index: number;
  groups: (string | undefined)[];
  named?: Record<string, string>;
  spans: ([number, number] | undefined)[];
}
export function runRegex(pattern: string, flags: string, text: string, replacement: string) {
  const regex = new RegExp(pattern, flags.includes('d') ? flags : flags + 'd');
  const matches: Match[] = [];
  let match: RegExpExecArray | null;
  let truncated = false;
  let groupsTruncated = false;
  let budget = 100000;
  const preview = (value: string | undefined) => {
    if (value === undefined) return undefined;
    const length = Math.min(value.length, 1000, budget);
    budget -= length;
    if (length < value.length) {
      groupsTruncated = true;
      return value.slice(0, length) + '…';
    }
    return value;
  };
  while ((match = regex.exec(text))) {
    if (matches.length === 10000) {
      truncated = true;
      break;
    }
    // 只把匹配位置及有限捕获预览传回主线程，避免前瞻捕获产生平方级的数据复制。
    const showGroups = matches.length < 100;
    const groups = showGroups ? match.slice(1, 101).map(preview) : [];
    const named =
      showGroups && match.groups
        ? Object.fromEntries(
            Object.entries(match.groups)
              .slice(0, 100)
              .map(([name, value]) => [preview(name)!, preview(value) ?? '未匹配'])
          )
        : undefined;
    if (match.length > 101) groupsTruncated = true;
    matches.push({
      length: match[0].length,
      index: match.index,
      groups,
      named,
      spans: showGroups ? match.indices?.slice(1, 101) || [] : []
    });
    if (!regex.global) break;
    if (match[0] === '') {
      const point = text.codePointAt(regex.lastIndex);
      const unicode = regex.unicode || (regex as RegExp & { unicodeSets?: boolean }).unicodeSets;
      regex.lastIndex += unicode && point !== undefined && point > 0xffff ? 2 : 1;
    }
  }
  const output = text.replace(new RegExp(pattern, flags), replacement);
  return { matches, output, truncated, groupsTruncated };
}

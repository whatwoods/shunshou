interface TextSpan {
  str: string;
  hasEOL?: boolean;
  transform: number[];
  width: number;
}
export function extractPageText(items: object[]): string {
  let output = '',
    previous: TextSpan | undefined;
  for (const candidate of items) {
    if (!('transform' in candidate) || !('str' in candidate) || typeof candidate.str !== 'string') continue;
    const item = candidate as TextSpan;
    if (previous && !output.endsWith('\n')) {
      const size = Math.max(Math.abs(item.transform[3]), Math.abs(previous.transform[3]), 1);
      if (Math.abs(item.transform[5] - previous.transform[5]) > size * 0.6) output += '\n';
      else if (item.transform[4] - previous.transform[4] - previous.width > size * 0.15 && !/\s$/.test(output) && !/^\s/.test(item.str))
        output += ' ';
    }
    output += item.str;
    if (item.hasEOL) output += '\n';
    previous = item;
  }
  return output.trim();
}

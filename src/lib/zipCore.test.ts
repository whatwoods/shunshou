import { expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import { buildZip, uniqueNames } from './zipCore';

test('同名文件加序号，扩展名保留', () => {
  expect(uniqueNames(['a.jpg', 'a.jpg', 'b', 'b', 'a.jpg'])).toEqual(['a.jpg', 'a (2).jpg', 'b', 'b (2)', 'a (3).jpg']);
});

test('流式打包能原样解开，大文件分多块读也不丢字节', async () => {
  const big = new Uint8Array(1024 * 1024 + 7).map((_, i) => (i * 7) % 251);
  const zip = await buildZip([
    { name: '图.png', blob: new Blob([big]) },
    { name: '图.png', blob: new Blob(['你好']) },
    { name: '空.txt', blob: new Blob([]) }
  ]);
  const out = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  expect(Object.keys(out)).toEqual(['图.png', '图 (2).png', '空.txt']);
  // 逐字节比，不用 toEqual（大数组的深比较很慢）
  expect(out['图.png'].length).toBe(big.length);
  expect(out['图.png'].every((b, i) => b === big[i])).toBe(true);
  expect(new TextDecoder().decode(out['图 (2).png'])).toBe('你好');
  expect(out['空.txt'].length).toBe(0);
});

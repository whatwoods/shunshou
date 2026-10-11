import { describe, expect, it } from 'vitest';
import { ALGORITHMS, hashBlob, compareHash } from './logic';
describe('流式哈希', () => {
  it('核对全部算法的标准 abc 向量', async () => {
    const result = await hashBlob(new Blob(['abc']), [...ALGORITHMS]);
    expect(result).toEqual({
      MD5: '900150983cd24fb0d6963f7d28e17f72',
      'SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
      'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      'SHA-512':
        'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
      'SHA3-256': '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
      BLAKE3: '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
      CRC32: '352441c2'
    });
  });
  it('空文件和大小写比较', async () => {
    const result = await hashBlob(new Blob(), ['MD5']);
    expect(result.MD5).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(compareHash(' D41D8CD98F00B204E9800998ECF8427E ', result)).toEqual(['MD5']);
  });
  it('跨块结果与 Node 哈希一致', async () => {
    const { createHash } = await import('node:crypto');
    const text = '中文abc'.repeat(600000);
    let steps = 0;
    const result = await hashBlob(new Blob([text]), ['SHA-256'], () => steps++);
    expect(steps).toBeGreaterThan(2);
    expect(result['SHA-256']).toBe(createHash('sha256').update(text).digest('hex'));
  });
});

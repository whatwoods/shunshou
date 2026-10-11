import { createMD5, createSHA1, createSHA256, createSHA512, createSHA3, createBLAKE3, createCRC32 } from 'hash-wasm';
export const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'SHA3-256', 'BLAKE3', 'CRC32'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];
const factories = {
  MD5: createMD5,
  'SHA-1': createSHA1,
  'SHA-256': createSHA256,
  'SHA-512': createSHA512,
  'SHA3-256': () => createSHA3(256),
  BLAKE3: createBLAKE3,
  CRC32: createCRC32
};
export async function hashBlob(blob: Blob, algorithms: Algorithm[], progress: (fraction: number) => void = () => {}) {
  const hashers = await Promise.all(algorithms.map((name) => factories[name]()));
  // 固定块大小，内存占用不随文件大小增长。
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
    hashers.forEach((hasher) => hasher.update(bytes));
    progress(Math.min(1, (offset + bytes.length) / blob.size));
  }
  progress(1);
  return Object.fromEntries(algorithms.map((name, index) => [name, hashers[index].digest('hex')]));
}
export function compareHash(expected: string, results: Record<string, string>) {
  const normalized = expected.trim().toLowerCase();
  return Object.keys(results).filter((name) => results[name] === normalized);
}

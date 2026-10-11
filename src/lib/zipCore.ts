import { Zip, ZipPassThrough } from 'fflate';

export interface ZipEntry {
  name: string;
  blob: Blob;
}

// 同名文件加 (2)、(3)…，免得解压时互相覆盖
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let n = name;
    for (let i = 2; used.has(n); i++) n = name.replace(/(\.[^.]+)?$/, ` (${i})$1`);
    used.add(n);
    return n;
  });
}

// 流式打包：一次只读一小块输入，产出的块直接拼成 Blob，不在内存里同时放“全部输入 + 整份 ZIP”。
// 压缩过的文件不再二次压缩，只存（ZipPassThrough）
export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const parts: Uint8Array[] = [];
  let fail: unknown;
  const done = new Promise<void>((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      parts.push(chunk);
      if (final) resolve();
    });
    (async () => {
      const names = uniqueNames(entries.map((e) => e.name));
      for (let i = 0; i < entries.length; i++) {
        const file = new ZipPassThrough(names[i]);
        zip.add(file);
        const reader = entries[i].blob.stream().getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          file.push(value);
        }
        file.push(new Uint8Array(0), true);
      }
      zip.end();
    })().catch((e) => {
      fail = e;
      zip.terminate();
      reject(e);
    });
  });
  await done;
  if (fail) throw fail;
  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}

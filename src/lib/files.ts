export function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// 打包下载放在 Worker 里流式进行（见 zipCore.ts）；同一时间只打一个包，重复点击会等上一个结束
let zipping: Promise<void> | null = null;
export function saveZip(entries: { name: string; blob: Blob }[], zipName: string): Promise<void> {
  if (zipping) return zipping;
  zipping = new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL('./zipWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ blob: Blob } | { error: string }>) => {
      worker.terminate();
      if ('blob' in e.data) {
        saveBlob(e.data.blob, zipName);
        resolve();
      } else reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('浏览器没能启动打包'));
    };
    worker.postMessage(entries);
  }).finally(() => {
    zipping = null;
  });
  return zipping;
}

export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve(Array.from(input.files || [])));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'file';
}

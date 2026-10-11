export function encodeBytes(bytes: Uint8Array, urlSafe = false) {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 24576) parts.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 24576))));
  const encoded = parts.join('');
  return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
}
export function decodeBytes(input: string) {
  const data = input
    .trim()
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/\s/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 === 1) throw new Error('Base64 内容不完整或含有非法字符，请检查后重试');
  const raw = atob(data);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export const encodeText = (text: string, urlSafe = false) => encodeBytes(new TextEncoder().encode(text), urlSafe);
export const decodeText = (text: string) => new TextDecoder('utf-8', { fatal: true }).decode(decodeBytes(text));

export async function encodeBlob(blob: Blob, urlSafe = false) {
  const parts: string[] = [];
  // 块大小为 3 的倍数，中间块不会出现 Base64 填充字符。
  const chunkSize = 3 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    parts.push(encodeBytes(new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer())));
  }
  const encoded = parts.join('');
  return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
}

export function dataUrlMime(input: string) {
  return (
    input
      .trim()
      .match(/^data:([^;,]+)(?:;[^,]*)?;base64,/i)?.[1]
      .toLowerCase() || 'application/octet-stream'
  );
}

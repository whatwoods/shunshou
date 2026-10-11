export function parseUrl(text: string) {
  const url = new URL(text);
  return {
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    hash: url.hash,
    params: Array.from(url.searchParams.entries())
  };
}
export function updateUrl(text: string, params: [string, string][], path: string, hash: string) {
  const url = new URL(text);
  url.pathname = path;
  url.hash = hash;
  url.search = '';
  for (const [key, value] of params) url.searchParams.append(key, value);
  return url.href;
}
export function transformUrl(text: string, mode: string, component: boolean) {
  if (mode === 'encode') return component ? encodeURIComponent(text) : encodeURI(text);
  return component ? decodeURIComponent(text) : decodeURI(text);
}

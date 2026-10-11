// PDF.js 6 使用这些较新的内建方法；仅在 PDF Worker 内补齐，不改页面全局。
function define(target: object, name: string, value: unknown) {
  if (!(name in target)) Object.defineProperty(target, name, { value, configurable: true, writable: true });
}
for (const prototype of [Map.prototype, WeakMap.prototype]) {
  define(prototype, 'getOrInsertComputed', function <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V): V {
    if (this.has(key)) return this.get(key)!;
    const value = callback(key);
    this.set(key, value);
    return value;
  });
  define(prototype, 'getOrInsert', function <K, V>(this: Map<K, V>, key: K, value: V): V {
    if (this.has(key)) return this.get(key)!;
    this.set(key, value);
    return value;
  });
}
define(Uint8Array.prototype, 'toHex', function (this: Uint8Array) {
  return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('');
});
define(Uint8Array, 'fromBase64', (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0)));
define(Uint8Array.prototype, 'toBase64', function (this: Uint8Array) {
  let text = '';
  for (let offset = 0; offset < this.length; offset += 8192) text += String.fromCharCode(...this.subarray(offset, offset + 8192));
  return btoa(text);
});
define(Set.prototype, 'intersection', function <T>(this: Set<T>, other: Set<T>) {
  const [smaller, larger] = this.size <= other.size ? [this, other] : [other, this];
  return new Set([...smaller].filter((value) => larger.has(value)));
});
export {};

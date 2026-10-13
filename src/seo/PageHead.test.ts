// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { updatePageHead } from './PageHead';
import { absoluteUrl, pageMetadata } from './metadata';

afterEach(() => {
  document.head.innerHTML = '';
});

it('客户端跳转更新全部元信息，离开 404 时恢复索引且不累积标签', () => {
  for (const path of ['/image/compress', '/pdf/merge', '/missing', '/', '/privacy']) {
    updatePageHead(path);
    const page = pageMetadata(path);
    expect(document.title).toBe(page.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(page.description);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(absoluteUrl(path));
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(absoluteUrl(path));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')?.startsWith('noindex')).toBe(!page.indexable);
    expect(JSON.parse(document.getElementById('page-schema')!.textContent!)).toEqual(page.schema);
  }
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(document.querySelectorAll('#page-schema')).toHaveLength(1);
});

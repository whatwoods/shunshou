import { useEffect } from 'react';
import { absoluteUrl, metaTags, pageMetadata, serializeSchema } from './metadata';

export function updatePageHead(path: string) {
  const page = pageMetadata(path);
  document.title = page.title;
  for (const [attribute, key, value] of metaTags(page)) {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attribute, key);
      document.head.append(tag);
    }
    tag.content = value;
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = absoluteUrl(page.path);
  let schema = document.getElementById('page-schema') as HTMLScriptElement | null;
  if (!schema) {
    schema = document.createElement('script');
    schema.id = 'page-schema';
    schema.type = 'application/ld+json';
    document.head.append(schema);
  }
  schema.textContent = serializeSchema(page.schema);
}

export function PageHead({ path }: { path: string }) {
  useEffect(() => updatePageHead(path), [path]);
  return null;
}

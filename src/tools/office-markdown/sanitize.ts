import createDOMPurify from 'dompurify';
const DOMPurify = createDOMPurify(window);
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'src' && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(data.attrValue)) data.keepAttr = false;
});
export function sanitize(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'video', 'audio', 'source'],
    FORBID_ATTR: ['style', 'srcset', 'autofocus']
  });
}

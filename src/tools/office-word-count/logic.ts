export function countText(text: string) {
  const chinese = (text.match(/\p{Script=Han}/gu) || []).length;
  const english = (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
  const chars = Array.from(text).length;
  const compact = Array.from(text.replace(/\s/gu, '')).length;
  return {
    chinese,
    english,
    words: chinese + english,
    chars,
    compact,
    paragraphs: text.split(/\r?\n\s*\r?\n/).filter((v) => v.trim()).length,
    sentences: text.split(/[。！？.!?]+(?:\s|$)?/u).filter((v) => v.trim()).length,
    seconds: Math.ceil((chinese / 400) * 60 + (english / 200) * 60)
  };
}

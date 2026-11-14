export function splitParagraphs(text = '') {
  return text.trim().split(/\n\s*\n/).filter(Boolean);
}

export function pageSegments(page, layout = 'page') {
  const original = splitParagraphs(page.text);
  const translated = splitParagraphs(page.translation);
  if (layout === 'paragraph' && original.length === translated.length && original.length) {
    return original.flatMap((text, index) => [
      { text, translated: false }, { text: translated[index], translated: true },
    ]);
  }
  return [
    ...original.map(text => ({ text, translated: false })),
    ...translated.map(text => ({ text, translated: true })),
  ];
}

export function escapeXml(value) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function pageHtml(page, layout) {
  return pageSegments(page, layout).map(({text, translated}) =>
    '<p' + (translated ? ' class="translation" lang="vi"' : '') + '>' +
    escapeXml(text).replaceAll('\n', '<br/>') + '</p>').join('\n');
}

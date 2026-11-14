import { zipSync, strToU8 } from 'fflate';

import { escapeXml as xml, pageHtml } from './bilingual.js';

export function makeEpub(project) {
  const pages = project.pages.map((page, index) => ({ ...page, number: index + 1 }))
    .filter(page => page.text.trim() || page.translation?.trim());
  if (!pages.length) throw new Error('Chưa có văn bản để xuất.');
  const title = xml(project.title.trim() || 'Sách của tôi');
  const id = 'urn:uuid:' + crypto.randomUUID();
  const files = { mimetype: [strToU8('application/epub+zip'), { level: 0 }] };
  files['META-INF/container.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const items = [];
  const spine = [];
  const links = [];
  for (const page of pages) {
    const filename = 'page-' + page.number + '.xhtml';
    const itemId = 'page-' + page.number;
    items.push('<item id="' + itemId + '" href="' + filename + '" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="' + itemId + '"/>');
    links.push('<li><a href="' + filename + '">Trang ' + page.number + '</a></li>');
    files['EPUB/' + filename] = strToU8('<?xml version="1.0" encoding="UTF-8"?>' +
      '<html xmlns="http://www.w3.org/1999/xhtml" lang="vi" xml:lang="vi"><head><title>Trang ' + page.number +
      '</title><link rel="stylesheet" href="style.css"/></head><body><h1>Trang ' + page.number +
      '</h1>' + pageHtml(page, project.layout) + '</body></html>');
  }
  files['EPUB/nav.xhtml'] = strToU8('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="vi" xml:lang="vi"><head><title>Mục lục</title></head><body><nav epub:type="toc" id="toc"><h1>' + title + '</h1><ol>' + links.join('') + '</ol></nav></body></html>');
  files['EPUB/style.css'] = strToU8('body{font-family:serif;line-height:1.6;margin:1em}h1{font-size:1.5em}h2{font-size:1.1em}p{overflow-wrap:break-word}.translation{color:#444;font-style:italic}');
  files['EPUB/package.opf'] = strToU8('<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">' + id + '</dc:identifier><dc:title>' + title + '</dc:title><dc:language>vi</dc:language><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') + '</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>' + items.join('') + '</manifest><spine>' + spine.join('') + '</spine></package>');
  return zipSync(files);
}

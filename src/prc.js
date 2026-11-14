import { escapeXml, pageHtml } from './bilingual.js';

const encode = value => new TextEncoder().encode(value);

// Mobipocket record 0 uses absolute offsets measured from the PalmDOC header.
// Reference: https://wiki.mobileread.com/wiki/MOBI
export function makePrc(project) {
  const pages = project.pages.map((page, index) => ({ ...page, number: index + 1 }))
    .filter(page => page.text.trim() || page.translation?.trim());
  if (!pages.length) throw new Error('Chưa có văn bản để xuất.');
  const title = project.title.trim() || 'Sách của tôi';
  const titleBytes = encode(title);
  const content = encode('<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/><title>' +
    escapeXml(title) + '</title></head><body><h1>' + escapeXml(title) + '</h1>' +
    pages.map(page => '<h2>Trang ' + page.number + '</h2>' + pageHtml(page, project.layout)).join('') +
    '</body></html>');

  const textRecords = [];
  for (let start = 0; start < content.length;) {
    let end = Math.min(start + 4096, content.length);
    // Keep UTF-8 characters entirely within their text record.
    while (end < content.length && (content[end] & 0xc0) === 0x80) end -= 1;
    textRecords.push(content.slice(start, end));
    start = end;
  }
  if (textRecords.length > 65530) throw new Error('Sách quá lớn để xuất PRC. Hãy chia thành nhiều phần.');
  const count = textRecords.length;
  const header = new Uint8Array(Math.ceil((248 + titleBytes.length + 2) / 4) * 4);
  const view = new DataView(header.buffer);
  view.setUint16(0, 1); // Uncompressed PalmDOC.
  view.setUint32(4, content.length);
  view.setUint16(8, count);
  view.setUint16(10, 4096);
  header.set(encode('MOBI'), 16);
  view.setUint32(20, 232);
  view.setUint32(24, 2); // Mobipocket book.
  view.setUint32(28, 65001); // UTF-8.
  view.setUint32(32, crypto.getRandomValues(new Uint32Array(1))[0]);
  view.setUint32(36, 6);
  for (let offset = 40; offset <= 76; offset += 4) view.setUint32(offset, 0xffffffff);
  view.setUint32(80, count + 1);
  view.setUint32(84, 248);
  view.setUint32(88, titleBytes.length);
  view.setUint32(92, 1066); // Vietnamese locale.
  view.setUint32(104, 6);
  view.setUint32(108, 0xffffffff); // No images.
  view.setUint32(164, 0xffffffff);
  view.setUint32(168, 0xffffffff); // No DRM.
  view.setUint16(192, 1);
  view.setUint16(194, count);
  view.setUint32(196, 1);
  view.setUint32(200, count + 2); // FCIS.
  view.setUint32(204, 1);
  view.setUint32(208, count + 1); // FLIS.
  view.setUint32(212, 1);
  for (const offset of [224, 232, 236, 244]) view.setUint32(offset, 0xffffffff);
  header.set(titleBytes, 248);

  const flis = new Uint8Array(36);
  const flisView = new DataView(flis.buffer);
  flis.set(encode('FLIS'));
  flisView.setUint32(4, 8);
  flisView.setUint16(8, 65);
  flisView.setUint32(16, 0xffffffff);
  flisView.setUint16(20, 1);
  flisView.setUint16(22, 3);
  flisView.setUint32(24, 3);
  flisView.setUint32(28, 1);
  flisView.setUint32(32, 0xffffffff);

  const fcis = new Uint8Array(44);
  const fcisView = new DataView(fcis.buffer);
  fcis.set(encode('FCIS'));
  fcisView.setUint32(4, 20);
  fcisView.setUint32(8, 16);
  fcisView.setUint32(12, 1);
  fcisView.setUint32(20, content.length);
  fcisView.setUint32(28, 32);
  fcisView.setUint32(32, 8);
  fcisView.setUint16(36, 1);
  fcisView.setUint16(38, 1);

  const records = [header, ...textRecords, flis, fcis, new Uint8Array([233, 142, 13, 10])];
  const directorySize = 78 + records.length * 8 + 2;
  const output = new Uint8Array(directorySize + records.reduce((sum, record) => sum + record.length, 0));
  const pdb = new DataView(output.buffer);
  output.set(encode('Bilingual Book Maker')); // ASCII database name; full Unicode title is in record 0.
  pdb.setUint16(34, 0);
  const palmTime = Math.floor(Date.now() / 1000) + 2082844800;
  pdb.setUint32(36, palmTime);
  pdb.setUint32(40, palmTime);
  output.set(encode('BOOKMOBI'), 60);
  pdb.setUint32(68, records.length + 1);
  pdb.setUint16(76, records.length);
  let offset = directorySize;
  records.forEach((record, index) => {
    pdb.setUint32(78 + index * 8, offset);
    pdb.setUint32(82 + index * 8, index + 1);
    output.set(record, offset);
    offset += record.length;
  });
  return output;
}

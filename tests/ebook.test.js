import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { makeEpub } from '../src/ebook.js';
import { makePrc } from '../src/prc.js';
import { pageSegments } from '../src/bilingual.js';
import { importProject } from '../src/project.js';

const page = { text: 'One\n\nTwo', translation: 'Một\n\nHai' };
const project = { title: 'Sách tiếng Việt', language: 'eng', layout: 'paragraph', pages: [page] };

test('paragraph pairing preserves every segment and falls back when counts differ', () => {
  assert.deepEqual(pageSegments(page, 'paragraph').map(segment => segment.text), ['One', 'Một', 'Two', 'Hai']);
  assert.deepEqual(pageSegments({ ...page, translation: 'Một hai' }, 'paragraph').map(segment => segment.text),
    ['One', 'Two', 'Một hai']);
});

test('EPUB exports interleaved text and escapes user HTML', () => {
  const files = unzipSync(makeEpub({ ...project, title: '<script>&' }));
  assert.equal(strFromU8(files.mimetype), 'application/epub+zip');
  const html = strFromU8(files['EPUB/page-1.xhtml']);
  assert.ok(html.indexOf('Một') < html.indexOf('Two'));
  assert.ok(strFromU8(files['EPUB/package.opf']).includes('&lt;script&gt;&amp;'));
});

test('PRC records preserve Unicode through multiple 4096-byte boundaries', () => {
  const original = 'Tiếng Việt có dấu. '.repeat(1000);
  const bytes = makePrc({ ...project, pages: [{ text: original, translation: '' }] });
  const view = new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.slice(60, 68)), 'BOOKMOBI');
  const record0 = view.getUint32(78);
  assert.equal(view.getUint32(record0 + 28), 65001);
  const count = view.getUint16(record0 + 8);
  assert.ok(count > 1);
  let html = '';
  for (let index = 1; index <= count; index += 1) {
    const start = view.getUint32(78 + index * 8);
    const end = view.getUint32(78 + (index + 1) * 8);
    assert.ok(end - start <= 4096);
    html += new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(start, end));
  }
  assert.ok(html.includes(original.trim()));
});

test('older project backups open with the original page layout', () => {
  const restored = importProject(JSON.stringify({ version: 1, title: 'Old', language: 'eng', pages: [] }));
  assert.equal(restored.layout, 'page');
  assert.throws(() => importProject(JSON.stringify({ version: 1, title: 'Bad', language: 'eng', pages: [], layout: 'unknown' })));
});

test('empty ebook exports are rejected', () => {
  assert.throws(() => makePrc({ ...project, pages: [] }));
  assert.throws(() => makeEpub({ ...project, pages: [] }));
});

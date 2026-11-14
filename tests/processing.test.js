import test from 'node:test';
import assert from 'node:assert/strict';
import { cropRectangle, adjustPixels, prepareImage } from '../src/image-processing.js';
import { importProject } from '../src/project.js';
import { translateWithClaude } from '../src/claude.js';

test('crop uses original dimensions and image processing leaves the source intact by default', async () => {
  assert.deepEqual(cropRectangle(1000, 2000, { top: 5, bottom: 10, right: 20 }),
    { x: 0, y: 100, width: 800, height: 1700 });
  const file = new Blob(['source']);
  assert.equal(await prepareImage(file), file);
  assert.throws(() => cropRectangle(1000, 2000, { top: 60 }));
});

test('inverts dark background and light text', () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  adjustPixels(pixels, { invert: true, contrast: 1.5 });
  assert.deepEqual([...pixels], [255, 255, 255, 255, 0, 0, 0, 255]);
});

test('restores project crop settings', () => {
  const project = importProject(JSON.stringify({
    version: 1, title: 'Book', language: 'eng', pages: [], processing: { bottom: 8, invert: true },
  }));
  assert.equal(project.processing.bottom, 8);
  assert.equal(project.processing.invert, true);
});

test('Claude request sends source text and rejects incomplete output', async t => {
  const options = { text: 'A page.', apiKey: 'test-key', model: 'test-model' };
  let reason = 'end_turn';
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.headers['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(request.headers['x-api-key'], options.apiKey);
    assert.equal(JSON.parse(request.body).messages[0].content, options.text);
    return Response.json({ stop_reason: reason, content: [{ type: 'text', text: 'Một trang.' }] });
  });
  assert.equal(await translateWithClaude(options), 'Một trang.');
  reason = 'max_tokens';
  await assert.rejects(translateWithClaude(options), /chưa hoàn tất/);
});

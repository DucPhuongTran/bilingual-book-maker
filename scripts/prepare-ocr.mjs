import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const resolve = createRequire(import.meta.url).resolve;
const output = new URL('../public/ocr/', import.meta.url);
await mkdir(output, { recursive: true });

const assets = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'worker.min.js.LICENSE.txt': 'tesseract.js/dist/worker.min.js.LICENSE.txt',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core.LICENSE': 'tesseract.js-core/LICENSE',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'vie.traineddata.gz': '@tesseract.js-data/vie/4.0.0_best_int/vie.traineddata.gz',
};

await Promise.all(Object.entries(assets).map(([filename, source]) =>
  copyFile(resolve(source), new URL(filename, output)),
));

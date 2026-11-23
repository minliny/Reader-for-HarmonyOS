import assert from 'node:assert/strict';
import test from 'node:test';
import pngjs from 'pngjs';
import {assertScreenshotHasContent} from '../lib/screenshot-evidence.mjs';

test('native screenshot admission rejects a valid all-black or invisible payload', () => {
  const image = new pngjs.PNG({width:2,height:2});
  image.data.fill(0);
  for (let offset = 3; offset < image.data.length; offset += 4) image.data[offset] = 255;
  assert.throws(() => assertScreenshotHasContent(pngjs.PNG.sync.write(image), 'source-ready'),
    /source-ready has no visible pixel variation/);
  image.data[0] = 255;
  image.data[3] = 0;
  assert.throws(() => assertScreenshotHasContent(pngjs.PNG.sync.write(image), 'source-ready'),
    /source-ready has no visible pixel variation/);
  image.data[3] = 255;
  assert.doesNotThrow(() => assertScreenshotHasContent(pngjs.PNG.sync.write(image), 'source-ready'));
  assert.throws(() => assertScreenshotHasContent(Buffer.from('bad png'), 'source-ready'), /cannot be decoded/);
});

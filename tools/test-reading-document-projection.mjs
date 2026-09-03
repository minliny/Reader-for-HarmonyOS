import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) &&
        !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { materializeReadingDocument } = await import(
  '../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts'
);
const projectionSource = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts', import.meta.url),
  'utf8',
);
assert.match(projectionSource, /advanceUtf16ByScalars/);
assert.doesNotMatch(projectionSource, /function scalarSlice|function scalarCount/,
  'contiguous block validation must scan the chapter only once');

const loads = [];
const runtime = {
  async request() {
    throw new Error('Core request is not used by the projection test');
  },
  async loadReadingImage(sourceId, imageUrl, baseUrl) {
    loads.push({ sourceId, imageUrl, baseUrl });
    return {
      pixelMap: { fixture: 'pixel-map' },
      width: 320,
      height: 180,
      revision: 'image-r1',
    };
  },
};

const textOnly = await materializeReadingDocument(
  { content: 'A😀B' },
  'source-a',
  'https://books.example.test/chapter/1.html',
  runtime,
);
assert.equal(textOnly.content, 'A😀B');
assert.deepEqual(textOnly.images, []);
assert.equal(loads.length, 0, 'text-only chapters must not touch the image Host');

const longUnicodeText = 'A😀'.repeat(2048);
const longUnicode = await materializeReadingDocument(
  {
    content: longUnicodeText,
    blocks: [{ kind: 'text', text: longUnicodeText, startScalar: 0, endScalar: 4096 }],
  },
  'source-a',
  undefined,
  runtime,
);
assert.equal(longUnicode.content, longUnicodeText);

const content = 'A😀\n\n\uFFFC\n\nB';
const projected = await materializeReadingDocument(
  {
    content,
    blocks: [
      { kind: 'text', text: 'A😀\n\n', startScalar: 0, endScalar: 4 },
      { kind: 'image', source: '../media/a.png', startScalar: 4, endScalar: 5 },
      { kind: 'text', text: '\n\nB', startScalar: 5, endScalar: 8 },
    ],
  },
  'source-a',
  'https://books.example.test/chapter/1.html',
  runtime,
);
assert.equal(projected.content, content);
assert.deepEqual(projected.images, [{
  source: '../media/a.png',
  baseUrl: 'https://books.example.test/chapter/1.html',
  startScalar: 4,
  endScalar: 5,
  state: 'pending',
  pixelMap: undefined,
  fileUri: '',
  intrinsicWidth: 0,
  intrinsicHeight: 0,
  revision: 'pending',
}]);
assert.deepEqual(loads, [], 'chapter materialization must not eagerly fetch body images');
assert.match(projected.contentVersion, /^reader-document-v1:/,
  'image anchors and sources must participate in pagination identity');

const canonicalBase = await materializeReadingDocument(
  {
    content: '\uFFFC',
    blocks: [{ kind: 'image', source: 'same.png', startScalar: 0, endScalar: 1 }],
  },
  'source-a',
  ' https://books.example.test/chapter/1.html#reader-position ',
  runtime,
);
assert.equal(canonicalBase.images[0].baseUrl, 'https://books.example.test/chapter/1.html',
  'live and cached image identities must ignore non-request URL fragments');

const duplicate = await materializeReadingDocument(
  {
    content: '\uFFFC\n\n\uFFFC',
    blocks: [
      { kind: 'image', source: 'same.png', startScalar: 0, endScalar: 1 },
      { kind: 'text', text: '\n\n', startScalar: 1, endScalar: 3 },
      { kind: 'image', source: 'same.png', startScalar: 3, endScalar: 4 },
    ],
  },
  'source-a',
  'https://books.example.test/chapter/2.html',
  runtime,
);
assert.equal(duplicate.images.length, 2);
assert.equal(loads.length, 0, 'even repeated sources stay pending until pagination reaches them');

await assert.rejects(
  materializeReadingDocument(
    {
      content: '\uFFFC',
      blocks: [{ kind: 'image', source: 'bad.png', startScalar: 1, endScalar: 2 }],
    },
    'source-a',
    undefined,
    runtime,
  ),
  /contiguous canonical scalar projection/,
  'Core block gaps must fail closed before Host image loading',
);

await assert.rejects(
  materializeReadingDocument(
    {
      content: '\uFFFC',
      blocks: undefined,
    },
    'source-a',
    undefined,
    runtime,
  ),
  /missing Core block metadata/,
  'a canonical image scalar without Core metadata must still fail closed',
);

console.log('reading document projection: PASS');

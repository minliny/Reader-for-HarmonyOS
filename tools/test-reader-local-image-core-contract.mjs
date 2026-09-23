import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { hasImmutableLocalReadingImageSource, hasKnownReadingImageGeometry } from '../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';

registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (error) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw error;
} } });
const { readPreparedReadingEntrySnapshot } = await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const fixture = JSON.parse(readFileSync(new URL('fixtures/reader-local-image-core-first-frame.json', import.meta.url)));
let ioCalls = 0;
const util = { TextDecoder: { create: (_encoding, options) => ({
  decodeToString: bytes => new TextDecoder('utf-8', options).decode(bytes),
}) }, Base64Helper: class { decodeSync(token) { return Buffer.from(token, 'base64url'); } },
Type: { BASIC_URL_SAFE: 1 } };
// Execute the existing adapter and its decoded identity/path checks. Node's
// codec supplies only the platform boundary; no second production parser.
const Adapter = productionMotionMethods(new URL('../entry/src/main/ets/app/LocalEpubResourceHost.ts', import.meta.url),
  ['load', 'assertCurrent', 'parseLocator', 'assertSafeArchivePath'], { util,
    LOCAL_EPUB_SCHEME: 'reader-local-epub://', LOCAL_MOBI_SCHEME: 'reader-local-mobi://',
    MAX_LOCAL_IMAGE_BOOK_ID_BASE64_CHARS: 96,
    MAX_LOCAL_IMAGE_PATH_BASE64_CHARS: 8192,
    MAX_LOCAL_IMAGE_LOCATOR_CHARS: 'reader-local-epub://'.length + 96 + 1 + 8192,
    ReadingBodyImageHost: { instance: { loadResource: async () => { ioCalls++; return {}; } } },
  });
const adapter = new Adapter();
for (const { chapter, variant, dto } of fixture.cases) {
  let reads = 0;
  const runtime = { supportsCoreCapability: () => true, captureReadingContentValidity: () => () => true,
    readPreparedEntry: () => { reads++; return dto; }, request: () => assert.fail('synchronous projection cannot enqueue work') };
  const result = readPreparedReadingEntrySnapshot(runtime, dto.sourceId, dto.bookId, dto.chapterIndex, () => true, 'blankLineSeparated');
  assert.ok(result, `${chapter}/${variant}: actual Core DTO must reach the page assembler`);
  assert.equal(reads, 1); assert.equal(result.chapter.content, dto.content);
  assert.equal(result.chapter.bodyVersion, dto.positionScope.bodyVersion);
  assert.equal(result.chapter.processingVersion, dto.positionScope.processingVersion);
  assert.deepEqual(result.chapter.images.map(i => [i.startScalar, i.endScalar]), [[110,111],[407,408],[704,705]]);
  for (const image of result.chapter.images) {
    assert.equal(image.state, 'pending', 'the DTO admits geometry/anchors, never claims pixels');
    assert.equal(hasKnownReadingImageGeometry(image), variant !== 'legacy');
    assert.equal(hasImmutableLocalReadingImageSource(image.source), true);
    assert.equal(adapter.parseLocator(image.source).hash, dto.bookId.slice(6));
  }
  const legacy = fixture.cases.find(c => c.chapter === chapter && c.variant === 'legacy').dto;
  assert.equal(dto.content, legacy.content);
  // Fresh import has geometry attributes in its original raw body. Only the
  // legacy -> repaired overlay must preserve that original body's scope.
  if (variant === 'repaired') assert.deepEqual(dto.positionScope, legacy.positionScope);
}
assert.equal(ioCalls, 0, 'materializing every DTO must not acquire images');

const hash = '0123456789abcdef'.repeat(4), book = `local:${hash}`;
const encode = (text, padded = true) => {
  const value = Buffer.from(text).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
  return padded ? value : value.replace(/=+$/, '');
};
const source = (identity, path, paddedBook = true, paddedPath = true, scheme = 'epub') =>
  `reader-local-${scheme}://${encode(identity, paddedBook)}/${encode(path, paddedPath)}`;
for (const scheme of ['epub', 'mobi']) for (const paddedBook of [true, false])
  for (const paddedPath of [true, false]) for (const path of ['OPS/a.png', 'OPS/ab.png', 'OPS/abc.png']) {
    const value = source(book, path, paddedBook, paddedPath, scheme);
    assert.equal(hasImmutableLocalReadingImageSource(value), true, value);
    assert.deepEqual(adapter.parseLocator(value), { hash, archivePath: path });
  }
const valid = source(book, 'OPS/ab.png');
for (const value of [valid + '/extra', valid + '?q=1', valid + '#x', valid.replace('://', ':/'),
  valid.replace('epub', 'other'), valid.replace(/\/[^/]+$/, '/'), valid.replace(/\/[^/]+$/, '/===='),
  valid.replace(/\/[^/]+$/, '/ab=c'), valid.replace(/\/[^/]+$/, '/abc+'), valid.replace(/\/[^/]+$/, '/abc===')])
  assert.equal(hasImmutableLocalReadingImageSource(value), false, value);

// The cheap source shape is not a full decoder. The existing I/O adapter must
// still reject decoded invalid identity/path even when that shape passes.
for (const identity of ['local:' + 'z'.repeat(64), 'local:' + 'A'.repeat(64), 'remote:' + hash, 'local:' + hash.slice(1)])
  await assert.rejects(adapter.load(source(identity, 'OPS/a.png')), /invalid book identity/);
for (const path of ['', '/', '/OPS/a.png', 'OPS/../a.png', './a.png', 'OPS//a.png', 'OPS\\a.png', 'OPS/a\0.png', 'x'.repeat(2049)])
  await assert.rejects(adapter.load(source(book, path)), /malformed|unsafe archive path|escapes its archive root/);
assert.equal(ioCalls, 0, 'invalid decoded book/path must stop before resource acquisition');
await adapter.load(valid); assert.equal(ioCalls, 1);
console.log('PASS actual Core firstFrame DTOs (3 fresh, 3 legacy, 3 repaired), padded/unpadded locator segments, unchanged canonical scopes, and production decoded identity/path I/O guards');

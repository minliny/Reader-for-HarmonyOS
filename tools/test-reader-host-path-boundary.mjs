import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(
  'entry/src/main/ets/app/ReaderHostRegistry.ts',
  'utf8',
);

function extract(signature) {
  const start = source.indexOf(`  private ${signature}`);
  assert.ok(start >= 0, signature);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

const methods = [
  extract('localBookStageDirectory()'),
  extract('localBookAssetDirectory()'),
  extract('nextStagePath()'),
  extract('requireLocalBookHash(bookId: string)'),
  extract('requireLocalBookStagePath(input: LocalBookInput, hash: string)'),
  extract('requireLocalBookAssetPath(commit: LocalBookAssetCommit)'),
].join('').replaceAll('ReaderHostRegistry', 'Harness');
const Harness = new Function(
  `${stripTypeScriptTypes(`class Harness {
    static stageSequences = new Map();
    constructor() {
      this.context = { filesDir: '/data/files' };
    }
    ${methods}
  }`)}; return Harness;`,
)();

const harness = new Harness();
const secondHarness = new Harness();
assert.notEqual(harness.nextStagePath(), secondHarness.nextStagePath(),
  'recreated Host instances must not allocate the same staging path');
const hash = 'a'.repeat(64);
const otherHash = 'b'.repeat(64);
const stagedPath = `/data/files/reader-import/staging/1720000000000-1-${hash}.source`;
const input = {
  fileName: 'book.epub',
  bookId: `local:${hash}`,
  stagedPath,
  assetKind: 'source',
};

assert.equal(harness.requireLocalBookStagePath(input, hash), stagedPath);
assert.throws(
  () => harness.requireLocalBookStagePath({ ...input, stagedPath: `/tmp/${hash}.source` }, hash),
  /outside the app staging directory/,
);
assert.throws(
  () => harness.requireLocalBookStagePath({ ...input, stagedPath: stagedPath.replace(hash, otherHash) }, hash),
  /does not match its content identity/,
);
assert.throws(
  () => harness.requireLocalBookStagePath({ ...input, stagedPath: `${stagedPath}/../../books/${hash}.source` }, hash),
  /does not match its content identity/,
);
assert.throws(
  () => harness.requireLocalBookStagePath({ ...input, stagedPath: `/data/files/reader-import/staging/1-1.book` }, hash),
  /does not match its content identity/,
);

const sourceAsset = `/data/files/reader-import/books/${hash}.source`;
assert.equal(harness.requireLocalBookAssetPath({
  bookId: `local:${hash}`,
  assetKind: 'source',
  path: sourceAsset,
  created: true,
}), sourceAsset);
const legacyEpubAsset = `/data/files/reader-import/books/${hash}.epub`;
assert.equal(harness.requireLocalBookAssetPath({
  bookId: `local:${hash}`,
  assetKind: 'epub',
  path: legacyEpubAsset,
  created: true,
}), legacyEpubAsset);
assert.throws(
  () => harness.requireLocalBookAssetPath({
    bookId: `local:${hash}`,
    assetKind: 'source',
    path: `/data/files/reader-import/books/${otherHash}.source`,
    created: true,
  }),
  /does not match its content identity/,
);
assert.throws(
  () => harness.requireLocalBookAssetPath({
    bookId: `local:${hash}`,
    assetKind: 'source',
    path: '/data/files/reader-import/books/../../unrelated',
    created: true,
  }),
  /does not match its content identity/,
);
assert.throws(
  () => harness.requireLocalBookAssetPath({
    bookId: `local:${hash}`,
    assetKind: 'none',
    path: '',
    created: true,
  }),
  /no retained asset/,
);

console.log('Reader Host staging/asset path boundary: PASS');

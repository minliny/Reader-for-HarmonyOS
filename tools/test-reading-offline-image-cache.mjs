import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = readFileSync(resolve(repo,
  'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
const owner = readFileSync(resolve(repo,
  'entry/src/main/ets/app/ReaderRuntimeOwner.ts'), 'utf8');

assert.match(cache, /const MAX_READING_IMAGE_BYTES = 16 \* 1024 \* 1024/);
assert.match(cache, /reader-offline\/images-v1/);
assert.match(cache, /return this\.sha256\(`\$\{sourceId\}\\u0000\$\{bookId\}`\)/,
  'book paths must use opaque hashes rather than source URLs or credentials');
assert.match(cache, /new fileIo\.AtomicFile\(path\)/);
assert.match(cache, /manifest cannot reference missing bytes/);
assert.match(cache, /writeAtomicText\(`\$\{directory\}\/manifest\.json`/);
assert.match(cache, /pruneUnreferencedResources/);
assert.doesNotMatch(cache, /bodyBase64|PixelMap/,
  'persistent offline image storage must contain bounded bytes, not protocol Base64 or native handles');

const diskLookup = owner.indexOf('this.readingImageDiskCache.loadResource(identity)');
const offlineFailure = owner.indexOf("if (!allowNetwork) {");
const networkDescriptor = owner.indexOf('this.resolveReadingImageRequest(sourceId, imageUrl, identity.baseUrl');
assert.ok(diskLookup >= 0 && offlineFailure > diskLookup && networkDescriptor > offlineFailure,
  'offline image resolution must try exact disk bytes and reject before source/HTTP request construction');
assert.match(owner, /storeResource\(identity, bytes\)[\s\S]*ordinary online read remains usable/);
assert.match(owner, /async prefetchReadingImage\([\s\S]*await this\.readingImageDiskCache\.storeResource\(identity, bytes\)/);
assert.match(cache, /canonicalReadingImageBaseUrl\(identity\.baseUrl\)/,
  'offline disk keys must use the same fragment-free canonical base URL as live requests');

console.log('reading offline image cache architecture: PASS');

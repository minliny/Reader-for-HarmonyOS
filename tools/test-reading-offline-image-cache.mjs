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
assert.match(cache, /const MIN_READING_IMAGE_FREE_RESERVE_BYTES = 16 \* 1024 \* 1024/);
assert.match(cache, /import statfs from '@ohos\.file\.statvfs'/);
assert.match(cache, /interface ReadingImageFreeSpaceProbe/);
assert.match(cache, /freeSpaceProbe: ReadingImageFreeSpaceProbe = new HarmonyReadingImageFreeSpaceProbe\(\)/);
assert.match(cache, /assertReadingOfflineWriteCapacity\([\s\S]*MIN_READING_IMAGE_FREE_RESERVE_BYTES/);
assert.match(cache, /FILE_SYSTEM_NO_SPACE_ERROR = 13900025/);
assert.match(cache, /ReadingOfflineMaterializationError\([\s\S]*'storage_full'/);
assert.match(cache, /reader-offline\/images-v1/);
assert.match(cache, /return this\.sha256\(`\$\{sourceId\}\\u0000\$\{bookId\}`\)/,
  'book paths must use opaque hashes rather than source URLs or credentials');
assert.match(cache, /new fileIo\.AtomicFile\(path\)/);
assert.match(cache, /manifest cannot reference missing bytes/);
assert.match(cache, /writeAtomicBytes\(`\$\{directory\}\/manifest\.json`, manifestBytes\)/);
assert.match(
  cache,
  /performAtomicWrite[\s\S]*await fileIo\.open\([\s\S]*await fileIo\.write\([\s\S]*await fileIo\.fsync[\s\S]*await fileIo\.rename\(tmpPath, path\)[\s\S]*await fileIo\.unlink\(tmpPath\)/,
  'offline image writes must be asynchronous, durable, atomic, and clean partial temp files',
);
assert.match(cache, /inFlightWrites[\s\S]*writeLaneA[\s\S]*writeLaneB/,
  'ordinary background image persistence must be same-key coalesced and bounded to two lanes');
assert.doesNotMatch(cache, /writeSync|openSync|renameSync/);
assert.match(cache, /pruneUnreferencedResources/);
assert.doesNotMatch(cache, /bodyBase64|PixelMap/,
  'persistent offline image storage must contain bounded bytes, not protocol Base64 or native handles');

const diskLookup = owner.indexOf('this.readingImageDiskCache.loadResource(identity)');
const offlineFailure = owner.indexOf("if (!allowNetwork) {");
const networkDescriptor = owner.indexOf('this.resolveReadingImageRequest(sourceId, imageUrl, identity.baseUrl');
assert.ok(diskLookup >= 0 && offlineFailure > diskLookup && networkDescriptor > offlineFailure,
  'offline image resolution must try exact disk bytes and reject before source/HTTP request construction');
assert.match(owner,
  /void this\.readingImageDiskCache\.storeResource\(identity, bytes\)[\s\S]*\.catch\([\s\S]*return this\.admitReadingImage\(payload, isCurrent\)/,
  'ordinary online reads must publish decoded pixels without awaiting the persistent cache write');
assert.match(owner, /async prefetchReadingImage\([\s\S]*await this\.readingImageDiskCache\.storeResource\(identity, bytes\)/);
assert.match(cache, /canonicalReadingImageBaseUrl\(identity\.baseUrl\)/,
  'offline disk keys must use the same fragment-free canonical base URL as live requests');

console.log('reading offline image cache architecture: PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');
const gateway = read('entry/src/main/ets/features/reading/ReadingRecordGateway.ts');
const reader = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const host = read('entry/src/main/ets/features/reading/ReaderReadingRecordHost.ts');

// Host Preferences owns installation identity and one bounded pending journal.
// Core owns the atomic statistics/watermark transaction and exact receipt.
assert.match(gateway, /READING_RECORD_DEVICE_ID_KEY = 'device-id'/);
assert.match(gateway, /util\.generateRandomUUID\(\)/);
assert.match(gateway, /request\('read-record\.accumulate', \{/);
assert.match(gateway, /operationId: journal\.operationId, sequence: journal\.sequence, deviceId: journal\.deviceId,/);
assert.match(gateway, /bookName: journal\.bookName, elapsedMillis: journal\.elapsedMillis, readAt: journal\.readAt,/);
assert.doesNotMatch(gateway, /request\('read-record\.(create|update)'/);
assert.match(gateway, /record\.readTime < receipt\.elapsedMillis \|\| record\.lastRead !== receipt\.readAt/);
assert.match(gateway, /receipt\.operationId !== journal\.operationId/);

// Time starts only after a real measured page is committed. Foreground,
// periodic and exit boundaries capture deltas. Runtime-owned durable staging
// and Core reconciliation never become a route dependency.
assert.match(reader, /this\.phase = 'ready';\s*this\.beginReadingRecordClock\(lifecycleToken\);/);
assert.match(host, /}, 30000\)/);
assert.match(reader, /readingRecordHost: ReaderReadingRecordHost = new ReaderReadingRecordHost\(/);
assert.match(host, /this\.driver\.handoff\(intent\);\s*this\.pendingMillis = 0/);
assert.doesNotMatch(host, /restored = .*elapsed/);
assert.match(reader, /if \(!this\.appForeground\) \{[\s\S]*?this\.captureReadingRecordElapsed\(false\);\s*this\.clearReadingRecordTimer\(\);\s*void this\.flushReadingRecord\(\)\.catch/);
const beginExit = reader.match(/private beginExit\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
const exitCaptureSteps = ['this.exitRequested = true;', 'this.stopReaderTtsAudition();',
  'this.captureReadingRecordElapsed(false);'].map(step => beginExit.indexOf(step));
assert.ok(exitCaptureSteps.every((offset, index) => offset >= 0 &&
  (index === 0 || offset > exitCaptureSteps[index - 1])),
  'guarded exit stops audition before capturing the final reading interval');
assert.doesNotMatch(beginExit.slice(exitCaptureSteps[0], exitCaptureSteps[2]), /\b(?:await|return)\b|this\.finishExit\(/,
  'synchronous ownership updates may intervene; early return or asynchronous exit may not skip interval capture');
const finishExit = reader.match(/private async finishExit\(lifecycleToken: number\): Promise<void> \{[\s\S]*?\n  \}/)?.[0] ?? '';
assert.match(finishExit, /this\.(?:readingRecordHost\.handoff|flushReadingRecordForExit)\(\)/);
assert.doesNotMatch(finishExit, /showReaderAlert|showAlertDialog/);
assert.match(host, /flush\(\): Promise<void> \{ this\.handoff\(\); return Promise\.resolve\(\); \}/);
assert.match(host, /flushForExit\(\): Promise<void> \{ return this\.flush\(\); \}/);
assert.match(reader, /ReaderRuntimeOwner\.current\(\)\.getReadingRecordGateway\(\)/);
assert.match(gateway, /READING_RECORD_OUTBOX_LIMIT = 128/);
assert.match(reader, /this\.exitDelivered = true;[\s\S]*?try \{[\s\S]*?this\.retainConfirmedEntryPresentation\(\);[\s\S]*?catch \(error\) \{[\s\S]*?\}\s*this\.onExit\(\);/);

const disappear = reader.match(/aboutToDisappear\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
assert.match(disappear, /this\.readingRecordHost\.retire\(\)/);
assert.doesNotMatch(disappear, /flushReadingRecord\(/);

console.log('reading record accumulation contract: PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');
const gateway = read('entry/src/main/ets/features/reading/ReadingRecordGateway.ts');
const reader = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

// Host Preferences owns only one opaque installation identity. Core owns the
// atomic record read-modify-write and the gateway validates its echo.
assert.match(gateway, /READING_RECORD_DEVICE_ID_KEY = 'device-id'/);
assert.match(gateway, /util\.generateRandomUUID\(\)/);
assert.match(gateway, /request\('read-record\.accumulate', \{/);
assert.match(gateway, /deviceId,\s*bookName: normalizedBookName,\s*elapsedMillis,\s*readAt,/);
assert.doesNotMatch(gateway, /request\('read-record\.(create|update)'/);
assert.match(gateway, /record\.readTime < elapsedMillis \|\| record\.lastRead !== readAt/);

// Time starts only after a real measured page is committed. Foreground,
// periodic and guarded-exit boundaries capture deltas; normal exit awaits the
// serial Core tail before route ownership is returned.
assert.match(reader, /this\.phase = 'ready';\s*this\.beginReadingRecordClock\(lifecycleToken\);/);
assert.match(reader, /const READING_RECORD_FLUSH_INTERVAL_MS = 30000/);
assert.match(reader, /private readingRecordFlushTail: Promise<void> = Promise\.resolve\(\)/);
assert.match(reader, /if \(!this\.appForeground\) \{[\s\S]*?this\.captureReadingRecordElapsed\(false\);\s*this\.clearReadingRecordTimer\(\);\s*void this\.flushReadingRecord\(\);/);
const beginExit = reader.match(/private beginExit\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
const exitCaptureSteps = ['this.exitRequested = true;', 'this.stopReaderTtsAudition();',
  'this.captureReadingRecordElapsed(false);'].map(step => beginExit.indexOf(step));
assert.ok(exitCaptureSteps.every((offset, index) => offset >= 0 &&
  (index === 0 || offset > exitCaptureSteps[index - 1])),
  'guarded exit stops audition before capturing the final reading interval');
assert.doesNotMatch(beginExit.slice(exitCaptureSteps[0], exitCaptureSteps[2]), /\b(?:await|return)\b|this\.finishExit\(/,
  'synchronous ownership updates may intervene; early return or asynchronous exit may not skip interval capture');
assert.match(reader, /await this\.flushReadingRecordForExit\(\);[\s\S]*await this\.commitVisiblePage\(lifecycleToken\);/);
assert.match(reader, /this\.exitDelivered = true;[\s\S]*?try \{[\s\S]*?this\.retainConfirmedEntryPresentation\(\);[\s\S]*?catch \(error\) \{[\s\S]*?\}\s*this\.onExit\(\);/);

const disappear = reader.match(/aboutToDisappear\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
assert.match(disappear, /this\.clearReadingRecordTimer\(\)/);
assert.doesNotMatch(disappear, /flushReadingRecord\(/);

console.log('reading record accumulation contract: PASS');

import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const Reader = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['loadSessionChapter']);
const damaged = { sourceId: 's', bookId: 'b', chapterIndex: 833, content: 'quot;正文',
  bodyVersion: 'old', processingVersion: 'p', sourceCorrectionRequired: true };
const corrected = { ...damaged, content: '"正文', bodyVersion: 'new', sourceCorrectionRequired: false };
const calls = [];
let cached = damaged;
const reader = Object.assign(new Reader(), { bookId: 'b',
  chapterWindow: { get: () => cached },
  activeGateway: () => ({ loadChapter: async (...args) => { calls.push(args); return corrected; } }) });
const current = () => true;
const context = { bodyVersion: 'old', processingVersion: 'p', anchors: [{ id: 'bookmark', offset: 5 }] };
assert.equal(await reader.loadSessionChapter(833, current, false, context), corrected);
assert.deepEqual(calls, [['b', 833, current, false, context]], 'known damaged resident chapter must enter the foreground position transaction');
cached = corrected; calls.length = 0;
assert.equal(await reader.loadSessionChapter(833, current), corrected);
assert.equal(calls.length, 0, 'corrected resident chapters keep their immediate path');
await reader.loadSessionChapter(833, current, true);
assert.equal(calls.length, 1, 'explicit refresh still bypasses the resident window');
console.log('PASS resident damaged chapter enters foreground correction with original anchors; corrected cache remains immediate');

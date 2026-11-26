import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deepPrefetchAllowed,
  hasDeepPrefetchLowWater,
  immediateReadingPrefetchWindow,
  nextDeepPrefetchChapter,
  ReadingDeepPrefetchBreaker,
  ReadingTrialClock,
} from '../entry/src/main/ets/features/reading/application/ReadingDeepPrefetchPolicy.ts';

test('five foreground minutes with actual reading advancement unlock a trial', () => {
  const clock = new ReadingTrialClock();
  clock.observe('trial', 0, true, false);
  for (const now of [45_000, 90_000, 135_000, 180_000, 225_000, 270_000]) {
    clock.observe('trial', now, true, false, false, true);
  }
  assert.equal(clock.isUnlocked('trial', 300_000, false, 0), false);
  clock.observe('trial', 300_000, true, false, true);
  assert.equal(clock.isUnlocked('trial', 300_000, false, 0), true);
});

test('idle and background time do not count toward the trial', () => {
  const clock = new ReadingTrialClock();
  clock.observe('trial', 0, true, false, true);
  clock.observe('trial', 120_000, false, false);
  clock.observe('trial', 420_000, true, false);
  assert.equal(clock.isUnlocked('trial', 420_000, false, 0), false);
  clock.observe('trial', 720_000, true, true);
  assert.equal(clock.unlockDelay('trial', 720_000), 240_000);
  clock.pause(840_000);
  assert.equal(clock.isUnlocked('trial', 1_000_000, false, 0), false);
  clock.observe('trial', 1_000_000, true, true);
  assert.equal(clock.isUnlocked('trial', 1_119_999, false, 0), false);
  assert.equal(clock.isUnlocked('trial', 1_120_000, false, 0), true);
  clock.observe('other book', 1_120_000, true, false);
  assert.equal(clock.isUnlocked('trial', 1_120_000, false, 0), true);
  assert.equal(clock.isUnlocked('other book', 1_120_000, false, 0), false);
});

test('shelf position at chapter three bypasses the trial', () => {
  const clock = new ReadingTrialClock();
  assert.equal(clock.isUnlocked('old', 0, true, 2), true);
  assert.equal(clock.isUnlocked('old', 0, true, 1), false);
  assert.equal(clock.isUnlocked('old', 0, false, 2), false);
});

test('high window spans two readable chapters and deep work yields to it', () => {
  const indexes = Array.from({ length: 20 }, (_, index) => index * 2);
  const cached = new Set([18]);
  const attempted = new Set();
  const next = busy => nextDeepPrefetchChapter(indexes, 5, chapter => cached.has(chapter), attempted, false, busy);
  assert.deepEqual(immediateReadingPrefetchWindow(indexes, 5), { startInclusive: 6, endExclusive: 15 });
  assert.equal(next(true), undefined);
  assert.equal(next(false), 16);
  attempted.add(16);
  assert.equal(next(false), 20);
});

test('nine consecutive hits starts a refill through the fifteenth readable chapter', () => {
  const indexes = Array.from({ length: 20 }, (_, index) => index * 2);
  const cached = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 22, 28]);
  const isCached = chapter => cached.has(chapter);
  const next = refilling => nextDeepPrefetchChapter(indexes, 0, isCached, new Set(), refilling, false);
  assert.equal(hasDeepPrefetchLowWater(indexes, 0, isCached), true);
  assert.equal(next(false), 20);
  cached.add(20);
  assert.equal(hasDeepPrefetchLowWater(indexes, 0, isCached), false);
  assert.equal(next(false), undefined);
  assert.equal(next(true), 24);
  cached.add(24);
  assert.equal(next(true), 26);
  cached.add(26);
  assert.equal(next(true), 30);
  cached.add(30);
  assert.equal(next(true), undefined);
});

test('deep refill accepts only online text on unmetered network with storage headroom', () => {
  assert.equal(deepPrefetchAllowed('text', 'source', true, true), true);
  assert.equal(deepPrefetchAllowed('manga', 'source', true, true), false);
  assert.equal(deepPrefetchAllowed('text', 'local', true, true), false);
  assert.equal(deepPrefetchAllowed('text', 'source', false, true), false);
  assert.equal(deepPrefetchAllowed('text', 'source', true, false), false);
});

test('three deep failures or one throttled response starts ten minute source cooling', () => {
  const breaker = new ReadingDeepPrefetchBreaker();
  breaker.record('source', 0, 'failed');
  breaker.record('source', 1, 'failed');
  breaker.record('source', 2, 'success');
  breaker.record('source', 3, 'failed');
  breaker.record('source', 4, 'failed');
  assert.equal(breaker.blockedUntil('source', 4), undefined);
  breaker.record('source', 5, 'failed');
  assert.equal(breaker.blockedUntil('source', 5), 600_005);
  assert.equal(breaker.blockedUntil('another source', 5), undefined);
  assert.equal(breaker.blockedUntil('source', 600_004), 600_005);
  assert.equal(breaker.blockedUntil('source', 600_005), undefined);
  breaker.record('source', 700_000, 'throttled');
  assert.equal(breaker.blockedUntil('source', 700_000), 1_300_000);
});

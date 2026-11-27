import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNativeLineExtents } from '../../entry/src/main/ets/features/reading/ui/ReaderNativeLineExtents.ts';

test('progressively measured forward and reverse page spans read each shaped line once', () => {
  const count = 512;
  for (const direction of ['forward', 'reverse']) {
    let reads = 0;
    const bounds = new ReaderNativeLineExtents(index => {
      reads += 1;
      return { top: index * 20 - (index === 4 ? 100 : 0), bottom: index * 20 + 20 + (index === 511 ? 3 : 0) };
    });
    for (let index = 0; index < count; index += 1) {
      const first = direction === 'forward' ? 0 : count - 1 - index;
      const last = direction === 'forward' ? index : count - 1;
      assert.ok(bounds.height(first, last) > 0);
    }
    assert.equal(bounds.height(0, count - 1), 10263);
    assert.equal(reads, count);
  }
});

test('a measured subrange keeps its own ink bounds after another range was queried', () => {
  const source = [{ top: -4, bottom: 17 }, { top: 17, bottom: 33 }, { top: 31, bottom: 64 }];
  const bounds = new ReaderNativeLineExtents(index => source[index]);
  assert.equal(bounds.height(0, 2), 68);
  assert.equal(bounds.height(1, 1), 16);
  assert.equal(bounds.height(1, 2), 47);
});

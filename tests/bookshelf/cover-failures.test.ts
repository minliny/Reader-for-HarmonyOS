import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rememberBookCoverFailure } from '../../entry/src/main/ets/app/library/BookCoverDisplay.ts';

test('shelf cover failures deduplicate and evict their oldest URL at 256 entries', () => {
  let failures: string[] = [];
  for (let index = 0; index <= 256; index++)
    failures = rememberBookCoverFailure(failures, `https://covers.invalid/${index}.jpg`);

  assert.equal(failures.length, 256);
  assert.equal(failures[0], 'https://covers.invalid/1.jpg');
  assert.equal(failures.at(-1), 'https://covers.invalid/256.jpg');
  assert.equal(rememberBookCoverFailure(failures, failures[12]), failures);
});

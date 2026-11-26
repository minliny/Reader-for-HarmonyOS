import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BookshelfInputAdmission } from '../../entry/src/main/ets/features/bookshelf/presentation/BookshelfInputAdmission.ts';

test('a retained bookshelf callback admits the active return generation', () => {
  let navigation = 3;
  let shelfActive = true;
  const input = new BookshelfInputAdmission(() => navigation, () => shelfActive);
  const accepted: number[] = [];
  const retainedRowTap = (): void => {
    const opening = input.begin();
    if (opening !== undefined) accepted.push(opening);
  };

  shelfActive = false;
  retainedRowTap();
  navigation = 4;
  shelfActive = true;
  retainedRowTap();

  assert.deepEqual(accepted, [4]);
});

test('deferred bookshelf work is admitted only through its original active opening', () => {
  let navigation = 4;
  let shelfActive = true;
  const input = new BookshelfInputAdmission(() => navigation,
    presented => shelfActive && presented === navigation);
  const opening = input.begin();
  assert.equal(opening, 4);
  assert.equal(input.isCurrent(opening!), true);

  shelfActive = false;
  assert.equal(input.isCurrent(opening!), false);
  navigation = 5;
  shelfActive = true;
  assert.equal(input.isCurrent(opening!), false);
  assert.equal(input.begin(), 5);
});

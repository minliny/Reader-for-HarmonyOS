import assert from 'node:assert/strict';

import { readerPageBottomJustifyGap } from
  '../entry/src/main/ets/features/reading/ReaderPageBottomJustify.ts';

assert.equal(readerPageBottomJustifyGap(false, 10, 190, 200, 20, false), 0);
assert.equal(readerPageBottomJustifyGap(true, 1, 20, 200, 20, false), 0);
assert.equal(readerPageBottomJustifyGap(true, 10, 100, 200, 20, false), 0,
  'a short chapter must stay top-aligned');
assert.equal(readerPageBottomJustifyGap(true, 10, 190, 200, 20, true), 0,
  'an image-ending page must keep its measured geometry');
assert.equal(readerPageBottomJustifyGap(true, 6, 190, 200, 20, false), 2);
assert.equal(readerPageBottomJustifyGap(true, 4, 196, 200, 12, false), 4 / 3);

console.log('reader page-bottom justification: PASS');

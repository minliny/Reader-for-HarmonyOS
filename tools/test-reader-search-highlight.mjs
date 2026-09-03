import assert from 'node:assert/strict';

import {
  splitReaderSearchSnippet,
} from '../entry/src/main/ets/features/reading/ReaderSearchHighlight.ts';

assert.deepEqual(splitReaderSearchSnippet('雨夜终于抵达', 20, 22, 2), {
  prefix: '雨夜',
  match: '终于',
  suffix: '抵达',
});

assert.deepEqual(splitReaderSearchSnippet('A😀雨夜B', 10, 12, 2), {
  prefix: 'A😀',
  match: '雨夜',
  suffix: 'B',
}, 'Unicode scalar offsets must not split an emoji surrogate pair');

assert.deepEqual(splitReaderSearchSnippet('短句', 100, 120, 4), {
  prefix: '短句',
  match: '',
  suffix: '',
}, 'a stale out-of-range match must clamp to the visible snippet');

console.log('reader search highlight: PASS');

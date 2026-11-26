import assert from 'node:assert/strict';
import test from 'node:test';
import { ReaderSourceSwitchReveal } from '../../entry/src/main/ets/features/reading/presentation/ReaderSourceSwitchReveal.ts';
import { SourceSwitchCompletionPresentation }
  from '../../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts';

test('a source-switch reveal follows the exact rendered selection through same-selection reflow', () => {
  const reveal = new ReaderSourceSwitchReveal();
  const completion = new SourceSwitchCompletionPresentation('original', 'remote', 'book', 4, 'Source', 2, 10);
  const key = reveal.bind(completion, 10, 2);
  reveal.present(6, 10, false);
  assert.equal(reveal.matches(completion, 10, 2, 6, false), true);
  assert.equal(reveal.matches(completion, 10, 2, 6, true), false);
  assert.equal(reveal.matches(completion, 10, 2, 7, false), false);
  reveal.present(7, 10, false);
  assert.equal(reveal.matches(completion, 10, 2, 7, false), true);
  assert.equal(reveal.bind(completion, 11, 2), key);
  reveal.present(7, 11, false);
  assert.equal(reveal.matches(completion, 11, 2, 7, false), false);

  const epoch = reveal.consume(key);
  assert.equal(reveal.consumed(key), true);
  assert.equal(reveal.isEpoch(epoch), true);
  reveal.retire(undefined);
  assert.equal(reveal.isEpoch(epoch), false);
  reveal.clearPending();
  assert.equal(reveal.pendingAt(10, 2), false);
  assert.equal(reveal.consumed(key), true);
});

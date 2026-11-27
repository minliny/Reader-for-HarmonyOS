import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SourceToggleAdmission } from '../../entry/src/main/ets/features/source/presentation/SourceListPublication.ts';

test('a toggle deduplicates the current intent and fences retired sessions and superseded intents', () => {
  const admission = new SourceToggleAdmission();
  const first = admission.admit('source', true, 1);
  assert.ok(first);
  assert.equal(admission.admit('source', true, 1), undefined);
  const replacement = admission.admit('source', false, 1);
  assert.ok(replacement);
  assert.equal(admission.current(first, 1), false);
  admission.release(first);
  assert.equal(admission.current(replacement, 1), true);
  assert.equal(admission.current(replacement, 2), false);
  const reentered = admission.admit('source', false, 2);
  assert.ok(reentered);
  admission.release(replacement);
  assert.equal(admission.current(reentered, 2), true);
});

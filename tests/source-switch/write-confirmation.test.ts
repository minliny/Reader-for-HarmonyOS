import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderWriteEvidence } from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';

test('a source-switch write with a lost acknowledgement remains unknown even after a second write is acknowledged', () => {
  const evidence = new ReaderWriteEvidence();
  assert.equal(evidence.confirmation(), 'undispatched');
  evidence.dispatched();
  evidence.dispatched();
  evidence.confirmed();
  assert.equal(evidence.confirmation(), 'unknown');
  assert.equal(evidence.hasConfirmedPart(), true);
});

test('explicit pre-execution rejection preserves the fact of dispatch without suggesting a write took effect', () => {
  const evidence = new ReaderWriteEvidence();
  evidence.dispatched();
  evidence.rejectedBeforeExecution();
  assert.equal(evidence.hasDispatched(), true);
  assert.equal(evidence.confirmation(), 'undispatched');
  assert.equal(evidence.hasConfirmedPart(), false);
});

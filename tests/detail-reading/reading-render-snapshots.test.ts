import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishReadingPresentationPhase, type ReadingPhase } from
  '../../entry/src/main/ets/features/reading/application/ReadingExperienceRenderSnapshots.ts';

test('unchanged phase does not publish a replacement snapshot or a source-switch transition', () => {
  let publications = 0;
  let transitions = 0;
  publishReadingPresentationPhase('ready', 'ready', () => { publications += 1; }, () => { transitions += 1; });
  assert.deepEqual([publications, transitions], [0, 0]);
});

test('phase publishes ahead of its synchronous observer, including a reentrant newer transition', () => {
  let phase: ReadingPhase = 'loading';
  const observed: ReadingPhase[] = [];
  const publish = (next: ReadingPhase): void => { phase = next; };
  const changed = (): void => {
    observed.push(phase);
    if (phase === 'ready') publishReadingPresentationPhase(phase, 'failed', publish, changed);
  };
  publishReadingPresentationPhase(phase, 'ready', publish, changed);
  assert.equal(phase, 'failed');
  assert.deepEqual(observed, ['ready', 'failed']);
});

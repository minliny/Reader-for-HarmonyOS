import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderAutoPageCoordinator } from '../../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts';

test('auto-page cadence highlights only a text fragment in the admitted viewport', () => {
  let now = 0;
  let tick: (() => void) | undefined;
  const coordinator = new ReaderAutoPageCoordinator({
    now: () => now,
    schedule: callback => { tick = callback; return 1; },
    cancel: () => {},
    active: () => true,
    ready: () => true,
    canResumeTurn: () => false,
    turn: () => ({ kind: 'busy' }),
    changed: () => {},
  });
  const visible = ['', 'first', '', 'second', 'third', 'last', ''];
  const hasText = (fragment: string): boolean => fragment.length > 0;
  coordinator.start();
  coordinator.armPageTimer(true);
  assert.equal(coordinator.highlightVisibleFragment(visible, hasText), 'first');
  assert.equal(coordinator.highlightVisibleFragment(['', ''], hasText), undefined);

  now = 4000;
  assert.ok(tick);
  tick();
  assert.equal(coordinator.highlightVisibleFragment(visible, hasText), 'third');

  now = 8000;
  assert.ok(tick);
  tick();
  assert.equal(coordinator.highlightVisibleFragment(visible, hasText), 'last');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { READER_SHEET_CLOSE_MS } from '../../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import { SourceSwitchSurfaceLifecycle, type SourceSwitchSurfaceSnapshot } from '../../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';

test('an owner close releases its native surface without a child frame or transition callback', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const snapshots: SourceSwitchSurfaceSnapshot[] = [];
  const closed: number[] = [];
  const surface = new SourceSwitchSurfaceLifecycle(value => snapshots.push(value), scope => closed.push(scope));
  const attachment = surface.attach(41);
  surface.appeared(attachment, 41, 'drawer');
  surface.appeared(attachment, 41, 'scrim');
  surface.hideCurrent(40);
  assert.deepEqual(snapshots.at(-1), { attachment, attached: true, closing: false });
  surface.hideCurrent(41);
  context.mock.timers.tick(2 * READER_SHEET_CLOSE_MS - 1);
  assert.deepEqual(snapshots.at(-1), { attachment, attached: true, closing: true });
  context.mock.timers.tick(1);
  assert.deepEqual(snapshots.at(-1), { attachment: 0, attached: false, closing: false });
  assert.deepEqual(closed, [41]);
  surface.transitionFinished(attachment, 41, 'drawer', false);
  assert.deepEqual(closed, [41]);
});

test('old disappearance and deadline cannot release a replacement scope', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const closed: number[] = [];
  const surface = new SourceSwitchSurfaceLifecycle(() => {}, scope => closed.push(scope));
  const previous = surface.attach(1);
  surface.appeared(previous, 1, 'scrim');
  surface.hide(previous, 1);
  const current = surface.attach(2);
  surface.appeared(current, 2, 'scrim');
  assert.equal(surface.disappeared(previous, 1, 'scrim'), false);
  context.mock.timers.tick(2 * READER_SHEET_CLOSE_MS);
  assert.equal(surface.current(current, 2), true);
  surface.hide(current, 2);
  assert.equal(surface.disappeared(current, 2, 'scrim'), true);
  assert.deepEqual(closed, [2]);
});

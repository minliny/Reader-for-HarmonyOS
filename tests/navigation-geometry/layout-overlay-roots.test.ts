import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderLayoutOverlayRoots } from '../../entry/src/main/ets/ui/layout/ReaderLayoutOverlayRoots.ts';

test('cover and custom dialog roots are picked up by their active window mount, including dynamic popups', () => {
  const roots = new ReaderLayoutOverlayRoots();
  const retireRecovery = roots.mount(17, 'reader-layout-overlay:local-recovery:1');
  const retireRemoval = roots.mount(17, 'reader-layout-overlay:book-removal:2');
  const retireSelect = roots.mount(17, 'reader-layout-overlay:select:3');
  const retireOtherWindow = roots.mount(18, 'reader-layout-overlay:select:4');
  assert.deepEqual(roots.active(17), [
    'reader-layout-overlay:local-recovery:1', 'reader-layout-overlay:book-removal:2', 'reader-layout-overlay:select:3',
  ]);
  assert.deepEqual(roots.active(18), ['reader-layout-overlay:select:4']);
  assert.equal(retireRemoval(), true);
  assert.deepEqual(roots.active(17), ['reader-layout-overlay:local-recovery:1', 'reader-layout-overlay:select:3']);
  assert.equal(retireRecovery(), true);
  assert.equal(retireSelect(), true);
  assert.equal(retireOtherWindow(), true);
  assert.deepEqual(roots.active(17), []);
});

test('a closing overlay cannot unregister its replacement with the same public actor id', () => {
  const roots = new ReaderLayoutOverlayRoots();
  const previous = roots.mount(17, 'reader-control-more-menu');
  const replacement = roots.mount(17, 'reader-control-more-menu');
  assert.equal(previous(), false);
  assert.deepEqual(roots.active(17), ['reader-control-more-menu']);
  assert.equal(replacement(), true);
  assert.equal(replacement(), false);
  assert.deepEqual(roots.active(17), []);
});

test('a mounted overlay without window evidence remains outstanding and cannot be attributed to another window', () => {
  const roots = new ReaderLayoutOverlayRoots();
  const retire = roots.mount(undefined, 'unscoped-cover');
  assert.deepEqual(roots.active(17), []);
  assert.deepEqual(roots.active(undefined), ['unscoped-cover']);
  assert.equal(retire(), true);
  assert.deepEqual(roots.active(undefined), []);
});

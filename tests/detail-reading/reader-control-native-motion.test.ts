import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  READER_CONTROL_MR1_DOCK_TRANSLATE_Y,
  READER_CONTROL_MR1_TOP_BAR_TRANSLATE_Y,
  ReaderControlMotionFrameCache,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import { readerControlNativeMotionMode } from
  '../../entry/src/main/ets/features/reading/ui/ReaderControlNativeMotionPolicy.ts';

test('readerControlNativeMotionMode routes normal open/dismiss, morph, and directSheet off JS frame loop', () => {
  assert.equal(readerControlNativeMotionMode('open', false, false, false, -1, false), 'visibility');
  assert.equal(readerControlNativeMotionMode('dismiss', true, false, false, -1, false), 'visibility');
  assert.equal(readerControlNativeMotionMode('navigate', false, true, true, -1, false), 'directSheet');
  assert.equal(readerControlNativeMotionMode('navigate', false, false, true, -1, false), 'directSheet');
  assert.equal(readerControlNativeMotionMode('navigate', true, false, false, -1, false), 'moduleNavigate');
  assert.equal(readerControlNativeMotionMode('morph', false, false, false, -1, false), 'morph');
  assert.equal(readerControlNativeMotionMode('morph', true, false, false, -1, false), 'morph');
  assert.equal(readerControlNativeMotionMode('navigate', false, false, false, -1, false), 'morph');
});

test('readerControlNativeMotionMode keeps frameLoop for active drags and probed transitions', () => {
  assert.equal(readerControlNativeMotionMode('open', false, false, false, 3, false), 'frameLoop');
  assert.equal(readerControlNativeMotionMode('dismiss', false, false, false, 0, false), 'frameLoop');
  assert.equal(readerControlNativeMotionMode('open', false, false, false, -1, true), 'frameLoop');
  assert.equal(readerControlNativeMotionMode('dismiss', true, false, false, -1, true), 'frameLoop');
  assert.equal(readerControlNativeMotionMode('navigate', false, true, true, -1, true), 'frameLoop');
  assert.equal(readerControlNativeMotionMode('navigate', true, false, false, -1, true), 'frameLoop');
});

test('ReaderControlMotionFrameCache reuses cached visibility=1 layout frames and encodes hidden resting offsets', () => {
  const cache = new ReaderControlMotionFrameCache();
  const layoutFirst = cache.sample(1, 0, 360, 700, 12, 320, 0, undefined, 'legacy', false);
  const layoutSecond = cache.sample(1, 0, 360, 700, 12, 320, 0, undefined, 'legacy', false);
  assert.equal(layoutFirst, layoutSecond);
  assert.equal(layoutFirst.visibility, 1);
  assert.equal(layoutFirst.topBar.opacity, 1);
  assert.equal(layoutFirst.topBar.translateY + 0, 0);
  assert.equal(layoutFirst.dock.opacity, 1);
  assert.equal(layoutFirst.dock.translateY + 0, 0);

  const hidden = cache.sample(0, 0, 360, 700, 12, 320, 0, undefined, 'legacy', false);
  assert.equal(hidden.topBar.opacity, 0);
  assert.equal(hidden.topBar.translateY, READER_CONTROL_MR1_TOP_BAR_TRANSLATE_Y);
  assert.equal(hidden.dock.opacity, 0);
  assert.equal(hidden.dock.translateY, READER_CONTROL_MR1_DOCK_TRANSLATE_Y);

  const reducedHidden = cache.sample(0, 0, 360, 700, 12, 320, 0, undefined, 'legacy', true);
  assert.equal(reducedHidden.topBar.opacity, 0);
  assert.equal(reducedHidden.topBar.translateY, 0);
  assert.equal(reducedHidden.dock.opacity, 0);
  assert.equal(reducedHidden.dock.translateY, 0);
});

test('ReaderControlPanel, ReaderTtsWaveform, and ReaderLibrarySearchSurface avoid renderGroup thrashing on resizing or per-frame animated subtrees', () => {
  const controlPanel = readFileSync(
    new URL('../../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url),
    'utf8',
  );
  assert.equal(/\.renderGroup\s*\([^)]*(?:visualHeldPointerId|visualTransitionKind\s*!==\s*['"]['"])/.test(controlPanel), false,
    'ReaderControlPanel must not enable renderGroup during drag or morph');

  const waveform = readFileSync(
    new URL('../../entry/src/main/ets/features/reading/ui/ReaderTtsWaveform.ets', import.meta.url),
    'utf8',
  );
  assert.equal(/\.renderGroup\s*\(/.test(waveform), false,
    'ReaderTtsWaveform must not enable renderGroup while bars animate every frame');

  const searchSurface = readFileSync(
    new URL('../../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets', import.meta.url),
    'utf8',
  );
  assert.equal(/\.renderGroup\s*\(/.test(searchSurface), false,
    'ReaderLibrarySearchSurface must not enable renderGroup on height/clip-animating containers');
});

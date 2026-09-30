import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';

const close = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) <= 0.000001,
    `${message}: ${actual} !== ${expected}`);
};

const secondarySpec = new SurfaceWidthSpec(720, 19, 19, 'center');
const phoneDetail = resolveHorizontalFrame(390, 0, 0, secondarySpec);
assert.deepEqual({ ...phoneDetail }, { left: 19, right: 19, width: 352 });

const realPhoneDetail = resolveHorizontalFrame(365.71, 0, 0, secondarySpec);
close(realPhoneDetail.left, 19, 'real-device detail left gap');
close(realPhoneDetail.right, 19, 'real-device detail right gap');
close(realPhoneDetail.width, 327.71, 'real-device detail width');

const tabletDetail = resolveHorizontalFrame(760, 0, 0, secondarySpec);
assert.deepEqual({ ...tabletDetail }, { left: 20, right: 20, width: 720 });

// Returning from Reader must resolve the same Detail role before and after the
// session. There is no physical-device or design-canvas fallback in this path.
assert.deepEqual(
  { ...resolveHorizontalFrame(390, 0, 0, secondarySpec) },
  { ...phoneDetail },
);

const phoneDirectory = resolveHorizontalFrame(
  390,
  0,
  0,
  new SurfaceWidthSpec(364, 12, 12, 'center'),
);
assert.deepEqual({ ...phoneDirectory }, { left: 13, right: 13, width: 364 });

const tabletDirectory = resolveHorizontalFrame(
  760,
  0,
  0,
  new SurfaceWidthSpec(720, 27, 13, 'right'),
);
assert.deepEqual({ ...tabletDirectory }, { left: 27, right: 13, width: 720 });

// Source switching is now an approved full-screen flow. Its parent supplies
// the full width; only real window safe insets are consumed by the component.

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const directory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
const sourceSwitch = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const sourceSwitchPanel = read('entry/src/main/ets/features/reading/SourceSwitchPanel.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

assert.match(detail, /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, 19, 19, 'center'\)/);
assert.match(detail, /this\.viewportWidth > 0[\s\S]*ReaderWindowCoordinator\.metrics\(\)\.windowRect\.width/,
  'Detail must seed its first frame from measured Window metrics');
assert.doesNotMatch(detail, /@Prop isTablet/,
  'Detail geometry must not be selected by physical device form');
assert.doesNotMatch(index, /LocalBookDetail\(\{[\s\S]{0,180}isTablet:/,
  'the Detail route must not pass physical device form into geometry');

assert.match(directory, /new SurfaceWidthSpec\(720, 27, 13, 'right'\)/);
assert.match(directory, /new SurfaceWidthSpec\(364, 12, 12, 'center'\)/);
assert.match(directory, /readerInteractiveSafeBottom\(ReaderWindowCoordinator\.metrics\(\)\)/);
assert.doesNotMatch(directory, /@Prop isTablet/,
  'Full Directory must select its layout from the live container');

assert.match(sourceSwitch, /build\(\)[\s\S]*\.width\('100%'\)\.height\('100%'\)/);
assert.match(sourceSwitch, /padding\(\{ top: this\.safeTop\(\), bottom: this\.safeBottom\(\), left: this\.safeLeft\(\), right: this\.safeRight\(\)/);
assert.match(sourceSwitch, /readerInteractiveSafeLeft\(metrics\)/);
assert.match(sourceSwitch, /return !this\.consumeTopInset \|\| this\.readerWindowMetricsRevision < 0 \? 0 : readerVisualSafeTop/,
  'detail host can own the safe top once while the reader overlay consumes it');
assert.doesNotMatch(sourceSwitch, /new SurfaceWidthSpec\(300|Math\.min\(385|borderRadius\(20\)/,
  'source switching no longer uses the retired centered 300x385 modal');
assert.match(sourceSwitchPanel, /consumeTopInset: this\.consumeTopInset/);
assert.doesNotMatch(sourceSwitchPanel, /@Prop isTablet/);

console.log('surface transition P0: PASS');

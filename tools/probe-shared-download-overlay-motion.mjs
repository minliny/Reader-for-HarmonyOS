import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { DOWNLOAD_VISUAL, downloadVisualColor } from '../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts';
import { readerVisualSafeLeft, readerVisualSafeRight } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const readEts = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const properties = createArkUIPropertyRuntimeProbe();
const motion = productionReaderMotionSdk();
class Surface {
  constructor(owner, _params, _storage, id) { Object.assign(this, { owner, id }); }
}
const { Component } = createReaderBuilderProbe(readEts('features/downloads/ui/SharedDownloadPage.ets'), [
  'pageOverlays', 'sheetOverlay', 'sheetSurface', 'operationsSurface', 'confirmationOverlay',
  'isOperationsSheet', 'sheetScrimColor', 'onConfirmationChanged', 'previousConfirmation',
  'searchInputRevision', 'sheet', 'confirmation', 'reduceMotion', 'sheetExitPending',
  'sheetActorAttachment', 'sheetActorOwner', 'sheetOpeningGeneration', 'confirmationGeneration',
], {
  ...properties.sdk, ...motion, ...readerSurfaceSpecsForProbe(), DOWNLOAD_VISUAL, downloadVisualColor, globalThis,
  readerVisualSafeLeft, readerVisualSafeRight,
  ReaderInsetsVp: class {},
  ReaderBoundedSurface: Surface, ReaderDialogSurface: Surface,
  TransitionEdge: { BOTTOM: 'bottom' },
  TransitionEffect: {
    OPACITY: { animation: params => ({ opacity: params }) },
    move: edge => ({ animation: params => ({ edge, params }) }),
    asymmetric: (enter, exit) => ({ enter, exit }),
  },
}, {
  ...properties.hooks,
  allowEmptyBranchAdmission: true,
  allowEmptyBranchRemoval: true,
  childSources: {
    ReaderBoundedSurface: readEts('ui/surfaces/ReaderBoundedSurface.ets'),
    ReaderDialogSurface: readEts('ui/surfaces/ReaderDialogSurface.ets'),
  },
});

function mount(sheet, confirmation = '', reduceMotion = false, scheme = 'day') {
  const owner = new Component(undefined, { reduceMotion });
  const metrics = { systemInsets: { left: 0 }, cutoutInsets: { right: 0 } };
  Object.assign(owner, {
    batchRecovery: { visible: false }, appThemeScheme: scheme,
    invalidateReadingHandoff() {}, syncOverlayChrome() {}, syncOverlayFocus() {}, retireEmptyBookSelection() {},
    sheetContent() {}, operationsHeader() {}, operationsBody() {}, confirmationSurfaceBody() {},
    currentMetrics: () => metrics, safeLeft: () => readerVisualSafeLeft(metrics), safeRight: () => readerVisualSafeRight(metrics),
    sheetMaxHeight: () => 300,
    operationsSurfaceWidth: () => 360, operationsBottomInset: () => 0, dialogOuterPaddingY: () => 12,
    sheet, confirmation,
  });
  owner.pageOverlays();
  return owner;
}

// SDK lowering and observed property dispatch, with no simulated native paint.
const masks = owner => [...owner.nodes.values()].filter(node => node.type === 'Rect' && typeof node.fill === 'string');
const sheetCarrier = owner => [...owner.nodes.values()].find(node => node.type === 'Stack' && node.enabled !== undefined);
function setConfirmation(owner, id) {
  owner.confirmation = id;
  properties.flush();
}
function assertSheetInput(owner, blocked) {
  const carrier = sheetCarrier(owner);
  assert.equal(carrier.enabled, !blocked);
  assert.equal(carrier.accessibilityLevel, blocked ? 'no-hide-descendants' : 'auto');
  assert.equal(carrier.hitTestBehavior, blocked ? 'HitTestMode.None' : 'HitTestMode.Transparent');
}

for (const scheme of ['day', 'night']) {
  const owner = mount('settings', '', false, scheme);
  const [scrim] = masks(owner);
  assert.ok(scrim, 'storage paints the original standard mask');
  const fill = scrim.fill;
  for (const id of ['cleanup', '', 'cleanup', '']) {
    setConfirmation(owner, id);
    assert.deepEqual(masks(owner), [scrim], 'storage and confirmation share the original scrim actor');
    assert.equal(scrim.fill, fill, 'opening and closing the dialog does not change background intensity');
    assertSheetInput(owner, id.length > 0);
  }
  assert.equal(masks(mount('', 'cleanup', false, scheme)).length, 1, 'a standalone confirmation supplies its own scrim');
}

for (const sheet of ['book-actions', 'chapter-actions']) {
  for (const reduceMotion of [false, true]) {
    const owner = mount(sheet, '', reduceMotion);
    const panel = [...owner.nodes.values()].find(node => node.type === 'Column' && node.transition !== undefined);
    const [scrim] = masks(owner);
    assert.ok(panel && scrim, 'the actual operations panel and scrim are present');
    const expectedMotion = reduceMotion ? motion.readerMotionReducedFadeParam() : motion.motionAnimateParam('app.sheet.scrim');
    assert.equal(expectedMotion.duration, reduceMotion ? 120 : 160);
    for (const id of ['', 'cancel', '', 'deleteLocal', '']) {
      const start = owner.attributeCalls.length;
      const changesConfirmation = id !== owner.confirmation;
      setConfirmation(owner, id);
      assert.deepEqual(masks(owner), [scrim], 'operations confirmation leaves the original scrim visible');
      assert.equal(sheetCarrier(owner).opacity, undefined, 'the scrim carrier stays opaque while the panel fades');
      assertSheetInput(owner, id.length > 0);
      assert.equal(owner.nodes.get(panel.id), panel, 'confirmation keeps the existing panel mounted');
      assert.equal(panel.opacity, id ? 0 : 1);
      assert.deepEqual(panel.animation, expectedMotion, 'the opacity target is paired with the shared fade policy');
      if (changesConfirmation) {
        const calls = owner.attributeCalls.slice(start).filter(call => call.id === panel.id);
        const animationStart = calls.findIndex(call => call.property === 'contextAnimation');
        assert.deepEqual(calls.slice(animationStart, animationStart + 3).map(call => call.property),
          ['contextAnimation', 'opacity', 'contextAnimation'], 'the SDK animates only the operations panel opacity');
        assert.deepEqual(calls[animationStart].args, [expectedMotion]);
        assert.deepEqual(calls[animationStart + 2].args, [null]);
      }
    }
  }
}

console.log('PASS shared download overlay scrim and confirmation motion bindings');

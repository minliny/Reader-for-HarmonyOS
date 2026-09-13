import { readerBrightnessControlPercent } from '../entry/src/main/ets/features/reading/ReaderBrightnessCurve.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
const source = file => new URL(`../entry/src/main/ets/features/reading/${file}.ets`, import.meta.url);
let writer;
const Host = productionMotionMethods(source('LocalReadingExperience'), [
  'cancelReaderBrightness', 'enqueueReaderBrightness', 'admitReaderBrightness',
], {
  ReaderWindowCoordinator: { brightness: () => writer }, readerBrightnessControlPercent,
  READER_CONTROL_BRIGHTNESS_MIN: 1, READER_CONTROL_BRIGHTNESS_MAX: 100,
  hilog: { error() {} },
});
const Panel = productionMotionMethods(source('ReaderControlPanel'), [
  'cancelBrightnessDrag', 'onBrightnessConfirmed',
]);
const host = () => Object.assign(new Host(), {
  refreshSystemBrightness() {},
  mounted: true, brightnessOwner: 4, brightnessRequestGeneration: 0,
  brightnessPercent: 50, brightnessAutomatic: false, brightnessRevision: 0,
  claimReaderBrightness() { return this.brightnessOwner; },
  refreshReaderBrightness() { throw new Error('cancel must settle through the writer, not a racing read'); },
});

// A has been dispatched while B is newest but still pending. Cancel drops B;
// A's ordinary stale ACK is ignored, then the same writer's settled ACK wins.
{
  const a = deferred(), b = deferred(), cancelled = deferred(); let requests = 0;
  writer = {
    request() { return ++requests === 1 ? a.promise : b.promise; },
    cancelAndSettle(owner) { assert.equal(owner, 4); b.resolve({ applied: false, value: .5 }); return cancelled.promise; },
  };
  const h = host(); h.enqueueReaderBrightness(.2, 'manual'); h.enqueueReaderBrightness(.8, 'manual');
  const p = Object.assign(new Panel(), {
    brightnessDragging: true, brightnessPreviewPercent: 80, brightnessLastEmittedPercent: 80,
    onBrightnessCancel: () => h.cancelReaderBrightness(),
  });
  p.cancelBrightnessDrag(); assert.equal(p.brightnessPreviewPercent, 80, 'cancel keeps preview until settled ACK');
  a.resolve({ applied: true, value: .2 }); await settle();
  assert.equal(h.brightnessPercent, 50, 'old ordinary ACK cannot race the cancel transaction');
  cancelled.resolve({ applied: true, value: .2 }); await h.brightnessMutationQueue;
  assert.equal(h.brightnessPercent, readerBrightnessControlPercent(.2)); assert.equal(h.brightnessRevision, 1);
  p.onBrightnessConfirmed(); assert.equal(p.brightnessPreviewPercent, -1);
}

// A new explicit automatic intent outranks a delayed Cancel ACK.
{
  const cancelled = deferred(), automatic = deferred();
  writer = { cancelAndSettle: () => cancelled.promise, request: () => automatic.promise };
  const h = host(); h.cancelReaderBrightness(); h.enqueueReaderBrightness(-1, 'automatic');
  cancelled.resolve({ applied: true, value: .2 }); await settle();
  assert.equal(h.brightnessPercent, 50); assert.equal(h.brightnessRevision, 0);
  automatic.resolve({ applied: true, value: -1 }); await h.brightnessMutationQueue;
  assert.equal(h.brightnessAutomatic, true); assert.equal(h.brightnessRevision, 1);
}

// Failed issued writes are resolved by the writer to its last confirmed value;
// teardown without a current drag cannot accidentally start a new transaction.
{
  writer = { cancelAndSettle: async () => ({ applied: true, value: .5 }) };
  const h = host(); h.brightnessPercent = 80; h.cancelReaderBrightness(); await h.brightnessMutationQueue;
  assert.equal(h.brightnessPercent, readerBrightnessControlPercent(.5)); assert.equal(h.brightnessRevision, 1);
  let calls = 0;
  const p = Object.assign(new Panel(), { brightnessDragging: false, onBrightnessCancel: () => calls++ });
  p.cancelBrightnessDrag(); assert.equal(calls, 0);
}
console.log('PASS brightness cancel UI: issued ACK, preview retention, cancelled pending, newer intent, failed write convergence');

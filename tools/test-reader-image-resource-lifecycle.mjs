import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderReadingImageResources, sameReaderReadingImageResource } from '../entry/src/main/ets/features/reading/ReaderReadingImageResources.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
assert.match(source, /readingImageResources: ReaderReadingImageResources =\s*new ReaderReadingImageResources\(ReaderRuntimeOwner.current\(\)/);
const events = [];
let staticAvailable = true, diagnosticFails = false;
const allocator = { releaseReadingImage(uri, pixels) { events.push(['release', uri, pixels]); if (uri === 'file:///partial') throw Error('partial native release'); } };
const ResourceReader = productionMotionMethods(file, ['adoptReadingImage', 'releaseUnadmittedReadingImage',
  'releaseUnretainedReadingImages', 'isReadingImageRetained', 'sameReadingImageResource', 'releaseAllReadingImages', 'aboutToDisappear'], {
  sameReaderReadingImageResource,
  ReaderRuntimeOwner: { current() { assert.equal(staticAvailable, true, 'cleanup cannot look up the retired static owner'); return allocator; } },
  ReaderWindowCoordinator: { requestAppChrome() {}, requestAppWindowPolicy: async () => {} },
});
function image(uri, pixelMap, state = 'ready') { return { fileUri: uri, pixelMap, state }; }
function fixture() {
  const resources = new ReaderReadingImageResources(allocator, () => {
    events.push(['release-diagnostic']); if (diagnosticFails) throw Error('diagnostic unavailable');
  });
  const owner = Object.assign(new ResourceReader(), {
    readingImageResources: resources, geometryImageRequests: new Map(),
    chapter: { images: [] }, chapterWindow: { retainedImages: () => [], clear: () => events.push(['chapter-clear']) },
    visibleFragments: [], mounted: true, lifecycleToken: 1, isReaderIdentityCurrent: () => false,
    bookTurnSession: { setEventListener() {} }, quickSearchPublication: { cancel() {} },
    autoPageCoordinator: { dispose() {} },
    nativeParagraphResources: { close: () => events.push(['paragraph-close']) },
    nativeTextMeasurement: { clear: () => events.push(['measurement-clear']) },
    remoteSessionObserverDispose: () => events.push(['observer-dispose']),
    ttsCoordinator: { dispose: async () => events.push(['tts-dispose']) },
    onExitRequestHandler: () => events.push(['unregister']),
  });
  for (const name of ['finishSessionCapsuleMorph','invalidatePageTurnRuntime','clearDeferredPageTurnWork',
    'restoreInitialWindowBrightness','onControlInputBoundaryChanged','invalidateReplaceMutationOwner','cancelPendingAutoPageStart',
    'clearAutoPageTimer','clearAutoPageSessionTimer','clearPageChromeStatusTimer','clearReadingRecordTimer',
    'resetPaginationDraft','cancelMeasurementDeadline','cancelFirstPageReadyDeadline','cancelFirstPageCompletionDeadline',
    'cancelPageTurnPreparationRetry']) owner[name] = () => {};
  return { owner, resources };
}
{
  const f = fixture(), pixels = {};
  f.owner.adoptReadingImage(image('file:///one'));
  f.owner.adoptReadingImage(image('file:///one'));
  f.owner.adoptReadingImage(image('', pixels));
  f.owner.adoptReadingImage(image('', pixels));
  f.owner.adoptReadingImage(image('', undefined));
  f.owner.adoptReadingImage(image('file:///pending', undefined, 'pending'));
  assert.equal(f.resources.length, 2);
  assert.equal(events.length, 2, 'each duplicate Host acquisition releases one extra lease');
  f.owner.chapter.images.push(image('file:///one'));
  f.owner.releaseUnretainedReadingImages();
  assert.equal(f.resources.length, 1, 'view retention predicate stays in the actual reader transaction');
  f.owner.geometryImageRequests.set('late', { resolved: image('file:///late') });
  staticAvailable = false;
  f.owner.aboutToDisappear();
  assert.equal(f.resources.length, 0);
  assert.equal(f.owner.geometryImageRequests.size, 0);
  assert.deepEqual(events.filter(e => e[0] === 'release').map(e => e[1]),
    ['file:///one', '', '', 'file:///late', 'file:///one']);
  assert.deepEqual(events.slice(-6).map(e => e[0]),
    ['paragraph-close','chapter-clear','observer-dispose','tts-dispose','measurement-clear','unregister'],
    'the retired static slot cannot interrupt the subsequent cleanup sequence');
  // A retired acquisition may resolve after close: it releases through the
  // captured allocator, without touching the new route/runtime owner.
  f.owner.releaseUnadmittedReadingImage(image('file:///after-close'));
  assert.equal(events.at(-1)[1], 'file:///after-close');
  f.owner.releaseAllReadingImages();
  assert.equal(events.filter(e => e[1] === 'file:///one').length, 2, 'repeated close does not replay retained releases');
}
for (const brokenDiagnostics of [false, true]) {
  diagnosticFails = brokenDiagnostics; events.length = 0;
  const f = fixture();
  f.owner.adoptReadingImage(image('file:///partial'));
  f.owner.adoptReadingImage(image('file:///ok'));
  f.owner.aboutToDisappear();
  assert.equal(f.resources.releaseFailures(), 1, 'a thrown release is recorded, not claimed confirmed or blindly replayed');
  assert.ok(events.some(e => e[0] === 'measurement-clear'));
  assert.ok(events.some(e => e[1] === 'file:///ok'));
  f.resources.close();
  assert.equal(events.filter(e => e[1] === 'file:///partial').length, 1);
}
console.log('PASS actual reader image lease owner: captured allocator, duplicate acquisitions, retained contexts, Runtime-unset teardown, late release, failed release/diagnostic isolation. Native deletion/PixelMap receipt is not claimed.');

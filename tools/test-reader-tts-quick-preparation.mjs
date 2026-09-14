import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import * as state from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { FakeGateway, FakeHost, chapter, canonicalRemoteContent } from './lib/reader-tts-fixtures.mjs';

const root = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const lre = new URL('LocalReadingExperience.ets', root).pathname;
const source = readFileSync(lre, 'utf8');
const defaults = { version: 1, language: 'zh-CN', person: 0, pauseOnInterruption: true,
  allowMixing: false, failurePolicy: 'stop', followHighlight: true, backgroundPlayback: true, keepScreenOn: false };
const voices = [{ language: 'en-US', person: 2, label: 'English' }, { language: 'zh-CN', person: 0, label: '中文' }];
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function drain() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
let runtime;
class Frame { constructor(fn) { this.fn = fn; } onFrame() { this.fn(); } }
const dependencies = { ...state, ReaderTtsSessionCoordinator, ReaderUIFrameCallback: Frame,
  ReaderRuntimeOwner: { current: () => runtime },
  ReaderTtsGateway: class { constructor(owner) { return owner.gateway; } },
  ReaderHttpTtsGateway: class { constructor(owner) { return owner.http; } },
  hilog: { error: () => {} } };
const methods = ['notifyControlSelectionReadingReady', 'scheduleTtsPresentationWarmup', 'initializeTtsSession',
  'isStableVisiblePageOwner', 'isSelectionCurrent', 'loadTtsPresentationMetadata', 'admitTtsPreferences', 'ttsPreferencesSnapshot', 'multiplierForTtsConfig',
  'multiplierForCoreRate', 'prepareControlPage', 'changeTtsRate'];
function fixture(file = lre) {
  const Owner = productionMotionMethods(file, methods, dependencies);
  const owner = new Owner(), frames = [], events = [], http = deferred(), prefs = deferred(), voice = deferred();
  const gateway = new FakeGateway(), host = new FakeHost();
  gateway.getConfig = async () => { gateway.calls.push('config'); return { engine: 'system', rate: 4, ratePercent: 75, pitch: 0, followSys: false }; };
  host.listSystemVoices = () => { events.push('voices'); return voice.promise; };
  runtime = { gateway, getTtsHost: () => host, http: { list: () => { events.push('http'); return http.promise; } } };
  Object.assign(owner, { mounted: true, exitRequested: false, lifecycleToken: 1, phase: 'ready', sourceId: 'source', bookId: 'book',
    chapter: { chapterIndex: 0, chapterTitle: 'chapter' }, visiblePage: { startScalar: 0 },
    chapterSelectionToken: 1, visiblePageSelectionToken: 1,
    ttsWarmupScheduled: false, ttsInitialization: undefined, ttsPresentationMetadata: undefined, ttsAvailabilityResolved: false,
    ttsPreferenceMutationGeneration: 0, ttsConfigMutationGeneration: 0,
    ttsState: state.createReaderTtsState(), ttsEngine: 'system', ttsHttpEngines: [], ttsVoiceOptions: [],
    ttsLanguage: 'zh-CN', ttsPerson: 0, ttsPauseOnInterruption: true, ttsAllowMixing: false,
    ttsFailurePolicy: 'stop', ttsFollowHighlight: true, ttsBackgroundPlayback: true, ttsKeepScreenOn: false,
    isMountedToken(t) { return this.mounted && this.lifecycleToken === t; },
    isSessionActive(t) { return this.isMountedToken(t) && !this.exitRequested; },
    getUIContext: () => ({ postFrameCallback: f => frames.push(f) }),
    onChapterCommitted: () => events.push('committed'), onReadingReady: () => events.push('ready'),
    onSessionLaunchTtsState: s => events.push(`state:${s.status}`),
    ttsPreferencesGateway: { load: () => { events.push('prefs'); return prefs.promise; } },
    persistTtsPreferences: () => events.push('repairVoice'),
    persistTtsConfig: async rate => { owner.ttsConfig = { ratePercent: rate * 100 }; },
    logTtsFailure: (op, error) => events.push(`error:${op}:${error.message}`), errorMessage: e => e.message,
  });
  const resolveMetadata = () => { http.resolve([]); prefs.resolve(defaults); voice.resolve(voices); };
  return { owner, frames, events, http, prefs, voice, gateway, host, resolveMetadata };
}

function readySchedulesAfterObservers(file = lre) {
  const f = fixture(file); f.owner.notifyControlSelectionReadingReady(0, 'chapter');
  assert.deepEqual(f.events, ['committed', 'ready'], 'ready observers finish before optional platform/Core calls');
  assert.equal(f.frames.length, 1, 'ready schedules one deferred TTS preflight before controls are entered');
  return f;
}
// Negative control reconstructs the installed omission: ready never scheduled
// preparation. This must fail the same production-method assertion.
const mutant = '/private/tmp/reader-ph44-no-ready-preparation.ets';
const warmupCall = 'this.scheduleTtsPresentationWarmup();';
assert.equal(source.split(warmupCall).length, 2, 'the negative control removes the one production scheduling call');
writeFileSync(mutant, source.replace(warmupCall, 'void 0;'));
assert.throws(() => readySchedulesAfterObservers(mutant), /ready schedules one deferred TTS preflight/);

{
  const f = readySchedulesAfterObservers();
  for (let i = 0; i < 100; i++) { f.owner.chapter.chapterIndex=i; f.owner.notifyControlSelectionReadingReady(i, 'chapter'); }
  assert.equal(f.frames.length, 1, 'repeated ready/turn notifications cannot enqueue duplicate work');
  f.frames.shift().onFrame(); await drain();
  assert.deepEqual(f.events.filter(x => ['http', 'prefs', 'voices'].includes(x)), ['http', 'prefs', 'voices'], 'independent requests all start without waiting on a predecessor');
  assert.equal(f.owner.ttsState.status, 'idle'); assert.equal(f.owner.ttsState.rate, .75);
  assert.equal(f.owner.ttsAvailabilityResolved, true);
  assert.deepEqual(f.gateway.calls, ['config'], 'preflight never slices/starts/stops a Core queue');
  assert.deepEqual(f.host.calls, ['engine:system', 'available'], 'no activate, speak, stop or media publication');
  const promise = f.owner.ttsInitialization;
  for (const page of ['moduleTts', 'fullTts', 'moduleTts']) f.owner.prepareControlPage(page);
  assert.strictEqual(f.owner.ttsInitialization, promise); await drain();
  assert.equal(f.gateway.calls.length, 1, 'first entry and repeated visits reuse preparation');
  // Slow HTTP and voice calls cannot withhold already loaded saved preferences.
  f.prefs.resolve({ ...defaults, language: 'en-US', person: 2, followHighlight: false }); await drain();
  assert.equal(f.owner.ttsLanguage, 'en-US'); assert.equal(f.owner.ttsFollowHighlight, false);
  assert.equal(f.owner.ttsVoiceOptions.length, 0);
  f.voice.resolve(voices); await drain(); assert.equal(f.owner.ttsVoiceOptions.length, 2);
  assert.equal(f.owner.ttsLanguage, 'en-US');
  f.http.resolve([]); await drain();
  assert.equal(f.owner.ttsPresentationMetadata, undefined);
}

// A delayed frame or any async publication belongs to the exact book/lifecycle.
for (const invalidate of [o => { o.mounted = false; }, o => { o.exitRequested = true; },
  o => { o.lifecycleToken++; }, o => { o.bookId = 'next'; }, o => { o.sourceId = 'next'; }]) {
  const f = readySchedulesAfterObservers(); invalidate(f.owner); f.frames.shift().onFrame(); await drain();
  assert.equal(f.gateway.calls.length, 0, 'obsolete frame cannot initialize');
}
for (const invalidate of [o => { o.exitRequested = true; }, o => { o.lifecycleToken++; },
  o => { o.bookId = 'next'; }, o => { o.ttsCoordinator = undefined; }]) {
  const f = readySchedulesAfterObservers(), config = deferred();
  f.gateway.getConfig = () => config.promise;
  f.frames.shift().onFrame(); await drain();
  const before = JSON.stringify({ s: f.owner.ttsState, v: f.owner.ttsVoiceOptions, e: f.owner.ttsHttpEngines });
  invalidate(f.owner); config.resolve({ engine: 'system', rate: 4, ratePercent: 75 }); f.resolveMetadata(); await drain();
  assert.equal(JSON.stringify({ s: f.owner.ttsState, v: f.owner.ttsVoiceOptions, e: f.owner.ttsHttpEngines }), before,
    'late old-owner config/voice/preferences cannot publish');
  assert.equal(f.owner.ttsAvailabilityResolved, false);
}

{
  const f = readySchedulesAfterObservers(), config = deferred(); f.gateway.getConfig = () => config.promise;
  f.frames.shift().onFrame(); await drain();
  f.owner.changeTtsRate(1.5); await drain();
  f.owner.ttsPreferenceMutationGeneration++; f.owner.ttsLanguage = 'fr-FR';
  f.owner.ttsHttpEngines = [{ id: 9, name: 'Just saved' }];
  config.resolve({ engine: 'system', rate: 4, ratePercent: 75 }); f.resolveMetadata(); await drain();
  assert.equal(f.owner.ttsState.rate, 1.5, 'late initial rate cannot overwrite real user rate method');
  assert.equal(f.owner.ttsConfig.ratePercent, 150);
  assert.equal(f.owner.ttsLanguage, 'fr-FR', 'late preferences cannot overwrite a newer user intent');
  assert.equal(f.owner.ttsHttpEngines[0].id, 9, 'late list cannot erase an acknowledged service update');
}
{
  const f = readySchedulesAfterObservers(); let available = false;
  f.host.probe = async () => ({ available, reason: 'not ready' });
  f.frames.shift().onFrame(); await drain(); assert.equal(f.owner.ttsState.status, 'unavailable');
  const coordinator = f.owner.ttsCoordinator; available = true;
  const retry = f.owner.initializeTtsSession(1, true);
  assert.strictEqual(f.owner.initializeTtsSession(1, true), retry, 'concurrent retries merge');
  await retry; assert.strictEqual(f.owner.ttsCoordinator, coordinator, 'retry retains the owner/coordinator');
  assert.equal(f.owner.ttsState.status, 'idle');
  assert.equal(f.events.filter(e => e === 'voices').length, 1, 'retry reuses still-pending optional metadata');
  assert.ok(f.host.calls.every(c => c.startsWith('engine:')), 'retry probe does not activate audio');
  f.resolveMetadata(); await drain();
}
{
  const f = fixture();
  const coordinator = new ReaderTtsSessionCoordinator(f.gateway, f.host);
  f.owner.ttsCoordinator = coordinator;
  await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 1, scalarPosition: 0 });
  f.host.emit({ type: 'start', requestId: f.host.requests[0].requestId }); await coordinator.whenSettled();
  const before = coordinator.getState(), hostCount = f.host.calls.length, coreCount = f.gateway.calls.length;
  f.owner.chapter.chapterIndex=1;
  f.owner.notifyControlSelectionReadingReady(1, 'next chapter');
  assert.equal(f.frames.length, 0); assert.deepEqual(coordinator.getState(), before);
  assert.equal(f.host.calls.length, hostCount); assert.equal(f.gateway.calls.length, coreCount);
  await coordinator.dispose();
}

// Actual SDK-generated Builder observers: the first Quick render has its
// label/play glyph/control; probing and ACK are state updates, never a new tree.
const content = readFileSync(new URL('ReaderControlTtsContent.ets', root), 'utf8');
const members = ['quickLabel', 'quickLabelActor', 'playbackLabel', 'roundControl', 'controlText', 'isActivelySpeaking',
  'hasActiveQueue', 'sharedInput', 'transport', 'p', 'frame', 'effectiveRate', 'onlineServicePage', 'isHttpEngineSelected'];
const { owner: ui } = createReaderBuilderProbe(content, members, { ...geometry, ...actors, ...state,
  readerTtsPlayGradientStart: () => '#2F6373' });
let toggles = 0;
Object.assign(ui, { appScheme: 'day', motionProgress: 0, availableWidth: 286, cachedProgress: -1, cachedWidth: -1,
  ratePreview: -1, engine: 'system', serviceTab: '', serviceBusy: false, interactionEnabled: true,
  state: { ...state.createReaderTtsState(true), rate: .75 }, onToggle: () => toggles++ });
ui.quickLabel('playback'); ui.roundControl('toggle');
const count = ui.observers.length;
const control = [...ui.nodes.values()].find(n => n.accessibilityText === '开始或继续朗读');
assert.ok(control && control.enabled && control.opacity === 1);
assert.ok([...ui.nodes.values()].some(n => n.type === 'Text' && n.create === '未开始'));
assert.ok([...ui.nodes.values()].some(n => n.type === 'Image' && n.create === 'app.media.reader_tts_make_play'));
for (const status of ['probing', 'idle', 'unavailable']) {
  ui.state = { ...ui.state, status }; ui.replay(); assert.equal(ui.observers.length, count);
}
assert.equal(control.accessibilityText, '重试朗读'); assert.equal(control.enabled, true);
control.onClick(); assert.equal(toggles, 1, 'failed warmup remains explicitly retryable');
console.log('PH44 TTS Quick preparation PASS: deferred ready/single-flight/zero audio+queue/independent metadata/obsolete+newer intent guards/active session/SDK first frame/retry; omission negative control rejected');

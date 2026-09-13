import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as autoPolicy from '../entry/src/main/ets/features/reading/ReaderAutoPageState.ts';
import { readerTtsSessionBlocksAutoPageStart } from
  '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';
import { createReaderSessionMorphGeometry, readerSessionMorphSourceKindForPage } from
  '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import { copyReaderControlSessionState } from
  '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  import.meta.url), 'utf8');
function method(name, required = true) {
  const start = source.indexOf(`  private ${name}(`);
  if (start < 0 && !required) return '';
  assert.ok(start >= 0, 'real Host method ' + name);
  const open = source.indexOf('{', start); let depth = 1, end = open + 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}
const names = ['toggleTts', 'stopTts', 'toggleAutoPage', 'startAutoPageSession', 'stopAutoPage',
  'cancelPendingAutoPageStart', 'nextAutoPageStartGeneration', 'beginSessionCapsuleMorph',
  'beginSessionCapsuleMorphFlight', 'isSessionMorphOwner', 'finishSessionCapsuleMorph', 'onControlSessionChanged'];
const helpers = ['cancelPendingTtsPlay', 'createTtsPlayIntent', 'isTtsPlayIntentCurrent',
  'captureControlPlaybackPresentation', 'isControlPlaybackPresentationCurrent'];
const dependencies = { ...autoPolicy, copyReaderControlSessionState, readerTtsSessionBlocksAutoPageStart,
  readerMotionNowMs: () => 1000,
  createReaderSessionMorphGeometry, readerSessionMorphSourceKindForPage,
  ReaderUIFrameCallback: class { constructor(callback) { this.onFrame = callback; } },
  motionAnimateParam: (_key, finish) => ({ onFinish: finish }),
  readerControlContentLocation: session => session.location,
  readerControlHostCloseCommitted: (session, revision) => session.closeRevision > revision,
  ReaderWindowCoordinator: { metrics: () => ({}) }, readerControlKeyboardVisible: () => false,
  createHiddenReaderReplaceQuickState: () => ({ kind: 'hidden' }) };
function Host(mutate = code => code) {
  const code = mutate([...names.map(name => method(name)), ...helpers.map(name => method(name, false))].join('\n'));
  return new Function(...Object.keys(dependencies), stripTypeScriptTypes(
    'class PlaybackIntentHost {' + code + '}') + '; return PlaybackIntentHost;')(...Object.values(dependencies));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function settle() { for (let n = 0; n < 8; n++) await Promise.resolve(); }
function owner(Type = Host()) {
  const host = new Type();
  const availability = deferred(), audible = deferred();
  const calls = { start: 0, pause: 0, stop: 0, hide: 0, autoTimer: 0 };
  Object.assign(host, {
    mounted: true, appForeground: true, exitRequested: false, sourceId: 'source', bookId: 'book', lifecycleToken: 1,
    chapterSelectionToken: 3, phase: 'ready', chapter: { content: '正文', chapterIndex: 4 },
    visiblePage: { startScalar: 20 }, materializedContentVersion: 'v1',
    ttsAvailabilityResolved: true, ttsPlayIntentGeneration: 0,
    ttsState: { status: 'idle', rate: 1 }, ttsLanguage: 'zh-CN', ttsPerson: 0,
    ttsPauseOnInterruption: true, ttsAllowMixing: false, ttsFailurePolicy: 'stop',
    autoPageState: autoPolicy.createReaderAutoPageState(8),
    autoPageStartGeneration: 0, autoPageStartPending: false,
    controlOpenRevision: 7, controlModuleVisitRevision: 2,
    controlSession: { closeRevision: 0, location: { level: 'secondary', module: 'tts' } },
    observedControlCloseRevision: 0, observedControlModule: 'tts', observedControlPage: 'moduleTts',
    searchGeneration: 0, replacePanelGeneration: 0,
    page: 'moduleTts', visible: true, closing: false, reduceMotion: true,
    controlObscured: false, sessionMorphPhase: 'none', sessionMorphGeneration: 0,
    isSessionActive(token) { return this.mounted && !this.exitRequested && this.lifecycleToken === token; },
    controlVisible() { return this.visible; }, controlPage() { return this.page; },
    controlShellExitArmed() { return this.closing; },
    initializeTtsSession: () => availability.promise,
    ttsChapterRef: chapter => ({ sourceId: 'source', bookId: 'book', chapterIndex: chapter.chapterIndex }),
    ttsTimerDurationMs: () => 0,
    logTtsFailure() {},
    applyWindowPolicyForChromeOwner() {},
    prepareControlPage() {}, invalidateControlBackdrop() {}, dismissControlTemporaryLayers() {},
    drainPageTurnPreparationQueue() {}, suspendAdjacentMeasurement() {},
    hideControl() { calls.hide++; this.closing = true; },
    armAutoPageTimer() { calls.autoTimer++; }, armAutoPageSessionTimer() {},
    clearAutoPageTimer() {}, clearAutoPageSessionTimer() {}, resetAutoPageSessionDuration() {},
    pauseAutoPage(reason) { this.autoPageState = autoPolicy.pauseReaderAutoPage(this.autoPageState, reason); },
    ttsCoordinator: {
      start: async () => { calls.start++; host.ttsState.status = 'preparing'; },
      whenStarted: () => audible.promise,
      pause: async () => { calls.pause++; host.ttsState.status = 'paused'; },
      resume: async () => { host.ttsState.status = 'preparing'; },
      stop: async () => { calls.stop++; host.ttsState.status = 'idle'; },
    },
  });
  return { host, calls, availability, audible };
}
function showModule(host, module) {
  host.controlSession.location = { level: 'secondary', module };
  host.page = module === 'tts' ? 'moduleTts' : module === 'autoPage' ? 'quickAutoPage' : 'quickSearch';
  host.visible = true; host.closing = false;
  host.onControlSessionChanged();
}
async function resolveAvailability(test) {
  test.host.ttsAvailabilityResolved = true;
  test.availability.resolve(true);
  await settle();
}

// Actual production callback ordering, not a copied reducer or source regex.
async function newerAutoWins(Type = Host()) {
  const test = owner(Type); test.host.ttsAvailabilityResolved = false;
  test.host.toggleTts();
  showModule(test.host, 'autoPage'); test.host.toggleAutoPage();
  assert.equal(test.host.autoPageState.status, 'running');
  await resolveAvailability(test);
  assert.equal(test.calls.start, 0, 'late TTS availability must not override a newer Auto choice');
  assert.equal(test.host.autoPageState.status, 'running');
}
async function stopBeforeAvailability(Type = Host()) {
  const test = owner(Type); test.host.ttsAvailabilityResolved = false;
  test.host.toggleTts(); test.host.stopTts(); await resolveAvailability(test);
  assert.equal(test.calls.start, 0, 'explicit Stop must cancel an unresolved TTS play intent');
}
async function lateAudibleKeepsNewControl(Type = Host(), reopen = false) {
  const test = owner(Type); test.host.toggleTts(); await settle();
  assert.equal(test.calls.start, 1);
  if (reopen) { test.host.controlOpenRevision++; showModule(test.host, 'tts'); }
  else showModule(test.host, 'search');
  test.host.ttsState.status = 'playing'; test.audible.resolve(true); await settle();
  assert.equal(test.calls.hide, 0, 'late audible start must not close a newer control presentation');
  assert.equal(test.host.ttsState.status, 'playing', 'navigation does not stop the business session');
}
async function autoStopBarrierKeepsNewControl(Type = Host()) {
  const test = owner(Type), stopped = deferred();
  test.host.ttsState.status = 'playing';
  test.host.ttsCoordinator.stop = () => { test.host.ttsState.status = 'stopping'; return stopped.promise; };
  showModule(test.host, 'autoPage'); test.host.toggleAutoPage();
  assert.equal(test.host.autoPageState.status, 'stopped', 'TTS teardown is a real start barrier');
  showModule(test.host, 'search');
  test.host.ttsState.status = 'idle'; stopped.resolve(); await settle();
  assert.equal(test.host.autoPageState.status, 'running', 'current Auto intent still starts after the barrier');
  assert.equal(test.calls.hide, 0, 'delayed Auto start must not close a newer Search presentation');
}
async function currentPlaySurvivesMorph() {
  const test = owner(); test.host.toggleTts(); await settle();
  const revision = test.host.controlModuleVisitRevision;
  const state = test.host.ttsState;
  test.host.page = 'fullTts'; test.host.onControlSessionChanged();
  test.host.page = 'moduleTts'; test.host.onControlSessionChanged();
  assert.equal(test.host.controlModuleVisitRevision, revision, 'Quick/Full is not a new module visit');
  assert.equal(test.host.ttsState, state, 'morph observation never resets playback state');
  test.host.ttsState.status = 'playing'; test.audible.resolve(true); await settle();
  assert.equal(test.calls.start, 1); assert.equal(test.calls.pause, 0);
  assert.equal(test.calls.hide, 1, 'current audible start retains the intended original control handoff');
}
function captureOwner(Type = Host()) {
  const test = owner(Type), capture = deferred(), frames = [];
  let released = 0;
  const pixel = { release() { released++; } };
  Object.assign(test.host, { reduceMotion: false,
    activeSessionCapsuleWidth: () => 94,
    sessionCapsuleLayout: () => ({ sessionX: 200, sessionY: 700 }),
    sessionMorphSourceMeasurement: () => ({ actorId: 'tts-actor', left: 20, top: 500, width: 100, height: 30 }),
    getUIContext: () => ({
      getComponentSnapshot: () => ({ get: () => capture.promise }),
      postFrameCallback: frame => frames.push(frame),
      animateTo: (_options, action) => action(),
    }),
    scheduleSessionMorphFrame() {},
  });
  return { ...test, capture, frames, pixel, releaseCount: () => released };
}
async function captureSuccessAfterNavigation() {
  const test = captureOwner(); test.host.beginSessionCapsuleMorph(); showModule(test.host, 'search');
  test.capture.resolve(test.pixel); await settle();
  assert.equal(test.releaseCount(), 1); assert.equal(test.calls.hide, 1);
  assert.equal(test.host.sessionMorphPhase, 'none', 'obsolete own capture must not leave the capsule stuck in capture');
  assert.equal(test.frames.length, 0);
}
async function captureFailureAfterNavigation() {
  const test = captureOwner(); test.host.beginSessionCapsuleMorph(); showModule(test.host, 'search');
  test.capture.reject(Error('snapshot unavailable')); await settle();
  assert.equal(test.calls.hide, 1, 'late snapshot failure must not dismiss a newer Search twice');
  assert.equal(test.host.sessionMorphPhase, 'none');
}
async function flightAfterNavigation() {
  const test = captureOwner(); test.host.beginSessionCapsuleMorph();
  test.capture.resolve(test.pixel); await settle(); assert.equal(test.frames.length, 1);
  showModule(test.host, 'search'); test.frames[0].onFrame(0);
  assert.equal(test.calls.hide, 1, 'old first flight frame must not dismiss a newer control twice');
  assert.equal(test.host.sessionMorphPhase, 'none'); assert.equal(test.releaseCount(), 1);
}
const cases = [
  ['newer Auto intent wins', () => newerAutoWins()],
  ['Stop cancels availability continuation', () => stopBeforeAvailability()],
  ['Search survives late audible start', () => lateAudibleKeepsNewControl()],
  ['reopened TTS survives old audible start', () => lateAudibleKeepsNewControl(Host(), true)],
  ['Auto stop barrier preserves newer control', () => autoStopBarrierKeepsNewControl()],
  ['latest TTS request survives Quick/Full morph', () => currentPlaySurvivesMorph()],
  ['stale snapshot success releases its phase', () => captureSuccessAfterNavigation()],
  ['stale snapshot failure preserves new control', () => captureFailureAfterNavigation()],
  ['first flight frame preserves new control', () => flightAfterNavigation()],
];
const failures = [];
for (const [name, test] of cases) {
  try { await test(); console.log('PASS ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL ' + name + ': ' + error.message); }
}
assert.deepEqual(failures, [], 'production Host asynchronous playback ownership');

// Positive and cancellation boundaries: no guard may swallow the newest play.
{
  const test = owner(); test.host.ttsAvailabilityResolved = false;
  test.host.toggleTts(); test.host.stopTts(); test.host.toggleTts();
  await resolveAvailability(test);
  assert.equal(test.calls.start, 1, 'a new explicit play after Stop is admitted once');
}
{
  const test = owner(); test.host.ttsAvailabilityResolved = false;
  test.host.toggleTts(); test.host.toggleTts(); await resolveAvailability(test);
  assert.equal(test.calls.start, 1); assert.equal(test.calls.pause, 0,
    'two unresolved taps cannot fan out into start immediately followed by pause');
}
for (const invalidate of [host => { host.mounted = false; }, host => { host.exitRequested = true; },
  host => { host.lifecycleToken++; }, host => { host.chapterSelectionToken++; },
  host => { host.sourceId = 'other'; }, host => { host.bookId = 'other'; }]) {
  const test = owner(); test.host.ttsAvailabilityResolved = false;
  test.host.toggleTts(); invalidate(test.host); await resolveAvailability(test);
  assert.equal(test.calls.start, 0, 'old availability cannot target a new reading owner');
}
{
  const test = owner(); test.host.toggleTts(); await settle();
  test.host.toggleTts(); test.audible.resolve(true); await settle();
  assert.equal(test.calls.pause, 1); assert.equal(test.calls.hide, 0,
    'Pause cancels an already queued audible-start presentation');
}
{
  const test = owner(); showModule(test.host, 'autoPage'); test.host.toggleAutoPage();
  assert.equal(test.host.autoPageState.status, 'running'); assert.equal(test.calls.hide, 1);
  const state = test.host.autoPageState;
  test.host.closing = false; test.host.page = 'fullAutoPage'; test.host.onControlSessionChanged();
  assert.equal(test.host.autoPageState, state, 'shape changes do not stop/reset Auto');
}
// Negative mutations reinject each missing protection without editing production.
const withoutIntent = code => code.replace(method('cancelPendingTtsPlay'), '  private cancelPendingTtsPlay(): void {}');
await assert.rejects(newerAutoWins(Host(withoutIntent)), /late TTS availability/);
const withoutPresentation = code => code.replace(method('isControlPlaybackPresentationCurrent'),
  '  private isControlPlaybackPresentationCurrent(): boolean { return true; }');
await assert.rejects(lateAudibleKeepsNewControl(Host(withoutPresentation)), /late audible start/);
await assert.rejects(autoStopBarrierKeepsNewControl(Host(withoutPresentation)), /delayed Auto start/);

// Snapshot/first-frame continuations own only their own image and generation.
{
  const test = captureOwner(); test.host.beginSessionCapsuleMorph();
  test.host.controlOpenRevision++; // A new opening can use exactly the same module/page.
  test.capture.resolve(test.pixel); await settle();
  assert.equal(test.releaseCount(), 1); assert.equal(test.frames.length, 0);
  assert.equal(test.host.sessionMorphPhase, 'none'); assert.equal(test.calls.hide, 1,
    'stale capture must not issue a second hide after the immediate handoff');
}
{
  const test = captureOwner(); test.host.beginSessionCapsuleMorph();
  test.capture.reject(Error('current capture failed')); await settle();
  assert.equal(test.host.sessionMorphPhase, 'none'); assert.equal(test.calls.hide, 1,
    'a current capture failure retains the existing safe capsule fallback');
}
{
  const test = captureOwner(); test.host.beginSessionCapsuleMorph();
  test.capture.resolve(test.pixel); await settle(); test.frames[0].onFrame(0);
  assert.equal(test.calls.hide, 1, 'a current first flight frame still admits the original handoff');
  assert.equal(test.host.sessionMorphPhase, 'flight'); assert.equal(test.releaseCount(), 0);
  test.host.finishSessionCapsuleMorph(); assert.equal(test.releaseCount(), 1);
}
for (const oldReply of ['resolve', 'reject']) {
  const test = captureOwner(), newer = deferred(); let newerReleased = 0;
  const newerPixel = { release() { newerReleased++; } };
  const captures = [test.capture, newer];
  test.host.getUIContext = () => ({
    getComponentSnapshot: () => ({ get: () => captures.shift().promise }),
    postFrameCallback: frame => test.frames.push(frame),
  });
  test.host.beginSessionCapsuleMorph(); test.host.finishSessionCapsuleMorph();
  test.host.beginSessionCapsuleMorph(); newer.resolve(newerPixel); await settle();
  const generation = test.host.sessionMorphGeneration;
  if (oldReply === 'resolve') test.capture.resolve(test.pixel);
  else test.capture.reject(Error('obsolete capture failure'));
  await settle();
  assert.equal(test.host.sessionMorphGeneration, generation);
  assert.equal(test.host.sessionMorphSourceImage, newerPixel);
  assert.equal(test.host.sessionMorphPhase, 'flight'); assert.equal(newerReleased, 0);
  assert.equal(test.calls.hide, 2, 'obsolete cleanup cannot hide or dispose a newer capture twice');
  assert.equal(test.releaseCount(), oldReply === 'resolve' ? 1 : 0);
  test.host.finishSessionCapsuleMorph(); assert.equal(newerReleased, 1);
}
{
  const test = captureOwner(); test.host.beginSessionCapsuleMorph();
  test.capture.resolve(test.pixel); await settle();
  const staleFrame = test.frames[0]; test.host.finishSessionCapsuleMorph();
  const newerPixel = { release() { throw Error('old frame cannot release the new image'); } };
  test.host.sessionMorphPhase = 'flight'; test.host.sessionMorphSourceImage = newerPixel;
  staleFrame.onFrame(0);
  assert.equal(test.calls.hide, 1); assert.equal(test.host.sessionMorphSourceImage, newerPixel);
}
console.log('Reader playback Host intent tests PASS; production-method execution, not device/audio acceptance');

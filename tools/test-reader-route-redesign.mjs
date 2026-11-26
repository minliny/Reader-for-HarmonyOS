import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderNavigation, retainedReaderRoute } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { downloadBookFromReadingDetail, remoteReadingSeedForShelf } from '../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import { readingEntryInputForSearchContext, readingEntrySeedForContentKind } from '../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import * as productTiming from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import { DIRECTORY_CHROME_VISUAL } from '../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';
import { readerFrameStyle } from '../entry/src/main/ets/ui/layout/ReaderFrameStyle.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { settingsNavigationItems } from '../entry/src/main/ets/features/settings/presentation/SettingsNavigationItems.ts';
import { createDownloadBookView, describeDownloadReadingTarget, downloadReadingShelfBook } from '../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';

const { READER_NAVIGATION_POP_MS, READER_NAVIGATION_PUSH_MS, READER_NAVIGATION_TAB_MS, READER_REDUCED_FADE_MS } = productTiming;
const cases = {
  'directory-reading-return': {
    description: 'Actual route owner opens reading under the detail directory and returns one level at a time.',
    resources: [],
  },
  'settings-tools-return': {
    description: 'Main tab reset, source tools stack, and priority of the current foreground Back consumer.',
    resources: [],
  },
  'settings-scroll-roundtrip': {
    description: 'Settings captures the current scroll offset before every destination. The returned Scroll receives it on first layout and ignores retired openings.',
    resources: [],
  },
  'wide-settings-panes': {
    description: 'Shared settings entries, retained ArkUI rail selection, direct wide navigation, modal exclusion, and wide root Back.',
    resources: [],
  },
  'route-transition-effects': {
    description: 'Production transition directions, parent parallax, window and policy retirement, and shared opacity-only reduced motion.',
    resources: [],
  },
  'retained-directory-back': {
    description: 'Actual directory Back bridge re-registers on the same SDK instance at readmission and fences its old lease.',
    resources: [],
  },
  'retained-route-ports': {
    description: 'Index reuses Settings and Downloads actors across navigation and scopes bookshelf ports to their runtime mount.',
    resources: [],
  },
  'download-directory-return': {
    description: 'Directory Downloads returns through the original typed detail without inventing shelf membership.',
    resources: [],
  },
  'legacy-download-chapter-return': {
    description: 'An admitted download chapter carries its projected kind through the real reading route and back without modifying the legacy shelf row.',
    resources: [],
  },
  'download-chapter-transition': {
    description: 'Download chapters publish one reader entry and silently align the underlying native stack.',
    resources: [],
  },
  'detail-cover-back': {
    description: 'Queued Detail Back resumes one reader while keeping Detail above its original parent until the replacement reader lays out.',
    resources: [],
  },
  'detail-cover-background': {
    description: 'Retained and native detail covers retire before starting after backgrounding, including late native callbacks.',
    resources: [],
  },
};

function back(navigation, destination, temporary = {}) {
  return navigation.dispatchBack({
    bookshelfGroup: () => false,
    temporaryOwner: () => undefined,
    onTemporaryFailure: error => { throw error; },
    destination,
    ...temporary,
  });
}

function directoryReadingReturn() {
  const navigation = new ReaderNavigation();
  const advance = () => navigation.advance();
  assert.equal(navigation.openLibrarySearch(advance, () => true)?.route, 'search');
  assert.equal(navigation.routeMotion(), 'push');
  assert.equal(navigation.admitDetailFrom('search', () => {
    navigation.returns.beginDetailEntry('search');
    advance();
    navigation.show(navigation.returns.completeDetailEntry('search', 'search', false));
  }), true);
  assert.equal(navigation.openDirectory('detail', () => true)?.route, 'directory');
  assert.equal(navigation.routeMotion(), 'push');
  navigation.show('reading');
  assert.equal(navigation.routeMotion(), 'push');
  assert.equal(navigation.retainsDetailDirectory(), true);
  assert.equal(navigation.returns.snapshot().readingOrigin, 'directory');

  assert.equal(back(navigation, target => {
    assert.equal(target, 'readerExit');
    assert.equal(navigation.showReadingOrigin().route, 'directory');
  }), true);
  assert.equal(navigation.snapshot().directoryReturnTarget, 'detail');
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(back(navigation, target => {
    assert.equal(target, 'directoryOrigin');
    assert.equal(navigation.closeDirectory(false, () => assert.fail('No reader exit in the restored directory'))?.route, 'detail');
  }), true);
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(back(navigation, target => {
    assert.equal(target, 'detailExit');
    navigation.returnFromDetail(undefined, {
      resumeReader: () => assert.fail('Retired reading cannot resume'),
      leaveForSearch: advance,
      restoreSearch: snapshot => assert.equal(snapshot.route, 'search'),
      showBookshelf: () => assert.fail('Detail must return to its original search'),
    });
  }), true);
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(back(navigation, target => {
    assert.equal(target, 'searchMode');
    assert.equal(navigation.returnToBookshelf(undefined, advance)?.route, 'bookshelf');
  }), true);
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(back(navigation, () => assert.fail('A root must not dispatch another app route')), false);
}

function settingsToolsReturn() {
  const navigation = new ReaderNavigation();
  const advance = () => navigation.advance();
  assert.equal(navigation.openSettingsHome().route, 'settings');
  assert.equal(navigation.settingsPane(), 'general');
  assert.equal(navigation.routeMotion(), 'tab');
  assert.equal(navigation.openSourceManagement('settings', '', advance)?.route, 'source');
  assert.equal(navigation.settingsPane(), 'source');
  assert.equal(navigation.openSourceTools(advance)?.route, 'sourceTools');
  assert.equal(navigation.settingsPane(), 'source');
  assert.equal(navigation.routeMotion(), 'push');
  let dismissed = 0;
  const covered = navigation.snapshot();
  assert.equal(back(navigation, () => assert.fail('A foreground modal must handle Back'), {
    jsonImport: () => { dismissed++; },
  }), true);
  assert.equal(dismissed, 1);
  assert.equal(navigation.snapshot(), covered);
  assert.equal(back(navigation, target => {
    assert.equal(target, 'sourceManagement');
    assert.equal(navigation.backFromSourceTools(advance)?.route, 'source');
  }), true);
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(back(navigation, target => {
    assert.equal(target, 'sourceOrigin');
    assert.equal(navigation.closeSourceManagement(false, advance)?.snapshot.route, 'settings');
  }), true);
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(navigation.settingsPane(), 'general');
  assert.equal(navigation.openBookshelfSettings(advance)?.route, 'bookshelfSettings');
  assert.equal(navigation.settingsPane(), 'bookshelfSettings');
  navigation.backFromBookshelfSettings(() => navigation.show('settings'), assert.fail);
  const intent = { kind: 'fresh', detailKey: '' };
  assert.equal(navigation.openDownloads(intent, () => undefined, advance)?.route, 'downloads');
  assert.equal(navigation.settingsPane(), 'downloads');
  navigation.show('settings');
  navigation.returnToBookshelf(undefined, advance);
  assert.equal(navigation.routeMotion(), 'tab');
  assert.equal(navigation.openBookshelfSettings(advance)?.route, 'bookshelfSettings');
  assert.equal(navigation.settingsPane(), undefined);
  navigation.backFromBookshelfSettings(assert.fail, () => navigation.show('bookshelf'));
  assert.equal(navigation.openDownloads(intent, () => undefined, advance)?.route, 'downloads');
  assert.equal(navigation.settingsPane(), undefined);
  navigation.show('bookshelf');
  navigation.openLibrarySearch(advance, () => true);
  navigation.openSourceManagement('search', 'fixture', advance);
  assert.equal(navigation.settingsPane(), undefined, 'the search-owned source journey stays standalone');
}

async function routeTransitionEffects() {
  const effect = (kind, value) => ({
    kind, value,
    animation(timing) { return effect(kind, { value, timing }); },
  });
  const TransitionEffect = {
    IDENTITY: effect('identity'),
    opacity: value => effect('opacity', value),
    translate: value => effect('translate', value),
    move: value => effect('move', value),
    asymmetric: (enter, exit) => ({ enter, exit }),
  };
  const timing = {
    'app.navigation.push': READER_NAVIGATION_PUSH_MS,
    'app.navigation.pop': READER_NAVIGATION_POP_MS,
    'app.navigation.tab': READER_NAVIGATION_TAB_MS,
  };
  const readMotion = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
  const motionSpec = pureModuleProbe(readMotion('ui/foundation/MotionSpec'), 'MotionSpec.ets', {
    ...productTiming,
    MANGA_DIRECTORY_VISUAL: DIRECTORY_CHROME_VISUAL,
    Curve: new Proxy({}, { get: (_, name) => name }),
    curves: new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) }),
  }, ['motionAnimateParam', 'motionSpecGet']);
  const motionPolicy = pureModuleProbe(readMotion('ui/foundation/ReaderMotionPolicy'), 'ReaderMotionPolicy.ets',
    motionSpec, ['readerMotionAnimateParam', 'readerMotionReducedFadeParam']);
  const { readerSceneTransition } = pureModuleProbe(
    readMotion('app/navigation/ReaderRouteMotion'), 'ReaderRouteMotion.ets', {
    TransitionEffect,
    TransitionEdge: { END: 'end' },
    ...motionSpec, ...motionPolicy,
  }, ['readerSceneTransition']);
  const reader = readerSceneTransition(400, false, true);
  const standard = { name: 'cubicBezierCurve', args: [0.2, 0, 0, 1] };
  for (const [effect, duration] of [[reader.enter, 260], [reader.exit, 240]]) {
    assert.equal(effect.kind, 'translate');
    assert.deepEqual(effect.value.value, { x: 400, y: 0 });
    assert.equal(effect.value.timing.duration, duration);
    assert.deepEqual(effect.value.timing.curve, standard);
  }
  const fadedReader = readerSceneTransition(400, true, true);
  assert.equal(fadedReader.kind, 'opacity', 'the symmetric effect fades both appearance and disappearance');
  assert.equal(fadedReader.value.value, 0);
  assert.equal(fadedReader.value.timing.duration, 120);
  for (const reduced of [false, true]) {
    assert.equal(readerSceneTransition(400, reduced, false), TransitionEffect.IDENTITY);
  }

  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const properties = createArkUIPropertyRuntimeProbe();
  const surface = readFileSync(new URL('../entry/src/main/ets/app/navigation/ReaderRouteStackSurface.ets', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../entry/src/main/ets/features/settings/ui/SettingsPage.ets', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
  const frames = [], animations = [], pathCalls = [], timers = new Map();
  const destinationBackgrounds = [];
  let buildDestinationContent;
  let motionNow = 0;
  let nextTimer = 0;
  const expireTimers = () => {
    for (const [id, timer] of timers) {
      if (timer.deadline > motionNow) continue;
      timers.delete(id);
      timer.run();
    }
  };
  class NavPathStack {
    names = [];
    nativeBusy = false;
    getAllPathName() { return [...this.names]; }
    size() { return this.names.length; }
    pushPath(entry, animate) {
      assert.equal(this.nativeBusy, false, 'the path must not change before the native acknowledgment');
      this.names.push(entry.name); pathCalls.push(['push', entry.name, animate]);
    }
    clear(animate) { this.names = []; pathCalls.push(['clear', animate]); }
    pop(animate) { this.names.pop(); pathCalls.push(['pop', animate]); }
  }
  const navigationProbe = createReaderBuilderProbe(surface, [
    'route', 'initialRoot', 'routeMotion', 'reduceMotion', 'viewportWidth', 'rootRoute', 'previousTab',
    'tabProgress', 'mounted', 'pathStack', 'routeUpdate', 'animationGeneration', 'tabGeneration', 'activeRouteAnimation',
    'pendingTabResetFrom', 'pendingPushLane', 'pendingPushTimer', 'setPendingPushLane', 'scheme', 'content', 'destination', 'lane',
    'reconcile', 'settleAnimation', 'switchRootTab', 'onRouteChanged', 'routeEndTimer',
    'clearRouteDeadline', 'armRouteDeadline', 'completeRouteAnimation',
    'finishTabTransition', 'rootTabs', 'rootTabOpacity', 'rootTabScale', 'nativeTransition',
    'laneX', 'laneDimOpacity', 'laneOpacity', 'laneVisibleDuringReaderCover', 'laneAcceptsInput',
    'aboutToAppear', 'aboutToDisappear', 'backGestureEnabled', 'hasDestination',
    'readerCoverGeneration', 'readerCoverStartGeneration', 'readerCoverSettled', 'onReaderCovered',
    'onReaderCoverChanged', 'settleReaderCover', 'revealRetainedDetail', 'readerCoverCanAnimate',
    'retireStaleReaderCover', 'finishReaderCoverAnimation',
    'preview', 'beginPreview', 'updatePreview', 'endPreview', 'resolvePreview', 'applyPreviewResult',
  ], {
    ...properties.sdk,
    Color: { Transparent: '#00000000', Black: '#FF000000' },
    NavDestination: {
      name: 'NavDestination',
      create(builder) { buildDestinationContent = builder; },
      pop() {},
      hideTitleBar() {},
      hideToolBar() {},
      ignoreLayoutSafeArea() {},
      onBackPressed() {},
      backgroundColor(color) { destinationBackgrounds.push(color); },
    },
    NavPathStack,
    NavigationOperation: { PUSH: 'push', POP: 'pop' },
    ROOT_LANE: 'reader-route-root',
    RETAINED_READER_LANE: 'retained-reader',
    NATIVE_START_TIMEOUT_MS: Number(surface.match(/^const NATIVE_START_TIMEOUT_MS = (\d+);$/m)?.[1]),
    NATIVE_END_GRACE_MS: Number(surface.match(/^const NATIVE_END_GRACE_MS = (\d+);$/m)?.[1]),
    PREVIEW_END_TIMEOUT_MS: Number(surface.match(/^const PREVIEW_END_TIMEOUT_MS = (\d+);$/m)?.[1]),
    EDGE_BACK_COMMIT_FRACTION: 0.33,
    Curve: { Linear: 'linear' },
    READER_ROUTE_PARENT_DIM: 0.04, READER_ROUTE_PARENT_PARALLAX: 0.16,
    readerMotionNowMs: () => motionNow,
    motionSpecGet: id => ({ durationMs: timing[id] ?? 120 }),
    motionAnimateParam: (id, onFinish) => ({ duration: timing[id], onFinish }),
    readerMotionReducedFadeParam: onFinish => ({ duration: 120, onFinish }),
    setTimeout(run, delay) { timers.set(++nextTimer, { run, deadline: motionNow + delay }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    ReaderPostLayoutFrame: class { constructor(_context, run) { this.run = run; } },
    uiContext: {
      postFrameCallback: frame => frames.push(frame),
      animateTo(params, mutate) { animations.push(params); mutate(); },
    },
  }, properties.hooks);
  const host = navigationProbe.owner;
  Object.assign(host, { route: 'bookshelf', routeMotion: 'push', viewportWidth: 400,
    animationGeneration: 0, tabGeneration: 0 });
  host.aboutToAppear();
  for (const reduceMotion of [false, true]) {
    const directory = new navigationProbe.Component(undefined, { route: 'detail', viewportWidth: 400, reduceMotion });
    directory.aboutToAppear();
    directory.route = 'directory';
    directory.routeMotion = 'push';
    directory.reconcile();
    assert.equal(directory.laneX('directory'), 400, 'the directory must be offscreen before the native push starts');
    assert.equal(directory.laneOpacity('directory'), reduceMotion ? 0 : 1);
    assert.equal(directory.laneX('reader-route-root'), 0, 'the outgoing detail remains in place');
    motionNow += 300;
    expireTimers();
    assert.equal(directory.laneX('directory'), 0, 'a missing native start must release the directory');
    assert.equal(directory.laneOpacity('directory'), 1);
  }
  for (const retire of ['silent-reconcile', 'unmount']) {
    const directory = new navigationProbe.Component(undefined, { route: 'detail', viewportWidth: 400 });
    directory.aboutToAppear();
    directory.route = 'directory';
    directory.routeMotion = 'push';
    directory.reconcile();
    if (retire === 'unmount') directory.aboutToDisappear();
    else {
      directory.routeMotion = 'none';
      directory.reconcile();
    }
    assert.equal(directory.laneX('directory'), 0, retire);
    assert.equal(timers.size, 0, retire);
  }
  host.route = 'detail';
  host.reconcile();
  assert.deepEqual(pathCalls.at(-1), ['push', 'detail', true]);
  assert.deepEqual(host.rootTabs(), ['bookshelf'], 'a detail push keeps the bookshelf in the native root');
  let native = host.nativeTransition({}, { name: 'detail' }, 'push');
  assert.equal(host.laneX('detail'), 400, 'the native factory can return before its proxy arrives');
  native.transition({});
  assert.equal(host.progress, 0, 'the native start pose is visible for a frame');
  assert.equal(animations.length, 0, 'animating in the same turn collapses the start pose');
  host.content = () => {};
  for (const [scheme, color] of [['day', '#FFF4EFE6'], ['night', '#FF151715']]) {
    host.scheme = scheme;
    host.destination('detail');
    buildDestinationContent();
    const lane = [...host.nodes.values()].findLast(node => node.type === 'Stack');
    assert.equal(destinationBackgrounds.at(-1), '#00000000', 'the static native wrapper cannot mask the previous page');
    assert.equal(lane.backgroundColor, color, 'the full-size animated lane paints the current theme behind its contents');
    assert.deepEqual([lane.width, lane.height, lane.translate.x], ['100%', '100%', 400]);
  }
  frames.shift().run();
  host.progress = .5;
  assert.equal(host.laneX('reader-route-root'), -32);
  assert.equal(host.laneDimOpacity('reader-route-root'), .02);
  assert.equal(host.laneX('detail'), 200);
  native.onTransitionEnd(true);

  for (const reduceMotion of [false, true]) {
    const cover = new navigationProbe.Component(undefined, { route: 'directory', initialRoot: 'bookshelf', viewportWidth: 400, reduceMotion });
    cover.aboutToAppear();
    cover.pathStack.names = ['detail', 'directory'];
    cover.readerCoverGeneration = 1;
    let readerCovered = 0;
    cover.onReaderCovered = generation => { assert.equal(generation, 1); readerCovered += 1; cover.readerCoverGeneration = undefined; };
    cover.route = 'detail';
    cover.routeMotion = 'push';
    cover.reconcile();
    assert.deepEqual(pathCalls.at(-1), ['push', 'detail', true], 'detail covers the reader even with an existing detail ancestor');
    assert.equal(cover.laneVisibleDuringReaderCover('bookshelf', 'reader-route-root'), false);
    assert.equal(cover.laneVisibleDuringReaderCover('directory', 'directory'), false);
    assert.equal(readerCovered, 0, 'the reader stays visible until the native detail destination covers it');
    const detailPush = cover.nativeTransition({ name: 'directory' }, { name: 'detail', param: { readerCoverGeneration: 1 } }, 'push');
    detailPush.transition({});
    assert.equal(cover.laneVisibleDuringReaderCover('detail', 'detail'), true);
    assert.equal(cover.laneAcceptsInput('detail'), false);
    assert.equal(cover.laneX('detail'), reduceMotion ? 0 : 400);
    assert.equal(cover.laneOpacity('detail'), reduceMotion ? 0 : 1);
    assert.equal(cover.laneDimOpacity('directory'), 0, 'there is no second dim on the outgoing app lane');
    frames.shift().run();
    assert.equal(animations.at(-1).duration, reduceMotion ? 120 : 260);
    detailPush.onTransitionEnd(true);
    assert.equal(readerCovered, 1);
    assert.equal(cover.laneAcceptsInput('detail'), true);

    const retained = new navigationProbe.Component(undefined, { route: 'detail', initialRoot: 'bookshelf', viewportWidth: 400, reduceMotion });
    retained.aboutToAppear();
    const stablePath = retained.pathStack.getAllPathName();
    retained.readerCoverGeneration = 2;
    retained.onReaderCovered = generation => { assert.equal(generation, 2); readerCovered += 1; retained.readerCoverGeneration = undefined; };
    retained.routeMotion = 'push';
    retained.reconcile();
    assert.deepEqual(retained.pathStack.getAllPathName(), stablePath, 'an existing top detail is animated without a second native route');
    assert.equal(retained.laneVisibleDuringReaderCover('detail', 'detail'), true);
    assert.equal(retained.laneX('detail'), reduceMotion ? 0 : 400);
    assert.equal(retained.laneOpacity('detail'), reduceMotion ? 0 : 1);
    retained.settleReaderCover(retained.readerCoverGeneration - 1);
    assert.equal(readerCovered, 1, 'the existing detail also needs to finish its reveal');
    frames.shift().run();
    assert.equal(animations.at(-1).duration, reduceMotion ? 120 : 260);
    animations.at(-1).onFinish();
    assert.equal(readerCovered, 2);
  }

  native = host.nativeTransition({ name: 'settings-general' }, { name: 'settings-developer' }, 'push');
  native.transition({});
  frames.shift().run();
  assert.equal(animations.at(-1).duration, READER_NAVIGATION_PUSH_MS);
  native.onTransitionEnd(true);
  native = host.nativeTransition({ name: 'settings-developer' }, { name: 'settings-general' }, 'pop');
  native.transition({});
  frames.shift().run();
  assert.equal(animations.at(-1).duration, 240);
  native.onTransitionEnd(true);
  host.reduceMotion = true;
  native = host.nativeTransition({ name: 'settings-developer' }, { name: 'settings-general' }, 'pop');
  native.transition({});
  frames.shift().run();
  assert.equal(animations.at(-1).duration, 120);
  host.progress = .5;
  assert.equal(host.laneX('settings-developer'), 0);
  assert.equal(host.laneOpacity('settings-developer'), .5);
  assert.equal(host.laneOpacity('settings-general'), 1);
  native.onTransitionEnd(true);
  const tabs = new navigationProbe.Component(undefined, { route: 'bookshelf' });
  tabs.aboutToAppear();
  tabs.route = 'settings'; tabs.routeMotion = 'tab'; tabs.reconcile();
  assert.deepEqual(tabs.rootTabs(), ['bookshelf', 'settings'], 'the previous tab paints beneath the incoming tab');
  assert.equal(tabs.rootTabOpacity('bookshelf'), 1);
  assert.equal(tabs.rootTabOpacity('settings'), .72);
  assert.equal(tabs.rootTabScale('settings'), .992);
  frames.shift().run();
  assert.equal(animations.at(-1).duration, 180);
  animations.at(-1).onFinish();
  assert.deepEqual(tabs.rootTabs(), ['settings'], 'tab completion retires only the previous root');
  tabs.reduceMotion = true;
  tabs.route = 'bookshelf'; tabs.reconcile();
  assert.deepEqual(tabs.rootTabs(), ['settings', 'bookshelf']);
  assert.equal(tabs.rootTabOpacity('settings'), 1);
  assert.equal(tabs.rootTabOpacity('bookshelf'), 0);
  frames.shift().run();
  assert.equal(animations.at(-1).duration, READER_REDUCED_FADE_MS);
  animations.at(-1).onFinish();
  assert.deepEqual(tabs.rootTabs(), ['bookshelf']);

  for (const reduceMotion of [false, true]) {
    const rightPane = new navigationProbe.Component(undefined, { route: 'source', viewportWidth: 400, reduceMotion });
    rightPane.aboutToAppear();
    rightPane.route = 'sourceTools'; rightPane.routeMotion = 'push'; rightPane.reconcile();
    const toolsPush = rightPane.nativeTransition({}, { name: 'sourceTools' }, 'push');
    toolsPush.transition({});
    frames.shift().run();
    toolsPush.onTransitionEnd(true);
    rightPane.route = 'downloads'; rightPane.routeMotion = 'tab'; rightPane.reconcile();
    assert.deepEqual(pathCalls.at(-1), ['clear', true], 'the native top participates in the tab handoff');
    assert.deepEqual(rightPane.rootTabs(), ['downloads'], 'the old tab root cannot paint in place of the top child');
    const childToTab = rightPane.nativeTransition({ name: 'sourceTools' }, {}, 'pop');
    assert.equal(childToTab.isInteractive, false);
    childToTab.transition({});
    assert.equal(rightPane.laneX('sourceTools'), 0);
    assert.equal(rightPane.laneOpacity('sourceTools'), 1, 'the actual old child owns the first frame');
    assert.equal(rightPane.laneOpacity('reader-route-root'), 1);
    frames.shift().run();
    assert.equal(animations.at(-1).duration, reduceMotion ? READER_REDUCED_FADE_MS : READER_NAVIGATION_TAB_MS);
    rightPane.progress = .5;
    assert.equal(rightPane.laneOpacity('sourceTools'), .5);
    assert.equal(rightPane.laneOpacity('reader-route-root'), 1, 'the new tab stays opaque below the outgoing child');
    childToTab.onTransitionEnd(true);
    assert.deepEqual(rightPane.rootTabs(), ['downloads']);
    assert.deepEqual(rightPane.pathStack.getAllPathName(), [], 'the new tab is the native root for future child routes');
  }

  const rapid = new navigationProbe.Component(undefined, { route: 'sourceTools', initialRoot: 'source', viewportWidth: 400 });
  rapid.aboutToAppear();
  rapid.route = 'downloads'; rapid.routeMotion = 'tab'; rapid.reconcile();
  const callsBeforeNativeStart = pathCalls.length;
  rapid.route = 'settings-about'; rapid.reconcile();
  assert.equal(pathCalls.length, callsBeforeNativeStart, 'a new tab cannot issue a second native operation before the first is observed');
  assert.deepEqual(rapid.rootTabs(), ['settings-about'], 'only the latest incoming root paints under the actual departing child');
  assert.equal(frames.length, 0, 'a second tab does not run a competing root animation');
  rapid.route = 'settings-developer'; rapid.routeMotion = 'push'; rapid.reconcile();
  assert.equal(pathCalls.length, callsBeforeNativeStart, 'child work waits for the native tab operation to finish');
  const rapidTab = rapid.nativeTransition({ name: 'sourceTools' }, {}, 'pop');
  rapidTab.transition({});
  assert.equal(rapid.laneX('sourceTools'), 0, 'late acknowledgment still uses a tab fade');
  frames.shift().run();
  assert.equal(animations.at(-1).duration, READER_NAVIGATION_TAB_MS);
  rapidTab.onTransitionEnd(true);
  await Promise.resolve();
  assert.deepEqual(pathCalls.at(-1), ['push', 'settings-developer', true]);

  const lostStart = new navigationProbe.Component(undefined, { route: 'sourceTools', initialRoot: 'source' });
  lostStart.aboutToAppear();
  lostStart.route = 'downloads'; lostStart.routeMotion = 'tab'; lostStart.reconcile();
  lostStart.route = 'settings-developer'; lostStart.routeMotion = 'push'; lostStart.reconcile();
  assert.deepEqual(pathCalls.at(-1), ['clear', true]);
  motionNow += 1000;
  expireTimers();
  await Promise.resolve();
  assert.deepEqual(pathCalls.at(-1), ['push', 'settings-developer', true], 'a missing native start releases the latest route');
  assert.equal(timers.size, 1, 'only the newly pushed destination awaits its first frame');
  motionNow += 300;
  expireTimers();
  assert.equal(timers.size, 0, 'both missing native starts retire their deadlines');
  const callsAfterFallback = pathCalls.length;
  await Promise.resolve();
  assert.equal(pathCalls.length, callsAfterFallback, 'the fallback performs no repeated path mutations');

  const handoff = new navigationProbe.Component(undefined, { route: 'settings', viewportWidth: 400 });
  handoff.aboutToAppear();
  handoff.route = 'source'; handoff.routeMotion = 'push'; handoff.reconcile();
  handoff.route = 'settings'; handoff.routeMotion = 'pop'; handoff.reconcile();
  const returning = handoff.nativeTransition({ name: 'source' }, {}, 'pop');
  let finishes = 0;
  const proxy = { finishTransition() { finishes++; } };
  handoff.pathStack.nativeBusy = true;
  handoff.route = 'bookshelfSettings'; handoff.routeMotion = 'push'; handoff.reconcile();
  assert.deepEqual(handoff.pathStack.getAllPathName(), [], 'a requested native transition fences navigation before its proxy arrives');
  returning.transition(proxy);
  frames.shift().run();
  const oldMotion = animations.at(-1);
  handoff.reconcile();
  assert.equal(finishes, 0, 'a queued destination waits without settling the current pop early');
  oldMotion.onFinish();
  assert.equal(finishes, 1, 'a new action cannot finish the still-unacknowledged pop twice');
  assert.deepEqual(handoff.pathStack.getAllPathName(), []);
  handoff.pathStack.nativeBusy = false;
  returning.onTransitionEnd(true);
  await Promise.resolve();
  assert.deepEqual(handoff.pathStack.getAllPathName(), ['bookshelfSettings'], 'the immediate tap reaches the native stack after the pop');
  returning.transition(proxy);
  oldMotion.onFinish();
  assert.equal(finishes, 1, 'stale completion callbacks cannot settle the old proxy again');

  const timeout = handoff.nativeTransition({}, { name: 'bookshelfSettings' }, 'push');
  timeout.transition(proxy);
  frames.shift().run();
  motionNow += timeout.timeout;
  animations.at(-1).onFinish();
  assert.equal(finishes, 1, 'the app cannot settle an expired native transition while its end acknowledgement is pending');
  handoff.route = 'downloads'; handoff.routeMotion = 'push'; handoff.reconcile();
  assert.deepEqual(handoff.pathStack.getAllPathName(), ['bookshelfSettings']);
  motionNow += 100;
  expireTimers();
  await Promise.resolve();
  assert.deepEqual(handoff.pathStack.getAllPathName(), ['bookshelfSettings', 'downloads'],
    'a missing native end acknowledgement must release the latest navigation request after the deadline');
  const replacement = handoff.nativeTransition({ name: 'bookshelfSettings' }, { name: 'downloads' }, 'push');
  const replacementAnimation = handoff.activeRouteAnimation;
  timeout.onTransitionEnd(false);
  assert.equal(handoff.activeRouteAnimation, replacementAnimation, 'late native end cannot release a newer transition');
  replacement.onTransitionEnd(true);
  await Promise.resolve();

  const drag = new navigationProbe.Component(undefined, { route: 'settings', viewportWidth: 400, backGestureEnabled: true });
  drag.aboutToAppear();
  drag.route = 'source'; drag.routeMotion = 'push'; drag.reconcile();
  drag.beginPreview(40);
  const interactive = drag.nativeTransition({ name: 'source' }, {}, 'pop');
  assert.equal(interactive.isInteractive, true);
  assert.equal(timers.size, 0, 'an active touch can hold the interactive transition');
  let cancels = 0;
  interactive.transition({ cancelTransition() { cancels++; drag.pathStack.names = ['source']; } });
  drag.endPreview(40);
  motionNow += 1000;
  expireTimers();
  await Promise.resolve();
  assert.equal(cancels, 1, 'cancel can settle the native proxy even if its first paint callback went missing');
  assert.equal(drag.preview, undefined);
  assert.equal(drag.activeRouteAnimation, undefined);
  frames.shift().run();
  interactive.onTransitionEnd(false);
  assert.equal(cancels, 1);

  const wide = new navigationProbe.Component(undefined, { route: 'settings-general', initialRoot: 'settings-home' });
  wide.aboutToAppear();
  assert.deepEqual(wide.rootTabs(), ['settings-home'], 'wide direct entry keeps the same settings root');
  assert.deepEqual(wide.pathStack.getAllPathName(), ['settings-general']);
  assert.deepEqual(pathCalls.at(-1), ['push', 'settings-general', false], 'initial wide entry avoids a second animation');

  const routeOwner = new ReaderNavigation();
  const parentProperties = createArkUIPropertyRuntimeProbe();
  let viewportWidth = 400;
  let viewportHeight = 800;
  const indexOwner = createReaderBuilderProbe(index, [
    'appRouteLane', 'publishNavigation', 'updateReaderParentMotion', 'readerParentMotionProgress', 'detailAboveReader', 'readerDetailCoverGeneration',
    'readerParentAnimated', 'readerParentAnimation', 'readerWindowMetricsRevision', 'searchAppForeground', 'appReduceMotion',
    'readerParentAnimationGeneration', 'readerParentAnimationViewport', 'readerParentViewportMatches', 'routeViewport',
  ], { retainedReaderRoute, ...motionSpec, ...parentProperties.sdk,
    ReaderWindowCoordinator: { metrics: () => ({ windowRect: { width: viewportWidth, height: viewportHeight } }) },
  }, parentProperties.hooks).owner;
  Object.assign(indexOwner, { route: 'search', wideSettingsPane: () => undefined,
    navigationOwner: routeOwner, searchAppForeground: true, visibleRouteMotion: 'none',
    readerParentProgress: 0,
    getUIContext: () => ({ animateTo() { assert.fail('route publication must not animate unrelated page layout'); } }),
    bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: { dismiss() {} },
    readingEntry: { book: { sourceId: 'local', bookId: 'book' } }, shelfGroupPresentation: { retire() {} },
    transientFeedback: { reset() {} }, libraryAcquisition: { currentOwner: () => undefined },
    bookshelfModalVisible: () => false });
  assert.equal(indexOwner.appRouteLane(), 'bookshelf', 'the shelf and editor share one lane');
  indexOwner.route = 'reading';
  assert.equal(indexOwner.appRouteLane(), 'detail', 'the reader paints above its real Detail origin');
  routeOwner.returns.rememberBookshelfReaderOrigin();
  indexOwner.route = 'bookshelf';
  indexOwner.publishNavigation(routeOwner.show('reading'));
  assert.equal(indexOwner.visibleRouteMotion, 'push');
  assert.equal(indexOwner.appRouteLane(), 'bookshelf', 'the shelf stays under the reader during native motion');
  assert.equal(indexOwner.readerParentMotionProgress(), 1);
  const pushAnimation = indexOwner.readerParentAnimation();
  assert.equal(pushAnimation?.duration, 260);
  indexOwner.readerWindowMetricsRevision += 1;
  assert.equal(indexOwner.readerParentAnimation()?.duration, 260, 'a same-size metrics update does not cancel the transition');
  viewportHeight = 640;
  assert.equal(indexOwner.readerParentAnimation(), null, 'a height-only resize cannot inherit the previous push');
  indexOwner.readerWindowMetricsRevision += 1;
  assert.equal(indexOwner.readerParentAnimated, false);
  assert.equal(indexOwner.readerParentMotionProgress(), 1, 'resizing keeps the current parent displacement');
  viewportHeight = 800;
  indexOwner.readerWindowMetricsRevision += 1;
  assert.equal(indexOwner.readerParentAnimation(), null, 'restoring the previous height cannot revive the push');
  indexOwner.publishNavigation(routeOwner.showReadingOrigin());
  assert.equal(indexOwner.route, 'bookshelf');
  assert.equal(indexOwner.visibleRouteMotion, 'pop');
  assert.equal(indexOwner.appRouteLane(), 'bookshelf');
  assert.equal(indexOwner.readerParentMotionProgress(), 0);
  const popAnimation = indexOwner.readerParentAnimation();
  assert.equal(popAnimation?.duration, 240);
  pushAnimation.onFinish();
  assert.equal(indexOwner.readerParentAnimation()?.duration, 240, 'late push completion cannot retire the pending pop');
  popAnimation.onFinish();
  assert.equal(indexOwner.readerParentAnimation(), null, 'a completed pop retires its animation');
  indexOwner.publishNavigation(routeOwner.show('reading'));
  assert.equal(indexOwner.readerParentAnimation()?.duration, 260);
  viewportWidth = 680;
  indexOwner.readerWindowMetricsRevision += 1;
  assert.equal(indexOwner.readerParentAnimated, false, 'changing width also retires the push');
  indexOwner.publishNavigation(routeOwner.showReadingOrigin());
  for (const [field, interrupted] of [['searchAppForeground', false], ['appReduceMotion', true]]) {
    indexOwner.publishNavigation(routeOwner.show('reading'));
    const interruptedPush = indexOwner.readerParentAnimation();
    assert.equal(interruptedPush?.duration, 260);
    indexOwner[field] = interrupted;
    assert.equal(indexOwner.readerParentAnimated, false, `${field} must retire the interrupted push`);
    assert.equal(indexOwner.readerParentAnimation(), null);
    indexOwner[field] = !interrupted;
    assert.equal(indexOwner.readerParentMotionProgress(), 1, 'the open reader retains its settled displacement');
    assert.equal(indexOwner.readerParentAnimation(), null, `restoring ${field} cannot replay the interrupted push`);
    indexOwner.publishNavigation(routeOwner.showReadingOrigin());
    const nextPop = indexOwner.readerParentAnimation();
    assert.equal(nextPop?.duration, 240);
    interruptedPush.onFinish();
    assert.equal(indexOwner.readerParentAnimation()?.duration, 240, 'an old finish callback cannot retire the next pop');
    nextPop.onFinish();
  }
  for (const policy of [{ appReduceMotion: true }, { searchAppForeground: false }]) {
    Object.assign(indexOwner, policy);
    indexOwner.publishNavigation(routeOwner.show('reading'));
    assert.equal(indexOwner.readerParentMotionProgress(), 0);
    assert.equal(indexOwner.readerParentAnimation(), null);
    indexOwner.publishNavigation(routeOwner.showReadingOrigin());
    assert.equal(indexOwner.readerParentAnimation(), null);
    Object.assign(indexOwner, { appReduceMotion: false, searchAppForeground: true });
  }
  routeOwner.returns.completeDetailEntry('bookshelf', undefined, false);
  indexOwner.publishNavigation(routeOwner.show('detail'));
  indexOwner.publishNavigation(routeOwner.show('reading'));
  assert.equal(indexOwner.readerParentAnimation()?.duration, 260);
  indexOwner.publishNavigation(routeOwner.show('detail', 'push'));
  assert.equal(indexOwner.readerDetailCover, true, 'reader book information is a foreground push even when its host lane was detail');
  assert.equal(indexOwner.detailAboveReader(), true);
  assert.equal(indexOwner.readerParentAnimation(), null, 'the reader-to-detail cover has no extra parent animation');
  assert.equal(indexOwner.readerParentMotionProgress(), 0);
  routeOwner.returns.rememberDirectoryReaderOrigin();
  indexOwner.route = 'directory'; indexOwner.directoryReturnTarget = 'readerControl';
  assert.equal(indexOwner.appRouteLane(), 'directory', 'the reader control catalog keeps the same underlying origin');
  indexOwner.directoryReturnTarget = 'detail';
  assert.equal(indexOwner.appRouteLane(), 'directory', 'detail catalog owns a separate push/pop lane');
  indexOwner.route = 'reading';
  assert.equal(indexOwner.appRouteLane(), 'directory', 'an open from Detail catalog never pushes an empty reader lane');
  indexOwner.route = 'detail';
  assert.equal(indexOwner.appRouteLane(), 'detail');
  assert.match(index, /ReaderRouteStackSurface\(\{\s*route: this\.appRouteLane\(\)/);
  assert.match(index, /\}\)\.transition\(readerSceneTransition\(this\.routeViewportWidth\(\), this\.appReduceMotion, this\.readerSceneMotionEnabled\(\)\)\)/);
  assert.match(index, /Column\(\)\.opacity\(this\.readerParentMotionProgress\(\) \* READER_ROUTE_PARENT_DIM\)\s*\.animation\(this\.readerParentAnimation\(\)\)/);
  assert.match(index, /\}\.translate\(\{ x: -this\.routeViewportWidth\(\) \* READER_ROUTE_PARENT_PARALLAX \* this\.readerParentMotionProgress\(\) \}\)\s*\.animation\(this\.readerParentAnimation\(\)\)/);
  const readerShell = readMotion('features/reading/ui/ReaderShell');
  const shell = createReaderBuilderProbe(readerShell, ['frameStyle'], { readerFrameStyle }).owner;
  Object.assign(shell, { chromeUnderlayColor: '#FFF2E9D7', contentKind: 'text' });
  assert.equal(shell.frameStyle().backgroundColor, '#FFF2E9D7');
  assert.match(readerShell, /ReaderPageScaffold\(\{ frameStyle: this\.frameStyle\(\)/);
  const surfaceIds = [...index.matchAll(/surfaceId: '(reader-[^']+-stack)'/g)].map(match => match[1]);
  assert.equal(surfaceIds.length, 2);
  const settingsOwner = createReaderBuilderProbe(settings, ['settingsSubroute', 'settingsRouteBack', 'settingsStackSurfaceId']).owner;
  Object.assign(settingsOwner, { activeSection: 'general', settingsInputIsCurrent: () => true, temporaryBackIdentity: 'lease',
    aboutPageId: '', developerPageId: 'developer', messagePreviewId: 'preview' });
  settingsOwner.embeddedWide = false;
  assert.equal(settingsOwner.settingsStackSurfaceId(), 'reader-settings-subroute-stack');
  surfaceIds.push(settingsOwner.settingsStackSurfaceId());
  settingsOwner.embeddedWide = true;
  assert.equal(settingsOwner.settingsStackSurfaceId(), 'reader-wide-settings-general-subroute-stack');
  surfaceIds.push(settingsOwner.settingsStackSurfaceId());
  settingsOwner.activeSection = 'about';
  assert.equal(settingsOwner.settingsStackSurfaceId(), 'reader-wide-settings-about-subroute-stack');
  surfaceIds.push(settingsOwner.settingsStackSurfaceId());
  assert.equal(new Set(surfaceIds).size, surfaceIds.length, 'retained nested stacks have distinct surface IDs');
  settingsOwner.embeddedWide = false;
  settingsOwner.activeSection = 'general';
  assert.equal(settingsOwner.settingsSubroute(), 'settings-message-preview');
  settingsOwner.consumeTemporaryBack = () => { settingsOwner.messagePreviewId = ''; return true; };
  assert.equal(settingsOwner.settingsRouteBack(), true);
  assert.equal(settingsOwner.settingsSubroute(), 'settings-developer');
  assert.match(settings, /ReaderRouteStackSurface\(\{\s*route: this\.settingsSubroute\(\)/);
}

async function settingsScrollRoundtrip() {
  const { createRequire } = await import('node:module');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const file = path => new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url);
  const read = path => readFileSync(file(path), 'utf8');
  const settingsPage = read('features/settings/ui/SettingsPage');
  const settingsShell = read('features/settings/ui/SettingsShell');
  const mainShell = read('features/shell/MainTabShell');
  const standardPage = read('ui/layout/ReaderStandardPage');
  const scrollHost = read('ui/layout/ReaderPageScrollHost');
  class Child {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  const children = { SettingsPage: settingsPage, SettingsShell: settingsShell,
    MainTabShell: mainShell, ReaderStandardPage: standardPage, ReaderPageScrollHost: scrollHost,
    ReaderPageScaffold: read('ui/layout/ReaderPageScaffold'),
    BookshelfSettingsPage: read('features/bookshelf/ui/BookshelfSettingsPage'),
    PageBackBar: read('ui/chrome/PageBackBar'), AppTopBar: read('ui/chrome/AppTopBar'),
    ReaderBottomNavigation: read('app/navigation/ReaderBottomNavigation'),
    MainNavigationOverlay: read('features/shell/MainNavigationOverlay'),
    CategorySection: read('features/settings/ui/CategorySection'),
    ReaderMessagePreviewPage: read('features/settings/ui/ReaderMessagePreviewPage'),
    ReaderRecoveryGroup: read('ui/feedback/ReaderRecoveryGroup') };
  const syntax = createRequire(import.meta.url)(`${installedEtsCompiler().root}/lib/validate_ui_syntax.js`);
  syntax.builderParamObjectCollection.set('CategorySection',
    new Set([...children.CategorySection.matchAll(/@BuilderParam\s+(\w+)/g)].map(match => match[1])));
  const render = (source, members, values, bindings = {}, builder = 'build', args = []) => {
    const properties = createArkUIPropertyRuntimeProbe();
    const probe = createReaderBuilderProbe(source, members,
      { ...properties.sdk, ...Object.fromEntries(Object.keys(children).map(name => [name, Child])), ...bindings },
      { ...properties.hooks, childSources: children, allowEmptyBranchAdmission: true });
    Object.assign(probe.owner, values);
    if (builder === 'build') probe.owner.initialRender();
    else probe.owner[builder](...args);
    return probe.owner;
  };
  const onlyChild = (owner, property) => [...owner.children.values()].find(child => property in child.params)?.params;
  const { SettingsPresentation } = pureModuleProbe(read('features/settings/presentation/SettingsPresentation'),
    'SettingsPresentation.ets', { Observed: value => value, createDefaultSettingsSnapshot: () => ({}) }, ['SettingsPresentation']);
  const { ReaderSettingsJourney } = pureModuleProbe(read('app/composition/ReaderSettingsJourney'),
    'ReaderSettingsJourney.ets', {}, ['ReaderSettingsJourney']);
  const navigation = new ReaderNavigation();
  const owner = {};
  const presentation = new SettingsPresentation();
  let hostIdentity = '';
  presentation.host = {
    bindPresentation(_owner, identity) { hostIdentity = identity; return true; },
    detachPresentation(identity) { if (hostIdentity === identity) hostIdentity = ''; },
    isPresentationCurrent(_owner, identity) { return hostIdentity === identity; },
    cacheCleanupSnapshot() {},
    open() {},
  };
  presentation.reconcileCache = async () => {};
  const advance = () => { presentation.retire(); navigation.advance(); };
  const journey = new ReaderSettingsJourney(navigation, {
    scope: () => ({ owner, instance: 1, mounting: 1, retired: false, inputAllowed: true }),
    ownsRuntime: runtime => runtime === owner, settings: () => presentation,
    reading: () => ({ endReading() {} }), advance, publish() {},
  });
  const mountScene = () => render(read('app/composition/SettingsScenes'), ['settings', 'open', 'inputIsCurrent'], {
    presentation, route: 'settings', section: 'home', generation: navigation.snapshot().generation,
    isInputAllowed: () => navigation.snapshot().route === 'settings',
    onSectionChange: section => navigation.setSettingsSection(section),
    onOpen: destination => destination === 'source' ? navigation.openSourceManagement('settings', '', advance) :
      navigation.openDownloads({ kind: 'fresh', detailKey: '' }, () => undefined, advance),
  }, {}, 'settings', [presentation.identity]);
  journey.openSettings();
  const first = onlyChild(mountScene(), 'onOpenDownloads');
  assert.equal(first.homeScrollY, 0);

  const scroller = { currentOffset: () => ({ xOffset: 0, yOffset: 186.5 }) };
  const navigateFromMenu = (params, title) => {
    const actions = new Map();
    const menu = render(settingsPage, ['buildHome', 'openHomeDestination'], {
      ...params, homeScroller: scroller, operationFeedback() {},
      navRow: (label, _icon, action) => actions.set(label, action),
    }, { settingsNavigationItems }, 'buildHome');
    onlyChild(menu, 'title').content();
    actions.get(title)();
  };
  navigateFromMenu(first, '书源管理');
  assert.equal(navigation.snapshot().route, 'source');
  assert.equal(presentation.identity, '', 'native Settings can be removed while its offset is retained');
  assert.equal(presentation.homeScrollY, 186.5);
  first.onHomeScrollDeparture(999);
  assert.equal(presentation.homeScrollY, 186.5, 'retired viewport cannot overwrite the saved offset');

  journey.returnToSettings();
  const restored = onlyChild(mountScene(), 'onOpenDownloads');
  assert.equal(restored.homeScrollY, 186.5);
  const settings = render(settingsPage, ['settingsPageContent'], {
    ...restored, homeScroller: scroller, settingsSubroute: () => 'settings-home',
    pendingFeedbackVisible: () => false, resetInFlight: false, buildHome() {},
  }, {}, 'settingsPageContent', ['settings-home']);
  const shellProps = onlyChild(settings, 'homeScroller');
  assert.equal(shellProps.homeScroller, scroller);
  const shell = render(settingsShell, ['build', 'homeContent', 'generalContent', 'overlayContent'], shellProps);
  assert.equal(onlyChild(shell, 'standardInitialScrollY').floatingHeader, true);
  const main = render(mainShell, ['build', 'content'], {
    ...onlyChild(shell, 'standardInitialScrollY'), navigationMode: () => 'bottom',
  });
  assert.equal(onlyChild(main, 'initialScrollY').floatingHeader, true);
  const standard = render(standardPage, ['scrollContent', 'content', 'emptySlot'], {
    ...onlyChild(main, 'initialScrollY'), scrollLayout: () => ({ startInset: 0, endInset: 0, mode: 'padding' }),
    geometry: { content: { frame: { left: 0, right: 0 } } },
  }, {}, 'scrollContent');
  const scroll = render(scrollHost, ['build', 'initialScrollY', 'content', 'emptySlot'], {
    ...onlyChild(standard, 'initialScrollY'), editingScroll: { id: 'test-scroll' },
  }, { readerScrollTopPadding: () => 0, readerScrollBottomPadding: () => 0 });
  assert.deepEqual([...scroll.nodes.values()].find(node => node.type === 'Scroll').initialOffset,
    { xOffset: 0, yOffset: 186.5 });

  scroller.currentOffset = () => ({ xOffset: 0, yOffset: 200 });
  navigateFromMenu(restored, '下载管理');
  assert.equal(navigation.snapshot().route, 'downloads');
  journey.returnToSettings();
  const downloadReturn = onlyChild(mountScene(), 'onOpenDownloads');
  assert.equal(downloadReturn.homeScrollY, 200);
  restored.onHomeScrollDeparture(42);
  assert.equal(presentation.homeScrollY, 200, 'successor Settings ignores the old opening');
  scroller.currentOffset = () => { throw Error('Scroll already detached'); };
  navigateFromMenu(downloadReturn, '下载管理');
  assert.equal(navigation.snapshot().route, 'downloads');
  journey.returnToSettings();
  assert.equal(onlyChild(mountScene(), 'onOpenDownloads').homeScrollY, 200);
  journey.openSettings();
  const fresh = onlyChild(mountScene(), 'onOpenDownloads');
  assert.equal(fresh.homeScrollY, 0, 'fresh top-level Settings starts at the top');
  for (const [title, section, offset] of [['通用设置', 'general', 73], ['关于 Reader', 'about', 129]]) {
    scroller.currentOffset = () => ({ xOffset: 0, yOffset: offset });
    navigateFromMenu(fresh, title);
    assert.equal(navigation.snapshot().settingsSection, section);
    assert.equal(presentation.homeScrollY, offset);
    back(navigation, target => {
      assert.equal(target, 'generalSettingsHome');
      navigation.setSettingsSection('home');
    });
    assert.equal(onlyChild(mountScene(), 'onOpenDownloads').homeScrollY, offset);
  }
}

async function wideSettingsRailSelectionSdk() {
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
  const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
  const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
  const indexSource = read('pages/Index');
  const railSource = read('features/settings/ui/ReaderWideSettingsShell');
  const sdk = boundedSurfaceSdk();
  class BottomNavigationPort {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  const { Component: Rail } = createReaderBuilderProbe(railSource, boundedMembers(railSource), {
    ...sdk.deps, ReaderBottomNavigation: BottomNavigationPort, settingsNavigationItems,
    ...productionReaderMotionSdk(), globalThis: { get Context() { return globalThis.Context; } },
    ReaderPressFeedback: productionReaderPressFeedback({ ColorMetrics: {
      resourceColor: base => ({ blendColor: () => ({ color: `pressed:${base}` }) }),
    } }),
    readerPageAreaLength: Number, readerInteractiveSafeLeft: () => 0, readerInteractiveSafeRight: () => 0,
    publishReaderMainViewport() {},
  }, { ...sdk.hooks, childSources: { ReaderBottomNavigation: read('app/navigation/ReaderBottomNavigation') } });

  function mount(source) {
    const navigation = new ReaderNavigation();
    const { owner } = createReaderBuilderProbe(source,
      ['wideSettingsRoute', 'wideSettingsLane', 'wideSettingsSelection', 'wideSettingsCollapsed', 'publishNavigation'],
      { ...sdk.deps, ReaderWideSettingsShell: Rail }, { ...sdk.hooks, childSources: { ReaderWideSettingsShell: railSource } });
    Object.assign(owner, {
      navigationOwner: navigation, route: 'bookshelf', settingsSection: 'home', navigationGeneration: 0,
      bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: { dismiss() {} },
      bookshelfModalVisible: () => false, wideSettingsInputAllowed: () => true,
      usesBottomMainNavigation: () => true, primaryTabFooterHeight: 88,
      wideSettingsPane: () => navigation.settingsPane(),
      requestWideSettingsPane() {}, requestWideSettingsMainTab() {}, secondaryRouteStack() {},
    });
    const publish = snapshot => {
      assert.ok(snapshot, 'navigation admits this settings transition');
      owner.publishNavigation(snapshot);
    };
    const advance = () => publish(navigation.advance());
    publish(navigation.openSettingsHome());
    owner.wideSettingsRoute();
    sdk.properties.flush();
    const rail = [...owner.children.values()].find(child => child instanceof Rail);
    assert.ok(rail, 'Index mounts the shared settings rail');
    const buttons = [...rail.nodes.values()].filter(node => node.type === 'Button' &&
      settingsNavigationItems().some(item => item.label === node.accessibilityText));
    assert.equal(buttons.length, settingsNavigationItems().length);
    const initialFill = buttons.find(button => button.accessibilityText === '通用设置').backgroundColor;
    const inactiveFill = buttons.find(button => button.accessibilityText === '关于 Reader').backgroundColor;
    assert.notDeepEqual(initialFill, inactiveFill, 'the selected row has its own fill');
    const railScroll = [...rail.nodes.values()].find(node => node.type === 'Scroll' && node.width === 164);
    assert.equal(railScroll.animation.duration, 180);
    rail.collapsed = true;
    sdk.properties.flush();
    assert.equal(railScroll.width, 56);
    assert.equal(railScroll.animation.duration, 180);
    rail.reduceMotion = true;
    rail.collapsed = false;
    sdk.properties.flush();
    assert.equal(railScroll.width, 164);
    assert.equal(railScroll.animation.duration, 0);
    const target = buttons.find(button => button.accessibilityText === '通用设置');
    const targetId = [...rail.nodes.entries()].find(([, node]) => node === target)[0];
    const press = rail.attributeCalls.find(call => call.id === targetId && call.property === 'attributeModifier').args[0];
    const paint = {};
    const port = new Proxy({}, { get: (_target, key) => value => { paint[key] = value; return port; } });
    press.applyPressedAttribute(port);
    assert.equal(paint.backgroundColor, `pressed:${initialFill}`);
    const assertSelection = label => {
      sdk.properties.flush();
      assert.equal([...owner.children.values()].find(child => child instanceof Rail), rail, 'selection keeps the mounted rail');
      assert.deepEqual(buttons.filter(button => button.accessibilitySelected === true).map(button => button.accessibilityText),
        [label], 'retained rail selection follows the published settings pane');
      for (const button of buttons) {
        assert.deepEqual(button.backgroundColor, button.accessibilityText === label ? initialFill : inactiveFill,
          'visual highlight and accessibility selection agree');
      }
    };
    return { navigation, publish, advance, assertSelection };
  }

  const current = mount(indexSource);
  current.assertSelection('通用设置');
  current.publish(current.navigation.setSettingsSection('about'));
  current.assertSelection('关于 Reader');
  current.publish(current.navigation.openDownloads({ kind: 'fresh', detailKey: '' }, () => undefined, current.advance));
  current.assertSelection('下载管理');
  current.publish(current.navigation.openSettingsHome());
  current.publish(current.navigation.openSourceManagement('settings', '', current.advance));
  current.publish(current.navigation.openSourceTools(current.advance));
  current.assertSelection('书源管理');
  current.publish(current.navigation.returnToBookshelf(undefined, current.advance, 'tab'));
  current.assertSelection('书源管理');
  current.publish(current.navigation.openSettingsHome());
  current.assertSelection('通用设置');

  // Reproduce the previous owner lookup without changing production files.
  const staleSource = indexSource.replace("pane: this.wideSettingsSelection(),", "pane: this.wideSettingsPane() ?? 'general',");
  assert.notEqual(staleSource, indexSource);
  const stale = mount(staleSource);
  stale.assertSelection('通用设置');
  stale.publish(stale.navigation.setSettingsSection('about'));
  assert.throws(() => stale.assertSelection('关于 Reader'), /retained rail selection follows/);
}

async function wideSettingsPanes() {
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const l0Items = settingsNavigationItems().map(item => item.id);
  const definition = readFileSync(new URL('../entry/src/main/ets/features/settings/presentation/SettingsNavigationItems.ts', import.meta.url), 'utf8');
  const extended = pureModuleProbe(definition, 'SettingsNavigationItems.ts', {
    isReaderProductSurfaceEnabled: surface => surface === 'sync',
  }, ['settingsNavigationItems']);
  assert.deepEqual(l0Items, ['general', 'source', 'bookshelfSettings', 'downloads', 'about']);
  assert.deepEqual(extended.settingsNavigationItems().map(item => item.id), ['general', 'source', 'sync', 'bookshelfSettings', 'downloads', 'about']);
  for (const file of ['SettingsPage', 'ReaderWideSettingsShell']) {
    const source = readFileSync(new URL(`../entry/src/main/ets/features/settings/ui/${file}.ets`, import.meta.url), 'utf8');
    assert.match(source, /ForEach\(settingsNavigationItems\(\)/);
  }
  const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    ['requestWideSettingsPane', 'requestWideSettingsMainTab', 'wideSettingsPane', 'wideSettingsInputAllowed',
      'publishNavigation', 'wideSettingsSelection'],
    { ReaderNativeAlertWindow: { isPresented: () => false } });
  const navigation = new ReaderNavigation();
  const runtime = {};
  const publish = (snapshot) => { if (snapshot !== undefined) index.publishNavigation(snapshot); };
  const advance = () => publish(navigation.advance());
  const openSource = () => publish(navigation.openSourceManagement('settings', '', advance));
  let danger = false;
  let temporaryBackCalls = 0;
  const index = Object.assign(new Index(), {
    navigationOwner: navigation, expandedLayout: () => true, currentReadingRuntime: () => runtime,
    route: 'bookshelf', navigationGeneration: 0, settingsSection: 'home', wideSettingsLane: 'settings-general',
    bookshelfModalVisible: () => false, rulesManagementInputAllowed: () => true,
    bookRemovalConfirmation: { isOpen: () => false, dismiss() {} }, jsonImportPresentation: { dismiss() {} },
    settingsNavigation: { returnToSettings: section => { advance(); navigation.setSettingsSection(section); publish(navigation.show('settings')); } },
    sourceNavigation: { returnToManagement: () => publish(navigation.backFromSourceTools(advance)) },
    libraryJourney: { returnToBookshelf: (focus, motion) => publish(navigation.returnToBookshelf(focus, advance, motion)) },
    openSettingsDestination: pane => {
      assert.equal(navigation.snapshot().route, 'settings');
      if (pane === 'source') openSource();
      if (pane === 'downloads') publish(navigation.openDownloads({ kind: 'fresh', detailKey: '' }, () => undefined, advance));
    },
  });
  const registerTemporary = () => {
    const current = navigation.snapshot();
    navigation.setTemporaryBack(current.route, current.generation, runtime, () => {
      temporaryBackCalls += 1;
      return true;
    }, 'submenu', () => danger);
  };
  publish(navigation.openSettingsHome());
  openSource();
  publish(navigation.openSourceTools(advance));
  registerTemporary();
  index.requestWideSettingsPane('source');
  assert.equal(navigation.snapshot().route, 'source', 'same-pane tap returns directly to its root');
  publish(navigation.openSourceTools(advance));
  registerTemporary();
  index.requestWideSettingsPane('about');
  assert.equal(navigation.snapshot().route, 'settings');
  assert.equal(index.wideSettingsPane(), 'about');
  assert.equal(index.wideSettingsLane, 'settings-about');
  assert.equal(index.wideSettingsMotion, 'tab', 'the right pane switches independently of the outer Settings tab');
  registerTemporary();
  danger = true;
  index.requestWideSettingsPane('downloads');
  index.requestWideSettingsMainTab('bookshelf');
  assert.equal(index.wideSettingsPane(), 'about', 'unconfirmed modal keeps both navigation lanes blocked');
  danger = false;
  index.requestWideSettingsPane('downloads');
  assert.equal(index.wideSettingsPane(), 'downloads');
  registerTemporary();
  index.requestWideSettingsMainTab('bookshelf');
  assert.equal(navigation.snapshot().route, 'bookshelf');
  assert.equal(navigation.routeMotion(), 'tab', 'the bottom Bookshelf tab resets the outer stack even from a settings child');
  assert.equal(index.wideSettingsLane, 'downloads', 'the departing Settings shell still paints its last right pane');
  assert.equal(index.wideSettingsSelection(), 'downloads');
  assert.equal(temporaryBackCalls, 0, 'direct taps never consume a temporary Back');
  publish(navigation.openSettingsHome());
  assert.equal(index.wideSettingsLane, 'settings-general', 'a fresh Settings tab starts on its configured root');
  publish(navigation.setSettingsSection('about'));
  back(navigation, target => assert.equal(target, 'bookshelf'), { wideSettings: true });
  openSource();
  publish(navigation.openSourceTools(advance));
  back(navigation, target => assert.equal(target, 'sourceManagement'), { wideSettings: true });

  const { ReaderPageGeometryInput, resolveReaderPageGeometry, applyReaderStandardFloatingHeader } = actualReaderPageLayout();
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 782;
  metrics.cutoutInsets.left = 40;
  const geometry = new ReaderPageGeometryInput(metrics);
  geometry.viewportWidth = 552;
  geometry.contentHorizontalPadding = 19;
  applyReaderStandardFloatingHeader(geometry);
  const fullSafe = resolveReaderPageGeometry(geometry);
  assert.equal(fullSafe.header.insetLeft, 40);
  assert.ok(fullSafe.content.frame.left > fullSafe.content.frame.right);
  geometry.originX = 200;
  applyReaderStandardFloatingHeader(geometry);
  const contained = resolveReaderPageGeometry(geometry);
  assert.equal(contained.header.insetLeft, contained.header.insetRight);
  assert.equal(contained.content.frame.left, contained.content.frame.right);
  await wideSettingsRailSelectionSdk();
}

async function retainedDirectoryBack() {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryDestination.ets', import.meta.url), 'utf8');
  const properties = createArkUIPropertyRuntimeProbe();
  const probe = createReaderBuilderProbe(source, [
    'interactive', 'opening', 'mounted', 'backBridge', 'backBridgeRevision', 'isOpeningCurrent',
    'onTemporaryBackBridge', 'aboutToAppear', 'aboutToDisappear', 'canHandle',
    'forwardTemporaryBack', 'publishTemporaryBack',
  ], properties.sdk, properties.hooks);
  const publications = [];
  const owner = new probe.Component(undefined, {
    opening: 41,
    interactive: true,
    onTemporaryBackBridge: (handler, identity, opening) => publications.push({ handler, identity, opening }),
  });
  let dismissals = 0;
  owner.aboutToAppear();
  owner.forwardTemporaryBack(41, () => { dismissals++; return true; }, 'directory-41');
  const firstLease = publications.at(-1).handler;
  assert.equal(firstLease(), true);
  owner.updateStateVars({ opening: 41, interactive: false });
  properties.flush();
  assert.equal(publications.at(-1).handler, undefined);
  assert.equal(firstLease(), false);
  owner.updateStateVars({ opening: 41, interactive: true });
  properties.flush();
  const current = publications.at(-1);
  assert.equal(current.identity, 'directory-41');
  assert.equal(current.opening, 41);
  assert.notEqual(current.handler, firstLease);
  assert.equal(firstLease(), false);
  assert.equal(current.handler(), true);
  assert.equal(dismissals, 2);
  owner.aboutToDisappear();
  assert.equal(current.handler(), false);
}

async function retainedRoutePorts() {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const properties = createArkUIPropertyRuntimeProbe();
  const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');
  class ScenePayload {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  class SettingsScenes extends ScenePayload {}
  class SharedDownloadScene extends ScenePayload {}
  class BookshelfScene extends ScenePayload {}
  const { owner } = createReaderBuilderProbe(read('pages/Index'), [
    'settingsContent', 'settingsPaintCurrent', 'downloadsContent', 'bookshelfRoute', 'bookshelfScenePorts', 'isCurrentRoute',
  ], { ...properties.sdk, SettingsScenes, SharedDownloadScene, BookshelfScene }, { ...properties.hooks,
    allowEmptyBranchAdmission: true, childSources: {
    SettingsScenes: read('app/composition/SettingsScenes'),
    SharedDownloadScene: read('features/downloads/ui/SharedDownloadScene'),
    BookshelfScene: read('features/bookshelf/ui/BookshelfScene'),
  } });
  const firstRuntime = {}, nextRuntime = {}, opened = [], back = [];
  Object.assign(owner, {
    route: 'settings', settingsSection: 'home', navigationGeneration: 4, detailShelfAdmissionMount: 1,
    mountedRuntimeOwner: firstRuntime, searchAppForeground: true, arkWebCapturesInput: false,
    expandedLayout: () => false, settingsPresentation: { snapshot: {} }, downloadPresentation: {},
    readingEntry: { sessionActive: false }, readingEntryActions: { shelfPreparing: false }, librarySearch: {},
    librarySearchSurface: () => {}, bookshelfContentAcceptsInput: () => true,
    isCurrentRuntime: runtime => runtime === owner.mountedRuntimeOwner,
    currentReadingRuntime: () => owner.mountedRuntimeOwner,
    isInteractiveBookshelfPresentation: (navigation, runtime, mounting) => navigation === owner.navigationGeneration &&
      runtime === owner.mountedRuntimeOwner && mounting === owner.detailShelfAdmissionMount,
    openSettingsDestination: destination => opened.push(destination),
    registerTemporaryBackBridge: (scope, navigation, runtime, handler, identity) => back.push({ scope, navigation, runtime, handler, identity }),
  });
  owner.settingsContent('settings');
  const settings = [...owner.children.values()].find(child => child instanceof SettingsScenes);
  assert.equal(settings.params.isInputAllowed(), true);
  owner.route = 'source'; owner.navigationGeneration = 5; owner.replay();
  assert.equal(settings.params.isInputAllowed(), false);
  settings.params.onOpen('downloads');
  assert.deepEqual(opened, []);
  owner.route = 'settings'; owner.navigationGeneration = 6; owner.replay();
  assert.equal([...owner.children.values()].find(child => child instanceof SettingsScenes), settings);
  assert.equal(settings.params.isInputAllowed(), true, 'retained settings accepts input on its returned generation');
  settings.params.onOpen('downloads');
  assert.deepEqual(opened, ['downloads']);

  owner.route = 'downloads'; owner.navigationGeneration = 7;
  owner.downloadsContent();
  const downloads = [...owner.children.values()].find(child => child instanceof SharedDownloadScene);
  owner.route = 'settings'; owner.navigationGeneration = 8; owner.replay();
  owner.route = 'downloads'; owner.navigationGeneration = 9; owner.mountedRuntimeOwner = nextRuntime; owner.replay();
  const dismiss = () => true;
  downloads.params.onTemporaryBackBridge(dismiss, 'download-selector');
  assert.deepEqual(back, [{ scope: 'downloads', navigation: 9, runtime: nextRuntime, handler: dismiss, identity: 'download-selector' }]);

  owner.route = 'bookshelf';
  owner.bookshelfRoute();
  const firstShelf = [...owner.children.values()].find(child => child instanceof BookshelfScene);
  assert.equal(firstShelf.params.ports.isInteractive(9), true);
  owner.navigationGeneration = 10; owner.replay();
  assert.equal([...owner.children.values()].filter(child => child instanceof BookshelfScene).length, 1);
  assert.equal(firstShelf.params.ports.isInteractive(10), true);
  owner.detailShelfAdmissionMount = 2; owner.mountedRuntimeOwner = firstRuntime; owner.replay();
  const currentShelf = [...owner.children.values()].findLast(child => child instanceof BookshelfScene);
  assert.notEqual(currentShelf, firstShelf);
  assert.equal(firstShelf.params.ports.isInteractive(10), false);
  assert.equal(currentShelf.params.ports.isInteractive(10), true);
}

async function downloadDirectoryReturn() {
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const read = file => readFileSync(new URL(`../entry/src/main/ets/app/composition/${file}.ets`, import.meta.url), 'utf8');
  const { ReaderDownloadJourney } = pureModuleProbe(read('ReaderDownloadJourney'), 'ReaderDownloadJourney.ets', {
    downloadBookFromReadingDetail, remoteReadingSeedForShelf, readingEntrySeedForContentKind, LOCAL_SOURCE_ID: 'local',
  }, ['ReaderDownloadJourney']);
  const { ReaderReadingEntryActions } = pureModuleProbe(read('ReaderReadingEntryActions'), 'ReaderReadingEntryActions.ets', {
    Observed: value => value, readingEntryInputForSearchContext,
  }, ['ReaderReadingEntryActions']);
  for (const replacement of [false, true]) {
    const navigation = new ReaderNavigation();
    const runtime = {};
    const book = { sourceId: 'source', bookId: 'opaque-book-id', sourceName: '书源', title: '未入架', author: '作者',
      contentKind: 'text', displayCoverUrl: 'https://example.invalid/display-cover' };
    const seed = { ...book, detailUrl: 'https://example.invalid/original-detail', searchVariables: { token: 'saved' } };
    const session = { identity: { sourceId: book.sourceId, bookId: book.bookId }, contentKind: 'text' };
    const hostInputs = [];
    const host = {
      openRemote(input, lease) {
        assert.equal(navigation.snapshot().route, 'detail');
        assert.equal(lease.isCurrent(), true);
        hostInputs.push(input);
        lease.changed({ scopeId: 7, sessionGeneration: 1, book, seed: input.seed, toc: [], inBookshelf: false,
          loadingMessage: '', verdict: 'readable' });
      },
      snapshot: () => ({ scopeId: -2 }),
    };
    const Entry = actualReadingEntryPresentation({ ReadingEntryHost: { forRuntime: () => host } });
    const entry = Object.assign(new Entry(), { book, seed, session, inBookshelf: false });
    const advance = () => navigation.advance().generation;
    navigation.returns.beginDetailEntry('search');
    navigation.returns.completeDetailEntry('search', 'search', false);
    const context = navigation.returns.captureReaderReturn(runtime, () => assert.fail());
    navigation.show('reading');
    navigation.returns.requestBookInfoAfterExit({ readerIdentity: 'reader', request() {} }, 'book', context);
    navigation.returns.dispatchAcceptedReaderExit('reader', 'book', runtime, {
      claimSystemFileExit: () => false, showReaderDetail: () => navigation.showReadingOrigin(),
    });
    navigation.openDirectory('detail', () => true);
    const actions = new ReaderReadingEntryActions(navigation, {}, {
      runtime: () => runtime, entry: () => entry, mounting: () => 1, shelfBooks: () => [],
      removalPending: () => false, advance, show: route => navigation.show(route), failure: assert.fail,
      search: () => ({ host: { visibilityChanged() {} }, admissionCandidates: () => [] }),
      sourceSwitch: () => ({}), entryPorts: () => ({ current: () => true, projectionVisible: () => true }),
      sourceName: () => book.sourceName,
    });
    const journey = new ReaderDownloadJourney(navigation, {
      runtime: () => runtime, scope: () => ({ instance: 1, mounting: 1 }), reading: () => entry,
      readingActions: () => actions, shelfBooks: () => [], advance, publish() {},
      feedback: assert.fail, showBookshelf: assert.fail, showSettings: assert.fail,
      openDetailDirectory: () => navigation.openDirectory('detail', () => true),
      downloads: () => ({ open(_owner, _identity, current) { assert.equal(current(), true); } }),
    });
    journey.open({ kind: 'fresh', detailKey: '' });
    assert.equal(navigation.snapshot().route, 'downloads');
    if (replacement) {
      entry.book = { ...book, bookId: 'intervening-book' };
      entry.seed = { ...seed, bookId: 'intervening-book' };
      entry.session = { ...session, identity: { ...session.identity, bookId: 'intervening-book' } };
    }
    journey.returnFromDownloads();
    assert.equal(navigation.snapshot().route, 'directory');
    assert.equal(navigation.snapshot().directoryReturnTarget, 'detail');
    assert.equal(navigation.returns.snapshot().retainedReader, context);
    assert.equal(hostInputs.length, 1);
    assert.equal(hostInputs[0].shelfSnapshot, undefined, 'a download display row is not a shelf membership receipt');
    assert.equal(hostInputs[0].seed.detailUrl, seed.detailUrl);
    assert.deepEqual(hostInputs[0].seed.searchVariables, seed.searchVariables);
    assert.equal(hostInputs[0].validatedSession, replacement ? undefined : session);
    assert.equal(entry.inBookshelf, false);
    assert.equal(navigation.closeDirectory(false, assert.fail)?.route, 'detail');
    assert.equal(navigation.returns.detailReturnTarget(runtime), 'reader');
  }
}

function legacyDownloadChapterReturn() {
  const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
  const runtime = {};
  const legacy = { sourceId: 'source', bookId: 'book', sourceName: 'Source', title: 'Old download', author: 'Author' };
  const chapter = { ...legacy, chapterId: '/chapter', index: 7, key: JSON.stringify(['source', 'book', 7]), navigable: true };
  const projected = { ...createDownloadBookView(legacy), projectionStatus: 'ready', chapters: [chapter] };
  const session = { identity: { sourceId: 'source', bookId: 'book' }, entries: [{ index: 7, url: '/chapter' }] };
  const { SharedDownloadPresentation } = pureModuleProbe(read('features/downloads/presentation/SharedDownloadPresentation.ets'),
    'SharedDownloadPresentation.ets', { Observed: value => value, downloadReadingShelfBook, RemoteReadingFlowGateway: class {
      constructor(owner) { assert.equal(owner, runtime); }
      async openCachedCatalogSession(seed, isCurrent) {
        assert.equal(seed.contentKind, 'text');
        assert.equal(isCurrent(), true);
        return session;
      }
    } }, ['SharedDownloadPresentation']);
  const { ReaderReadingEntryActions } = pureModuleProbe(read('app/composition/ReaderReadingEntryActions.ets'),
    'ReaderReadingEntryActions.ets', { Observed: value => value, readingEntryInputForSearchContext,
      ReaderCoreGateway: class { constructor() { assert.fail('admitted download cannot defer navigation to a shelf lookup'); } },
    }, ['ReaderReadingEntryActions']);
  const navigation = new ReaderNavigation();
  navigation.openSettingsHome();
  navigation.openDownloads({ kind: 'fresh', detailKey: projected.key }, () => undefined, () => navigation.advance());
  const entry = {
    finishReading() {}, beginReaderPresentation() {},
    enterRemoteDetail(owner, input, open) {
      assert.equal(owner, runtime);
      assert.equal(input.shelfSnapshot.contentKind, 'text');
      assert.equal(input.validatedSession, session);
      open(() => {}, []);
      this.book = input.shelfSnapshot;
      return true;
    },
    beginReading(_owner, index) { assert.equal(index, 7); this.sessionActive = true; },
  };
  const actions = new ReaderReadingEntryActions(navigation, { begin() {} }, {
    runtime: () => runtime, removalPending: () => false, entry: () => entry,
    advance: () => navigation.advance().generation, show: route => navigation.show(route), bindReader() {},
    restoreReaderReturn: () => false, search: () => ({ host: { visibilityChanged() {} }, admissionCandidates: () => [] }),
    sourceSwitch: () => ({}), shelfBooks: () => [legacy], entryPorts: () => ({}), failure: assert.fail,
  });
  const presentation = new SharedDownloadPresentation();
  presentation.opening = { owner: runtime, identity: 'download-view', isRouteCurrent: () => navigation.snapshot().route === 'downloads' };
  presentation.snapshot = { books: [projected] };
  return presentation.read('download-view', describeDownloadReadingTarget(projected, chapter),
    download => actions.openDownloadChapter(download, assert.fail), assert.fail, () => true, 'continue').then(() => {
    assert.equal(navigation.snapshot().route, 'reading');
    assert.equal(projected.shelfBook.contentKind, undefined);
    const returnState = { view: { detailKey: projected.key } };
    const returned = navigation.returns.captureReaderReturn(runtime, () => returnState);
    assert.equal(returned.fromDownloads, true);
    assert.equal(returned.downloadParent.presentation, returnState);
    let intent;
    navigation.returns.dispatchAcceptedReaderExit('reader', undefined, runtime, {
      claimSystemFileExit: () => false, deliverSystemFile: assert.fail,
      openDownloads: value => { intent = value; }, returnToReadingOrigin: assert.fail,
    });
    assert.deepEqual(intent, { kind: 'resume' });
  });
}

const routeFixtureSource = path => readFileSync(new URL(`../entry/src/main/ets/${path}.ets`, import.meta.url), 'utf8');

function alternateRouteSource(source, exact, replacement) {
  assert.ok(source.includes(exact), `negative control locates ${exact}`);
  return source.replace(exact, replacement);
}

async function readerCoverStack(route, names, source = routeFixtureSource('app/navigation/ReaderRouteStackSurface')) {
  const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const properties = createArkUIPropertyRuntimeProbe();
  const calls = [], frames = [], animations = [], timers = new Map();
  let timerId = 0;
  class NavPathStack {
    entries = [];
    getAllPathName() { return this.entries.map(entry => entry.name); }
    size() { return this.entries.length; }
    pushPath(entry, animated) { this.entries.push(entry); calls.push(['push', entry.name, animated]); }
    popToName(name, animated) {
      this.entries = this.entries.slice(0, this.getAllPathName().lastIndexOf(name) + 1);
      calls.push(['popToName', name, animated]);
    }
    pop(animated) { this.entries.pop(); calls.push(['pop', animated]); }
    clear(animated) { this.entries = []; calls.push(['clear', animated]); }
  }
  const { Component } = createReaderBuilderProbe(source, [
    'route', 'initialRoot', 'routeMotion', 'reduceMotion', 'viewportWidth', 'rootRoute', 'pathStack', 'mounted', 'routeUpdate',
    'animationGeneration', 'tabGeneration', 'tabProgress', 'previousTab', 'hasDestination', 'pendingTabResetFrom',
    'activeRouteAnimation', 'readerCoverGeneration', 'readerCoverStartGeneration', 'readerCoverSettled', 'preview',
    'paint', 'progress', 'routeEndTimer', 'pendingPushLane', 'pendingPushTimer', 'setPendingPushLane',
    'onReaderCovered', 'aboutToAppear', 'reconcile', 'finishTabTransition',
    'onRouteChanged', 'onReaderCoverChanged', 'readerCoverCanAnimate', 'retireStaleReaderCover', 'finishReaderCoverAnimation',
    'settleReaderCover', 'settleAnimation', 'completeRouteAnimation', 'revealRetainedDetail', 'nativeTransition',
    'clearRouteDeadline', 'armRouteDeadline', 'backGestureEnabled', 'beginPreview', 'updatePreview',
  ], {
    ...properties.sdk, ...productionReaderMotionSdk(), NavPathStack,
    NavigationOperation: { PUSH: 'push', POP: 'pop' }, ROOT_LANE: 'reader-route-root', RETAINED_READER_LANE: 'retained-reader',
    NATIVE_START_TIMEOUT_MS: 300, NATIVE_END_GRACE_MS: 100, readerMotionNowMs: () => 0,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    ReaderPostLayoutFrame: class { constructor(_context, run) { this.run = run; } },
    uiContext: { postFrameCallback: frame => frames.push(frame), animateTo(params, mutate) { animations.push(params); mutate(); } },
  }, properties.hooks);
  const host = new Component(undefined, { initialRoot: 'bookshelf', route, viewportWidth: 400 });
  host.aboutToAppear();
  host.pathStack.entries = names.map(name => ({ name }));
  calls.length = 0;
  return { host, calls, frames, animations, timers };
}

async function downloadEntryRouteFixture({ earlyDetail = false, immediateBack = false } = {}) {
  const { createReaderBuilderProbe, productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
  const indexSource = routeFixtureSource('pages/Index');
  const source = immediateBack ? alternateRouteSource(indexSource,
    'if (this.readerDetailCover) {\n      this.pendingBackDuringCover', 'if (false) {\n      this.pendingBackDuringCover') : indexSource;
  const entrySource = routeFixtureSource('app/composition/ReaderReadingEntryActions');
  const actionSource = earlyDetail ? alternateRouteSource(entrySource,
    'if (download === undefined) this.ports.show(route);', 'this.ports.show(route);') : entrySource;
  const { ReaderReadingEntryActions } = pureModuleProbe(actionSource, 'ReaderReadingEntryActions.ets', {
    Observed: value => value,
  }, ['ReaderReadingEntryActions']);
  const { ReaderExitActions } = pureModuleProbe(routeFixtureSource('app/composition/ReaderExitActions'),
    'ReaderExitActions.ets', {}, ['ReaderExitActions']);
  const { ReaderLibraryJourney } = pureModuleProbe(routeFixtureSource('app/composition/ReaderLibraryJourney'),
    'ReaderLibraryJourney.ets', {}, ['ReaderLibraryJourney']);
  const navigation = new ReaderNavigation();
  const runtime = {};
  const book = { sourceId: 'local', bookId: 'book' };
  const entry = {
    book, verdict: 'readable', sessionActive: false, readyGeneration: 0,
    beginReaderPresentation() { this.readyGeneration += 1; },
    beginReading() { this.sessionActive = true; },
    finishReading() { this.sessionActive = false; },
    enterLocalDetail(_runtime, supplied, _resume, prepare) { prepare(); this.book = supplied; return true; },
    acceptReaderExit() { return this.sessionActive; },
    currentExitLease() { return this.sessionActive ? { readerIdentity: 'reader', request() {} } : undefined; },
  };
  const frames = [], publications = [];
  const index = createReaderBuilderProbe(source, [
    'appRouteLane', 'publishNavigation', 'updateReaderParentMotion', 'readerParentMotionProgress', 'readerParentAnimation', 'readerParentViewportMatches',
    'completeReaderDetailCover', 'appRouteBackGestureEnabled', 'readerDetailCoverGeneration',
    'replayingReaderDetailBack', 'readerDetailReturnPaint', 'retireReaderDetailReturnPaintAfterLayout', 'readerSceneMotionEnabled',
    'onBackPress', 'dispatchBackDestination', 'handleDetailBack',
  ], {
    retainedReaderRoute, ...productionReaderMotionSdk(),
    ReaderPostLayoutFrame: class { constructor(_context, run) { this.run = run; } },
  }).owner;
  Object.assign(index, {
    route: 'bookshelf', navigationGeneration: 0, navigationOwner: navigation, directoryReturnTarget: 'detail',
    wideSettingsPane: () => undefined, searchAppForeground: true, visibleRouteMotion: 'none', readerParentProgress: 0,
    routeViewport: () => ({ width: 400, height: 800 }), readerParentAnimationGeneration: 0,
    currentReadingRuntime: () => runtime, readingEntry: entry, appReduceMotion: false, journeyRecoveryInputAllowed: () => true,
    getUIContext: () => ({
      postFrameCallback(frame) { frames.push(frame); },
      animateTo() { assert.fail('the Index must keep route animations scoped to their paint attributes'); },
    }),
    bookRemovalConfirmation: { dismiss() {}, isOpen: () => false }, jsonImportPresentation: { dismiss() {} },
    shelfGroupPresentation: { retire() {}, back: () => false }, bookshelfModalVisible: () => false,
    mangaSourceSwitch: { selectionVisible: false }, sourceSwitchPresentation: { isSurfacePresented: () => false },
  });
  const publish = snapshot => { index.publishNavigation(snapshot); publications.push(snapshot.route); };
  const advance = () => { const snapshot = navigation.advance(); publish(snapshot); return snapshot.generation; };
  const actions = new ReaderReadingEntryActions(navigation, { begin() {} }, {
    runtime: () => runtime, entry: () => entry, removalPending: () => false, advance,
    show: route => publish(navigation.show(route)), bindReader() {}, entryPorts: () => ({}),
    search: () => ({ host: { visibilityChanged() {} } }), sourceSwitch: () => ({}),
    restoreReaderReturn: context => {
      if (context === undefined) return false;
      navigation.returns.restoreReaderReturn(context, () => {});
      return true;
    },
  });
  index.readingEntryActions = actions;
  index.libraryJourney = new ReaderLibraryJourney(navigation, { runtime: () => runtime, readingActions: () => actions });
  const exit = new ReaderExitActions(navigation, {
    runtime: () => runtime, entry: () => entry, advance, publish, bindReader() {}, refreshDetail() {}, refreshShelf() {},
    captureReturn: () => navigation.returns.captureReaderReturn(runtime, () => ({})),
  });
  return { index, actions, exit, navigation, entry, book, frames, publications, publish };
}

async function downloadChapterTransition() {
  async function check(origin, earlyDetail = false) {
    const { index, actions, navigation, book, publications, publish } = await downloadEntryRouteFixture({ earlyDetail });
    if (origin === 'detail') publish(navigation.show('detail'));
    publish(navigation.openDownloads({ kind: 'fresh', detailKey: '' }, () => book, () => navigation.advance()));
    const names = origin === 'detail' ? ['detail', 'downloads'] : ['downloads'];
    const { host, calls, animations } = await readerCoverStack('downloads', names);
    publications.length = 0;
    actions.openDownloadChapter({ shelfBook: book, chapterIndex: 1 }, assert.fail);
    assert.equal(navigation.snapshot().route, 'reading');
    assert.ok(!publications.includes('detail'), 'download opening must not publish an intermediate detail');
    assert.equal(index.appRouteLane(), 'detail');
    assert.equal(index.readerParentMotionProgress(), 0);
    assert.equal(index.readerParentAnimation(), null);
    host.route = index.appRouteLane(); host.routeMotion = index.visibleRouteMotion;
    host.reconcile();
    assert.deepEqual(calls, [[origin === 'detail' ? 'popToName' : 'push', 'detail', false]]);
    assert.deepEqual(animations, []);
  }
  await check('bookshelf');
  await check('detail');
  await assert.rejects(check('detail', true), /must not publish an intermediate detail/);
  const failed = await downloadEntryRouteFixture();
  failed.publish(failed.navigation.openDownloads({ kind: 'fresh', detailKey: '' }, () => failed.book,
    () => failed.navigation.advance()));
  const restores = [];
  const enter = failed.entry.enterLocalDetail;
  failed.entry.enterLocalDetail = (...args) => { enter.call(failed.entry, ...args); failed.entry.book = undefined; return true; };
  failed.actions.openDownloadChapter({ shelfBook: failed.book, chapterIndex: 1 }, intent => restores.push(intent));
  assert.equal(failed.navigation.snapshot().route, 'downloads');
  assert.deepEqual(restores, [{ kind: 'resume' }], 'a partially admitted reader reopens the retired downloads presentation');
}

async function detailCoverBack() {
  async function check(immediateBack = false) {
    const { index, actions, exit, navigation, entry, frames, publish } = await downloadEntryRouteFixture({ immediateBack });
    const mounted = () => (entry.sessionActive || index.readerDetailCover) && entry.book !== undefined;
    navigation.returns.rememberBookshelfReaderOrigin();
    actions.openReading(undefined);
    const generation = entry.readyGeneration;
    exit.requestBookInfo(); exit.accepted('reader');
    const cover = index.readerDetailCoverGeneration;
    assert.equal(mounted(), true);
    assert.equal(index.appRouteBackGestureEnabled(), false);
    assert.equal(index.onBackPress(), true);
    assert.equal(navigation.snapshot().route, 'detail', 'Back must not re-enter while the old cover is mounted');
    assert.equal(index.onBackPress(), true);
    assert.equal(entry.readyGeneration, generation);
    index.completeReaderDetailCover(cover - 1);
    assert.equal(mounted(), true, 'a stale cover completion cannot dismiss the retained reader');
    index.completeReaderDetailCover(cover);
    index.completeReaderDetailCover(cover);
    assert.equal(mounted(), false);
    assert.equal(index.appRouteBackGestureEnabled(), false, 'duplicate input is fenced until replay');
    assert.equal(index.onBackPress(), true);
    assert.equal(frames.length, 1);
    frames.shift().run();
    assert.equal(entry.readyGeneration, generation + 1);
    assert.equal(mounted(), true);
    assert.equal(navigation.snapshot().route, 'reading');
    assert.equal(index.appRouteLane(), 'detail', 'the outgoing detail must cover the bookshelf until the replacement reader has laid out');
    assert.equal(index.readerSceneMotionEnabled(), false, 'the replacement reader must paint its full viewport on its first layout');
    assert.equal(index.onBackPress(), true, 'duplicate Back stays fenced during the replacement layout');
    assert.equal(navigation.snapshot().route, 'reading');
    const { host, calls } = await readerCoverStack('detail', ['detail']);
    host.route = index.appRouteLane(); host.routeMotion = index.visibleRouteMotion;
    host.reconcile();
    assert.deepEqual(calls, [], 'the native stack must keep the rendered detail destination');
    assert.equal(frames.length, 1);
    frames.shift().run();
    assert.equal(index.readerSceneMotionEnabled(), true, 'ordinary reader exit still has its native motion');
    assert.equal(index.appRouteLane(), 'bookshelf');
    host.route = index.appRouteLane(); host.routeMotion = index.visibleRouteMotion;
    host.reconcile();
    assert.deepEqual(calls, [['clear', false]], 'align the original parent silently after it is covered by the reader');
    exit.requestBookInfo(); exit.accepted('reader');
    assert.equal(index.onBackPress(), true);
    index.completeReaderDetailCover(index.readerDetailCoverGeneration);
    publish(navigation.advance());
    frames.shift().run();
    assert.equal(navigation.snapshot().route, 'detail');
    assert.equal(entry.readyGeneration, generation + 1, 'queued Back cannot escape its navigation generation');
  }
  await check();
  await assert.rejects(check(true), /Back must not re-enter/);
  const withTopLayer = await downloadEntryRouteFixture();
  withTopLayer.publish(withTopLayer.navigation.show('detail'));
  withTopLayer.actions.openReading(undefined);
  withTopLayer.exit.requestBookInfo();
  withTopLayer.exit.accepted('reader');
  assert.equal(withTopLayer.index.onBackPress(), true);
  withTopLayer.index.completeReaderDetailCover(withTopLayer.index.readerDetailCoverGeneration);
  let closed = false;
  withTopLayer.index.detailMoreBack = () => { closed = true; return true; };
  withTopLayer.frames.shift().run();
  assert.equal(closed, true, 'replayed Back still goes to the foreground surface');
  assert.equal(withTopLayer.navigation.snapshot().route, 'detail');
  assert.equal(withTopLayer.index.readerDetailReturnPaint, undefined, 'a foreground owner can consume Back without starting the reader handoff');
  const refused = await downloadEntryRouteFixture();
  refused.actions.openReading(undefined);
  refused.exit.requestBookInfo(); refused.exit.accepted('reader');
  refused.entry.verdict = 'unreadable';
  assert.equal(refused.index.onBackPress(), true);
  refused.index.completeReaderDetailCover(refused.index.readerDetailCoverGeneration);
  refused.frames.shift().run();
  assert.equal(refused.navigation.snapshot().route, 'detail');
  assert.equal(refused.index.readerDetailReturnPaint, undefined, 'a rejected resume leaves the active detail in normal ownership');
  const { host, calls } = await readerCoverStack('detail', ['detail']);
  host.readerCoverGeneration = 1; host.backGestureEnabled = true;
  host.beginPreview(90);
  assert.deepEqual(calls, [], 'even stale enabled props cannot initiate a native Back edge during cover');
}

async function detailCoverBackground() {
  async function pendingFrame(source) {
    const { host, frames, animations, timers } = await readerCoverStack('detail', ['detail'], source);
    Object.assign(host, { readerCoverGeneration: 5, routeMotion: 'push' });
    host.reconcile();
    assert.equal(timers.size, 1);
    assert.equal(frames.length, 1);
    // Start can observe the policy before the rest of the cover props arrive.
    host.routeMotion = 'none';
    frames.shift().run();
    assert.deepEqual(animations, [], 'foreground policy must be rechecked at animation start');
    assert.equal(host.activeRouteAnimation, undefined);
    assert.equal(timers.size, 0);
    assert.equal(host.paint, undefined);
    assert.equal(host.progress, 1);
  }
  await pendingFrame();
  const source = routeFixtureSource('app/navigation/ReaderRouteStackSurface');
  await assert.rejects(pendingFrame(alternateRouteSource(source, 'if (!this.readerCoverCanAnimate(generation)) { finish(); return; }', '')),
    /foreground policy must be rechecked/);

  for (const late of ['custom-transition', 'proxy', 'frame']) {
    const { host, frames, animations, timers } = await readerCoverStack('directory', ['detail', 'directory']);
    Object.assign(host, { route: 'detail', routeMotion: 'push', readerCoverGeneration: 7 });
    host.reconcile();
    const detail = host.pathStack.entries.at(-1);
    assert.deepEqual(detail.param, { readerCoverGeneration: 7 });
    const makeTransition = () => host.nativeTransition({ name: 'directory' }, detail, 'push');
    let native = late === 'custom-transition' ? undefined : makeTransition();
    let finished = 0;
    const proxy = { finishTransition() { finished += 1; } };
    if (late === 'frame') native.transition(proxy);
    Object.assign(host, { readerCoverGeneration: undefined, routeMotion: 'none' });
    host.onReaderCoverChanged();
    assert.equal(timers.size, 0, `background retires the ${late} timer`);
    assert.equal(host.activeRouteAnimation, undefined);
    assert.equal(host.paint, undefined);
    if (late === 'custom-transition') native = makeTransition();
    if (late !== 'frame') native.transition(proxy);
    frames.shift()?.run();
    native.onTransitionEnd?.(true);
    assert.equal(finished, 1, `${late} native proxy receives one finish`);
    assert.deepEqual(animations, [], `${late} must not paint a retired cover`);
    assert.equal(host.progress, 1);
  }
}

const checks = {
  'directory-reading-return': directoryReadingReturn,
  'settings-tools-return': settingsToolsReturn,
  'settings-scroll-roundtrip': settingsScrollRoundtrip,
  'wide-settings-panes': wideSettingsPanes,
  'route-transition-effects': routeTransitionEffects,
  'retained-directory-back': retainedDirectoryBack,
  'retained-route-ports': retainedRoutePorts,
  'download-directory-return': downloadDirectoryReturn,
  'legacy-download-chapter-return': legacyDownloadChapterReturn,
  'download-chapter-transition': downloadChapterTransition,
  'detail-cover-back': detailCoverBack,
  'detail-cover-background': detailCoverBackground,
};
for (const id of selectContractCases(cases)) {
  await checks[id]();
  recordContractCasePass(id);
}

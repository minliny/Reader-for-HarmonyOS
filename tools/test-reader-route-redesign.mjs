import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {
  READER_NAVIGATION_POP_MS, READER_NAVIGATION_PUSH_MS, READER_NAVIGATION_TAB_MS, READER_REDUCED_FADE_MS,
} from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';

const cases = {
  'directory-reading-return': {
    description: 'Actual route owner opens reading under the detail directory and returns one level at a time.',
    resources: [],
  },
  'settings-tools-return': {
    description: 'Main tab reset, source tools stack, and priority of the current foreground Back consumer.',
    resources: [],
  },
  'route-transition-effects': {
    description: 'Production transition directions, parent parallax, and shared opacity-only reduced motion.',
    resources: [],
  },
  'retained-directory-back': {
    description: 'Actual directory Back bridge re-registers on the same SDK instance at readmission and fences its old lease.',
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

function routeTransitionEffects() {
  const effect = (kind, value) => ({
    kind, value,
    animation(timing) { return effect(kind, { value, timing }); },
    combine(other) { return effect('combined', [this, other]); },
  });
  const TransitionEffect = {
    IDENTITY: effect('identity'),
    opacity: value => effect('opacity', value),
    scale: value => effect('scale', value),
    translate: value => effect('translate', value),
    move: value => effect('move', value),
    asymmetric: (enter, exit) => ({ enter, exit }),
  };
  const timing = {
    'app.navigation.push': READER_NAVIGATION_PUSH_MS,
    'app.navigation.pop': READER_NAVIGATION_POP_MS,
    'app.navigation.tab': READER_NAVIGATION_TAB_MS,
  };
  const source = readFileSync(new URL('../entry/src/main/ets/app/navigation/ReaderRouteMotion.ets', import.meta.url), 'utf8');
  const { readerRouteTransition } = pureModuleProbe(source, 'ReaderRouteMotion.ets', {
    TransitionEffect,
    TransitionEdge: { END: 'end' },
    readerMotionAnimateParam: id => ({ duration: timing[id] }),
    readerMotionReducedFadeParam: () => ({ duration: READER_REDUCED_FADE_MS }),
  }, ['readerRouteTransition']);

  const push = readerRouteTransition('push', 400, false);
  const pop = readerRouteTransition('pop', 400, false);
  assert.deepEqual(push.enter.value, { value: { x: 400, y: 0 }, timing: { duration: 260 } });
  assert.deepEqual(pop.exit.value, { value: { x: 400, y: 0 }, timing: { duration: 240 } });
  assert.deepEqual(push.exit.value.value.map(node => node.value), [{ x: -64, y: 0 }, 0.96]);
  assert.deepEqual(pop.enter.value.value.map(node => node.value), [{ x: -64, y: 0 }, 0.96]);
  const tab = readerRouteTransition('tab', 400, false);
  assert.equal(tab.value.timing.duration, 180);
  assert.deepEqual(tab.value.value.map(node => [node.kind, node.value]), [
    ['opacity', 0.72], ['scale', { x: 0.992, y: 0.992 }],
  ]);
  const surface = readFileSync(new URL('../entry/src/main/ets/app/navigation/ReaderRouteStackSurface.ets', import.meta.url), 'utf8');
  assert.match(surface, /readerRouteTransition\('tab', 0, this\.reduceMotion\), TransitionEffect\.IDENTITY/);
  for (const kind of ['push', 'pop', 'tab']) {
    const reduced = readerRouteTransition(kind, 400, true);
    assert.equal(reduced.kind, 'opacity');
    assert.deepEqual(reduced.value, { value: 0, timing: { duration: 120 } });
  }
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

const checks = {
  'directory-reading-return': directoryReadingReturn,
  'settings-tools-return': settingsToolsReturn,
  'route-transition-effects': routeTransitionEffects,
  'retained-directory-back': retainedDirectoryBack,
};
for (const id of selectContractCases(cases)) {
  await checks[id]();
  recordContractCasePass(id);
}

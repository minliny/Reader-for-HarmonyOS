import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AppRouteCoordinator,
  type AppExtensionOpeningPorts,
  type AppExtensionOpeningScope,
} from '../../entry/src/main/ets/app/AppRouteCoordinator.ts';
import { bindReaderNamedPublicStorage } from '../../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
import { READER_VM_JOURNEY_SCOPE } from '../../entry/src/main/ets/app/diagnostics/ReaderVmJourneyData.ts';
import {
  ReaderNavigation,
  type ReaderRoute,
} from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import type { ReaderRuntimeOwner } from '../../entry/src/main/ets/app/ReaderRuntimeOwner.ts';

function transitionContext(navigation: ReaderNavigation, currentLane: ReaderRoute, foreground = true) {
  return {
    routeMotion: navigation.routeMotion(),
    foreground,
    readingSessionActive: true,
    hasReadingBook: true,
    readingOrigin: navigation.returns.snapshot().readingOrigin,
    currentLane: () => currentLane,
  };
}

test('bookshelf and search retain the shelf lane, and an unchanged route leaves the motion in place', () => {
  const coordinator = new AppRouteCoordinator();
  const navigation = new ReaderNavigation();
  const search = navigation.show('search', 'push');
  const opened = coordinator.transition('bookshelf', 'detail', search, transitionContext(navigation, 'bookshelf'));
  assert.equal(opened.paintMotion, 'none');
  assert.equal(coordinator.appLane(search.route, search.directoryReturnTarget, false, 'detail', assert.fail), 'bookshelf');
  assert.equal(coordinator.transition('search', 'detail', navigation.advance(), transitionContext(navigation, 'bookshelf'))
    .paintMotion, undefined);

  const shelf = navigation.show('bookshelf', 'pop');
  assert.equal(coordinator.transition('search', 'detail', shelf, transitionContext(navigation, 'bookshelf')).paintMotion, 'none');
});

test('the reader retains its current parent lane and its control directory shares the surface', () => {
  const coordinator = new AppRouteCoordinator();
  const navigation = new ReaderNavigation();
  navigation.returns.rememberBookshelfReaderOrigin();
  const reading = navigation.show('reading');
  const opened = coordinator.transition('bookshelf', 'detail', reading, transitionContext(navigation, 'bookshelf'));
  assert.equal(coordinator.recordReaderParentLane(opened, 'bookshelf'), true);
  assert.equal(coordinator.appLane(reading.route, reading.directoryReturnTarget, false, 'bookshelf', assert.fail), 'bookshelf');

  const directory = navigation.openDirectory('readerControl', () => true);
  assert.ok(directory);
  const withinReader = coordinator.transition('reading', 'detail', directory, transitionContext(navigation, 'bookshelf'));
  assert.equal(withinReader.fromReader, true);
  assert.equal(withinReader.toReader, true);
  assert.equal(withinReader.paintMotion, 'none');
  const shelf = navigation.show('bookshelf');
  const reveal = coordinator.transition('directory', 'readerControl', shelf, transitionContext(navigation, 'bookshelf'));
  assert.equal(reveal.previousLane, 'bookshelf');
  assert.equal(reveal.toReader, false);
  assert.equal(coordinator.recordReaderParentLane(reveal, 'bookshelf'), true);
});

test('reader/detail coverage wins over native route motion only in the foreground', () => {
  const coordinator = new AppRouteCoordinator();
  const navigation = new ReaderNavigation();
  navigation.show('reading');
  const detail = navigation.show('detail', 'push');
  const opening = coordinator.transition('reading', 'detail', detail, transitionContext(navigation, 'detail'));
  assert.equal(opening.incomingDetail, true);
  assert.equal(opening.paintMotion, 'none');
  const background = coordinator.transition('reading', 'detail', detail, transitionContext(navigation, 'detail', false));
  assert.equal(background.incomingDetail, false);
  assert.equal(background.paintMotion, 'push');

  const returned = navigation.show('reading', 'pop');
  const returning = coordinator.transition('detail', 'detail', returned, transitionContext(navigation, 'detail'));
  assert.equal(returning.returningFromDetail, true);
  assert.equal(returning.paintMotion, 'none');
  assert.equal(coordinator.recordReaderParentLane(returning, 'detail'), false);
  assert.equal(coordinator.appLane('reading', 'detail', true, 'bookshelf', assert.fail), 'detail');
});

test('wide settings keep the source tool and section lanes distinct', () => {
  const coordinator = new AppRouteCoordinator();
  const navigation = new ReaderNavigation();
  navigation.openSettingsHome();
  assert.equal(coordinator.settingsLane('settings', navigation.settingsPane()), 'settings-general');
  navigation.setSettingsSection('backup');
  assert.equal(coordinator.settingsLane('settings', navigation.settingsPane()), 'settings-backup');
  const source = navigation.openSourceManagement('settings', '', () => { navigation.advance(); });
  assert.ok(source);
  assert.equal(coordinator.settingsLane(source.route, navigation.settingsPane()), 'source');
  assert.equal(coordinator.appLane(source.route, source.directoryReturnTarget, false, 'detail', () => true), 'settings');
  const tools = navigation.openSourceTools(() => { navigation.advance(); });
  assert.ok(tools);
  assert.equal(coordinator.settingsLane(tools.route, navigation.settingsPane()), 'sourceTools');
  navigation.show('bookshelf');
  assert.equal(coordinator.settingsLane('bookshelf', navigation.settingsPane()), undefined);
});

test('extension opening honors the product gate, retirement, and exact opening identity', () => {
  const coordinator = new AppRouteCoordinator();
  const owner = {} as ReaderRuntimeOwner;
  let scope: AppExtensionOpeningScope = { owner, mounting: 5, generation: 9, route: 'detail', retired: false };
  let currentOwner = owner;
  let current: (() => boolean) | undefined;
  const steps: string[] = [];
  const ports: AppExtensionOpeningPorts = {
    advance: () => { steps.push('advance'); scope = { ...scope, generation: scope.generation + 1 }; },
    endReading: () => { steps.push('endReading'); },
    show: (route, motion) => { steps.push(`show:${route}:${motion}`); scope = { ...scope, route }; },
    scope: () => scope,
    isCurrentOwner: (candidate) => candidate === currentOwner,
    open: (candidate, identity, isCurrent) => {
      assert.equal(candidate, owner);
      steps.push(identity);
      current = isCurrent;
    },
  };

  coordinator.openExtension(2, 'discover', 'pop', ports);
  assert.deepEqual(steps, []);
  bindReaderNamedPublicStorage(READER_VM_JOURNEY_SCOPE, '/data/storage/el4/base/files', '/data/storage/el4/base/cache');
  coordinator.openExtension(2, 'discover', 'pop', ports);
  assert.deepEqual(steps, ['advance', 'endReading', 'show:discover:pop', '[2,5,10,"discover"]']);
  assert.ok(current);
  assert.equal(current(), true);

  const opening = scope;
  scope = { ...opening, generation: 11 };
  assert.equal(current(), false);
  scope = { ...opening, mounting: 6 };
  assert.equal(current(), false);
  scope = { ...opening, retired: true };
  assert.equal(current(), false);
  scope = { ...opening, route: 'bookshelf' };
  assert.equal(current(), false);
  scope = opening;
  currentOwner = {} as ReaderRuntimeOwner;
  assert.equal(current(), false);
});
